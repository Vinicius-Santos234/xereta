// A ponte HTTP (E2): recebe o que as fontes mandam em 127.0.0.1 e repassa à página.
// Ela não sabe de onde vêm os eventos nem o que querem dizer (D2): confere o token, o tamanho
// e se o corpo é JSON, e segura o pedido aberto até a página decidir ou o tempo acabar.
//
//   POST /fontes/<fonte>/evento  → 200 vazio na hora (D8)
//   POST /fontes/<fonte>/pedido  → fica aberta até a página responder; sem resposta, 200 vazio (D6, D7)
//
// O HTTP é lido aqui mesmo, só o pedaço que a ponte usa: uma requisição por conexão, corpo com
// Content-Length, prazo para chegar inteira. Qualquer programa da máquina fala com 127.0.0.1,
// então nada aqui confia no cliente: nem no tamanho que ele declara, nem no ritmo em que ele manda.

use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

/// Corpo maior que isto é recusado com 413.
const LIMITE_CORPO: usize = 10 * 1024 * 1024;
/// Linha de pedido + cabeçalhos maiores que isto são recusados com 431.
const LIMITE_CABECALHO: usize = 16 * 1024;
/// Tempo para a requisição chegar inteira, do primeiro byte ao fim do corpo.
const PRAZO_LEITURA: Duration = Duration::from_secs(10);
/// Conexões ao mesmo tempo. Acima disso, a conexão nova é fechada sem resposta.
const MAX_CONEXOES: usize = 64;
/// Pedidos esperando decisão ao mesmo tempo. Acima disso, o pedido novo volta vazio na hora
/// e cai no terminal (D6).
const MAX_PEDIDOS: usize = 32;

/// O que a ponte avisa à página (evento "ponte" do Tauri).
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "aviso", rename_all = "camelCase")]
pub enum Aviso {
    /// Algo aconteceu; a fonte já recebeu o 200.
    Evento { fonte: String, corpo: Value },
    /// A fonte quer uma decisão, e a conexão dela fica aberta até `Ponte::responder(id, …)`.
    Pedido { id: u64, fonte: String, corpo: Value },
    /// O tempo do pedido acabou e a fonte recebeu 200 vazio: a página tira o pedido da tela.
    Expirou { id: u64 },
}

pub type Avisar = Arc<dyn Fn(Aviso) + Send + Sync>;

/// Erro ao ligar a ponte. O `codigo` vira frase na página (D16); o Rust não escreve para a tela.
#[derive(Serialize, Debug)]
pub struct ErroPonte {
    pub codigo: &'static str,
    pub porta: u16,
    pub detalhe: String,
}

/// Pedidos abertos: o id e por onde mandar a decisão (`None` = sem decisão).
type Pedidos = Arc<Mutex<HashMap<u64, mpsc::Sender<Option<String>>>>>;

pub struct Ponte {
    porta: u16,
    pedidos: Pedidos,
}

/// O que as threads de atendimento dividem.
struct Comum {
    autorizacao: String,
    espera: Duration,
    prazo_leitura: Duration,
    pedidos: Pedidos,
    proximo_id: AtomicU64,
    conexoes: AtomicUsize,
    avisar: Avisar,
}

enum Rota {
    Evento,
    Pedido,
}

impl Ponte {
    /// Liga o servidor em 127.0.0.1:`porta`. Porta ocupada é erro: a ponte nunca troca de porta
    /// sozinha, porque os hooks apontam para esta (D4).
    pub fn ligar(porta: u16, token: &str, espera: Duration, avisar: Avisar) -> Result<Ponte, ErroPonte> {
        Self::ligar_com_prazo(porta, token, espera, PRAZO_LEITURA, avisar)
    }

    fn ligar_com_prazo(porta: u16, token: &str, espera: Duration, prazo_leitura: Duration, avisar: Avisar) -> Result<Ponte, ErroPonte> {
        let erro = |codigo, detalhe: String| ErroPonte { codigo, porta, detalhe };
        // sem token não há ponte: qualquer programa da máquina fala com 127.0.0.1 (D5)
        if !token_valido(token) {
            return Err(erro("token-invalido", "o token precisa de 32 ou mais letras, dígitos, - ou _".into()));
        }
        let ouvinte = TcpListener::bind(("127.0.0.1", porta)).map_err(|e| {
            let codigo = if e.kind() == io::ErrorKind::AddrInUse { "porta-ocupada" } else { "falha" };
            erro(codigo, e.to_string())
        })?;
        let porta = ouvinte.local_addr().map(|a| a.port()).unwrap_or(porta);

        let pedidos = Pedidos::default();
        let comum = Arc::new(Comum {
            autorizacao: format!("Bearer {token}"),
            espera,
            prazo_leitura,
            pedidos: Arc::clone(&pedidos),
            proximo_id: AtomicU64::new(1),
            conexoes: AtomicUsize::new(0),
            avisar,
        });
        thread::Builder::new()
            .name("ponte".into())
            .spawn(move || {
                // uma thread por conexão, até o teto: um pedido esperando decisão não segura os outros
                for conexao in ouvinte.incoming().flatten() {
                    if comum.conexoes.fetch_add(1, Ordering::SeqCst) >= MAX_CONEXOES {
                        comum.conexoes.fetch_sub(1, Ordering::SeqCst);
                        continue; // fecha ao sair do escopo
                    }
                    let da_thread = Arc::clone(&comum);
                    let lancou = thread::Builder::new().spawn(move || {
                        atender(conexao, &da_thread);
                        da_thread.conexoes.fetch_sub(1, Ordering::SeqCst);
                    });
                    if lancou.is_err() {
                        // sem thread, a conexão fechou junto com a closure; o contador volta aqui
                        comum.conexoes.fetch_sub(1, Ordering::SeqCst);
                    }
                }
            })
            .map_err(|e| erro("falha", e.to_string()))?;
        Ok(Ponte { porta, pedidos })
    }

    pub fn porta(&self) -> u16 {
        self.porta
    }

    /// Entrega a decisão da página ao pedido `id`. `None` = sem decisão: a fonte recebe 200
    /// vazio e segue o caminho de sempre (D6). Um corpo que não é JSON é recusado, e o pedido
    /// continua aberto.
    pub fn responder(&self, id: u64, corpo: Option<String>) -> Result<(), String> {
        if let Some(c) = &corpo {
            serde_json::from_str::<Value>(c).map_err(|e| format!("a resposta não é JSON: {e}"))?;
        }
        // tira do mapa e envia com a trava na mão: o fim do tempo nunca perde uma resposta que já saiu
        let mut pedidos = travar(&self.pedidos);
        let canal = pedidos.remove(&id).ok_or_else(|| format!("o pedido {id} não está mais aberto"))?;
        let _ = canal.send(corpo);
        Ok(())
    }

    /// Devolve vazio a todos os pedidos abertos: eles caem no terminal na hora. Usado quando a
    /// página recarrega e perde a lista do que estava mostrando.
    pub fn encerrar_pedidos(&self) {
        for (_, canal) in travar(&self.pedidos).drain() {
            let _ = canal.send(None);
        }
    }
}

/// Letras, dígitos, `-` e `_`, com 32 ou mais: o que cabe num cabeçalho HTTP sem surpresa.
pub fn token_valido(token: &str) -> bool {
    token.len() >= 32 && token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn atender(mut conexao: TcpStream, c: &Comum) {
    let _ = conexao.set_write_timeout(Some(c.prazo_leitura));
    match ler(&mut conexao, c) {
        Err(status) => {
            escrever(&mut conexao, status, None);
            encerrar(conexao);
        }
        Ok((fonte, Rota::Evento, corpo)) => {
            // responde antes de avisar: o status nunca espera a página (D8)
            escrever(&mut conexao, 200, None);
            (c.avisar)(Aviso::Evento { fonte, corpo });
        }
        Ok((fonte, Rota::Pedido, corpo)) => {
            let decisao = esperar_decisao(c, fonte, corpo);
            escrever(&mut conexao, 200, decisao.as_deref());
        }
    }
}

/// Lê e confere a requisição. O erro é o status HTTP da resposta.
fn ler(conexao: &mut TcpStream, c: &Comum) -> Result<(String, Rota, Value), u16> {
    let prazo = Instant::now() + c.prazo_leitura;

    // cabeçalho: até a linha em branco, sem passar do limite
    let mut lido = Vec::new();
    let fim_cabecalho = loop {
        // o limite vale também quando o cabeçalho grande chega inteiro de uma vez
        let ate_onde = lido.len().min(LIMITE_CABECALHO + 4);
        if let Some(i) = lido[..ate_onde].windows(4).position(|j| j == b"\r\n\r\n") {
            break i;
        }
        if lido.len() > LIMITE_CABECALHO {
            return Err(431);
        }
        let mut pedaco = [0u8; 4096];
        let n = ler_ate(conexao, &mut pedaco, prazo)?;
        if n == 0 {
            return Err(400); // fechou antes de mandar o cabeçalho inteiro
        }
        lido.extend_from_slice(&pedaco[..n]);
    };
    let cabecalho = std::str::from_utf8(&lido[..fim_cabecalho]).map_err(|_| 400u16)?;
    let mut linhas = cabecalho.split("\r\n");
    let mut inicio = linhas.next().unwrap_or("").split(' ');
    let (metodo, alvo, versao) = (inicio.next().unwrap_or(""), inicio.next().unwrap_or(""), inicio.next().unwrap_or(""));
    if !versao.starts_with("HTTP/1.") || inicio.next().is_some() {
        return Err(400);
    }

    let mut autorizado = false;
    let mut tamanho: Option<usize> = None;
    let mut em_pedacos = false;
    let mut quer_continuar = false;
    for linha in linhas {
        let (nome, valor) = linha.split_once(':').ok_or(400u16)?;
        let valor = valor.trim();
        if nome.eq_ignore_ascii_case("authorization") {
            // o token vem antes de tudo, comparado sem pressa (ver `iguais`)
            autorizado |= iguais(valor.as_bytes(), c.autorizacao.as_bytes());
        } else if nome.eq_ignore_ascii_case("content-length") {
            let n = valor.parse::<usize>().map_err(|_| 400u16)?;
            if tamanho.is_some_and(|t| t != n) {
                return Err(400); // dois tamanhos diferentes: não dá para saber onde o corpo acaba
            }
            tamanho = Some(n);
        } else if nome.eq_ignore_ascii_case("transfer-encoding") {
            em_pedacos = true;
        } else if nome.eq_ignore_ascii_case("expect") && valor.eq_ignore_ascii_case("100-continue") {
            quer_continuar = true;
        }
    }

    // sem token, ninguém descobre nem quais rotas existem
    if !autorizado {
        return Err(401);
    }
    if metodo != "POST" {
        return Err(405);
    }
    let (fonte, rota) = rota(alvo).ok_or(404u16)?;
    if em_pedacos {
        return Err(411); // os hooks mandam o tamanho; corpo em pedaços não é aceito
    }
    let tamanho = tamanho.unwrap_or(0);
    if tamanho > LIMITE_CORPO {
        return Err(413);
    }
    if quer_continuar {
        let _ = conexao.write_all(b"HTTP/1.1 100 Continue\r\n\r\n");
    }

    // corpo: o que já veio junto com o cabeçalho, mais o resto, nunca além do tamanho declarado
    let mut corpo = lido.split_off(fim_cabecalho + 4);
    if corpo.len() > tamanho {
        return Err(400); // mandou mais do que disse
    }
    while corpo.len() < tamanho {
        let mut pedaco = [0u8; 64 * 1024];
        let falta = (tamanho - corpo.len()).min(pedaco.len());
        let n = ler_ate(conexao, &mut pedaco[..falta], prazo)?;
        if n == 0 {
            return Err(400); // fechou no meio do corpo
        }
        corpo.extend_from_slice(&pedaco[..n]);
    }
    let json = serde_json::from_slice(&corpo).map_err(|_| 400u16)?;
    Ok((fonte, rota, json))
}

/// Uma leitura que respeita o prazo da requisição inteira, e não só desta leitura: quem manda um
/// byte de cada vez não segura a conexão para sempre.
fn ler_ate(conexao: &mut TcpStream, buf: &mut [u8], prazo: Instant) -> Result<usize, u16> {
    let resta = prazo.saturating_duration_since(Instant::now());
    if resta.is_zero() {
        return Err(408);
    }
    conexao.set_read_timeout(Some(resta)).map_err(|_| 400u16)?;
    match conexao.read(buf) {
        Ok(n) => Ok(n),
        Err(e) if matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut) => Err(408),
        Err(_) => Err(400),
    }
}

/// `/fontes/<fonte>/evento` ou `/fontes/<fonte>/pedido`. A fonte é só um nome: minúsculas,
/// dígitos e hífen.
fn rota(url: &str) -> Option<(String, Rota)> {
    let caminho = url.split('?').next()?;
    let mut partes = caminho.strip_prefix("/fontes/")?.split('/');
    let fonte = partes.next()?;
    let rota = match partes.next()? {
        "evento" => Rota::Evento,
        "pedido" => Rota::Pedido,
        _ => return None,
    };
    let nome_ok = (1..=40).contains(&fonte.len())
        && fonte.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if partes.next().is_some() || !nome_ok {
        return None;
    }
    Some((fonte.to_string(), rota))
}

/// Avisa a página e espera a decisão por até `c.espera`. Sem decisão, `None`.
fn esperar_decisao(c: &Comum, fonte: String, corpo: Value) -> Option<String> {
    let id = c.proximo_id.fetch_add(1, Ordering::Relaxed);
    let (canal, chegada) = mpsc::channel();
    {
        let mut pedidos = travar(&c.pedidos);
        if pedidos.len() >= MAX_PEDIDOS {
            return None; // fila cheia: cai no terminal na hora, sem aparecer na ilha
        }
        pedidos.insert(id, canal);
    }
    (c.avisar)(Aviso::Pedido { id, fonte, corpo });
    match chegada.recv_timeout(c.espera) {
        Ok(decisao) => decisao,
        Err(_) => {
            // o tempo acabou, mas a página pode ter respondido neste instante: vale quem tirar
            // o pedido do mapa primeiro
            let ainda_aberto = travar(&c.pedidos).remove(&id).is_some();
            if ainda_aberto {
                (c.avisar)(Aviso::Expirou { id });
                None
            } else {
                chegada.try_recv().ok().flatten()
            }
        }
    }
}

fn escrever(conexao: &mut TcpStream, status: u16, json: Option<&str>) {
    let motivo = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        411 => "Length Required",
        413 => "Content Too Large",
        431 => "Request Header Fields Too Large",
        _ => "Error",
    };
    let corpo = json.unwrap_or("");
    let mut extra = String::new();
    if json.is_some() {
        extra.push_str("Content-Type: application/json\r\n");
    }
    if status == 405 {
        extra.push_str("Allow: POST\r\n");
    }
    let resposta = format!("HTTP/1.1 {status} {motivo}\r\n{extra}Content-Length: {}\r\nConnection: close\r\n\r\n{corpo}", corpo.len());
    let _ = conexao.write_all(resposta.as_bytes());
    let _ = conexao.flush();
}

/// Fecha uma conexão recusada sem jogar fora a resposta: se o cliente ainda está mandando o
/// corpo, fechar direto faria o Windows mandar um RST, e a resposta poderia nem ser lida. Lê e
/// descarta um pouco, com teto e com prazo, num buffer fixo, sem nunca olhar o tamanho declarado.
fn encerrar(mut conexao: TcpStream) {
    let _ = conexao.shutdown(Shutdown::Write);
    let _ = conexao.set_read_timeout(Some(Duration::from_millis(500)));
    let mut descarte = [0u8; 8192];
    let mut total = 0;
    while total < 1024 * 1024 {
        match conexao.read(&mut descarte) {
            Ok(0) | Err(_) => break,
            Ok(n) => total += n,
        }
    }
}

/// Compara sem parar no primeiro byte diferente: o tempo da resposta não entrega o token aos poucos.
fn iguais(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |dif, (x, y)| dif | (x ^ y)) == 0
}

/// Uma thread que entrou em pânico segurando a trava não pode derrubar a ponte inteira.
fn travar<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpStream;
    use std::time::Instant;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const PERMITIR: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}"#;

    fn ligar(espera_ms: u64) -> (Ponte, mpsc::Receiver<Aviso>) {
        let (canal, avisos) = mpsc::channel();
        let avisar: Avisar = Arc::new(move |a| {
            let _ = canal.send(a);
        });
        let ponte = Ponte::ligar(0, TOKEN, Duration::from_millis(espera_ms), avisar).unwrap_or_else(|e| panic!("{e:?}"));
        (ponte, avisos)
    }

    /// Manda uma requisição crua e devolve o status e o corpo da resposta.
    fn enviar(porta: u16, cabecalho: &str, corpo: &[u8]) -> (u16, String) {
        let mut s = TcpStream::connect(("127.0.0.1", porta)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
        s.write_all(cabecalho.as_bytes()).unwrap();
        let _ = s.write_all(corpo); // o servidor pode fechar antes de ler tudo (413)
        let mut leitor = BufReader::new(s);
        let mut linha = String::new();
        leitor.read_line(&mut linha).unwrap();
        let status = linha[9..12].parse().unwrap();
        let mut tamanho = 0;
        loop {
            linha.clear();
            leitor.read_line(&mut linha).unwrap();
            if linha == "\r\n" {
                break;
            }
            if let Some((nome, valor)) = linha.split_once(':') {
                if nome.eq_ignore_ascii_case("content-length") {
                    tamanho = valor.trim().parse().unwrap();
                }
            }
        }
        let mut resposta = vec![0; tamanho];
        leitor.read_exact(&mut resposta).unwrap();
        (status, String::from_utf8(resposta).unwrap())
    }

    fn post(porta: u16, caminho: &str, autorizacao: Option<&str>, corpo: &str) -> (u16, String) {
        let auth = autorizacao.map(|a| format!("Authorization: {a}\r\n")).unwrap_or_default();
        let cab = format!(
            "POST {caminho} HTTP/1.1\r\nHost: 127.0.0.1\r\n{auth}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            corpo.len()
        );
        enviar(porta, &cab, corpo.as_bytes())
    }

    fn bearer() -> String {
        format!("Bearer {TOKEN}")
    }

    /// Manda um pedido numa thread (ele fica esperando) e devolve o id que a página recebeu.
    fn abrir_pedido(ponte: &Ponte, avisos: &mpsc::Receiver<Aviso>) -> (u64, thread::JoinHandle<(u16, String)>) {
        let porta = ponte.porta();
        let fio = thread::spawn(move || post(porta, "/fontes/teste/pedido", Some(&bearer()), r#"{"oi":1}"#));
        match avisos.recv_timeout(Duration::from_secs(5)).unwrap() {
            Aviso::Pedido { id, fonte, corpo } => {
                assert_eq!(fonte, "teste");
                assert_eq!(corpo, serde_json::json!({ "oi": 1 }));
                (id, fio)
            }
            outro => panic!("esperava um pedido, veio {outro:?}"),
        }
    }

    #[test]
    fn sem_token_ou_token_errado_da_401_e_nada_aparece() {
        let (ponte, avisos) = ligar(1000);
        let p = ponte.porta();
        let errado = format!("Bearer {}", TOKEN.replace('0', "1"));
        for auth in [None, Some("Bearer "), Some(errado.as_str()), Some(TOKEN), Some("Basic abc")] {
            assert_eq!(post(p, "/fontes/teste/evento", auth, "{}").0, 401, "{auth:?}");
            assert_eq!(post(p, "/fontes/teste/pedido", auth, "{}").0, 401, "{auth:?}");
        }
        assert!(avisos.recv_timeout(Duration::from_millis(200)).is_err());
    }

    #[test]
    fn evento_responde_vazio_em_menos_de_50_ms_e_avisa() {
        let (ponte, avisos) = ligar(1000);
        post(ponte.porta(), "/fontes/teste/evento", Some(&bearer()), "{}"); // aquece
        avisos.recv().unwrap();
        let inicio = Instant::now();
        let (status, corpo) = post(ponte.porta(), "/fontes/teste/evento", Some(&bearer()), r#"{"tipo":"pensando"}"#);
        let tempo = inicio.elapsed();
        assert_eq!((status, corpo.as_str()), (200, ""));
        assert!(tempo < Duration::from_millis(50), "levou {tempo:?}");
        assert_eq!(
            avisos.recv_timeout(Duration::from_secs(1)).unwrap(),
            Aviso::Evento { fonte: "teste".into(), corpo: serde_json::json!({ "tipo": "pensando" }) }
        );
    }

    #[test]
    fn pedido_devolve_exatamente_a_resposta_da_pagina() {
        let (ponte, avisos) = ligar(5000);
        let (id, fio) = abrir_pedido(&ponte, &avisos);
        ponte.responder(id, Some(PERMITIR.into())).unwrap();
        assert_eq!(fio.join().unwrap(), (200, PERMITIR.to_string()));
        // respondido uma vez, acabou
        assert!(ponte.responder(id, Some(PERMITIR.into())).is_err());
    }

    #[test]
    fn sem_decisao_da_200_vazio() {
        let (ponte, avisos) = ligar(5000);
        let (id, fio) = abrir_pedido(&ponte, &avisos);
        ponte.responder(id, None).unwrap();
        assert_eq!(fio.join().unwrap(), (200, String::new()));
    }

    // D6: nenhum caminho de tempo esgotado ou de erro devolve uma decisão
    #[test]
    fn tempo_esgotado_da_200_vazio_e_avisa_a_pagina() {
        let (ponte, avisos) = ligar(300);
        let inicio = Instant::now();
        let (id, fio) = abrir_pedido(&ponte, &avisos);
        assert_eq!(fio.join().unwrap(), (200, String::new()));
        assert!(inicio.elapsed() >= Duration::from_millis(300));
        assert_eq!(avisos.recv_timeout(Duration::from_secs(1)).unwrap(), Aviso::Expirou { id });
        // a resposta que chega tarde não vale e não vai para lugar nenhum
        assert!(ponte.responder(id, Some(PERMITIR.into())).is_err());
    }

    #[test]
    fn resposta_que_nao_e_json_e_recusada_e_o_pedido_cai_no_vazio() {
        let (ponte, avisos) = ligar(300);
        let (id, fio) = abrir_pedido(&ponte, &avisos);
        assert!(ponte.responder(id, Some("allow".into())).is_err());
        assert_eq!(fio.join().unwrap(), (200, String::new()));
    }

    #[test]
    fn pedidos_ao_mesmo_tempo_recebem_cada_um_a_sua_resposta() {
        let (ponte, avisos) = ligar(5000);
        let (id1, fio1) = abrir_pedido(&ponte, &avisos);
        let (id2, fio2) = abrir_pedido(&ponte, &avisos);
        ponte.responder(id2, Some(r#"{"n":2}"#.into())).unwrap();
        ponte.responder(id1, Some(r#"{"n":1}"#.into())).unwrap();
        assert_eq!(fio1.join().unwrap().1, r#"{"n":1}"#);
        assert_eq!(fio2.join().unwrap().1, r#"{"n":2}"#);
    }

    #[test]
    fn corpo_acima_de_10_mb_da_413() {
        let (ponte, avisos) = ligar(1000);
        let p = ponte.porta();
        // pelo Content-Length, sem nem mandar o corpo
        let cab = format!(
            "POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            bearer(),
            LIMITE_CORPO + 1
        );
        assert_eq!(enviar(p, &cab, b"").0, 413);
        // corpo em pedaços não é aceito: os hooks mandam o tamanho
        let cab = format!(
            "POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
            bearer()
        );
        assert_eq!(enviar(p, &cab, b"2\r\n{}\r\n0\r\n\r\n").0, 411);
        // exatamente no limite ainda passa
        let mut no_limite = vec![b' '; LIMITE_CORPO - 2];
        no_limite.splice(0..0, *b"{}");
        let cab = format!(
            "POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            bearer(),
            no_limite.len()
        );
        assert_eq!(enviar(p, &cab, &no_limite).0, 200);
        assert!(matches!(avisos.recv_timeout(Duration::from_secs(5)), Ok(Aviso::Evento { .. })));
        assert!(avisos.recv_timeout(Duration::from_millis(100)).is_err());
    }

    #[test]
    fn rotas_metodos_e_json_errados() {
        let (ponte, avisos) = ligar(1000);
        let p = ponte.porta();
        let b = bearer();
        for caminho in ["/", "/fontes/teste", "/fontes/teste/outra", "/fontes/teste/evento/a", "/fontes//evento", "/fontes/Teste/evento", "/fontes/a%20b/evento"] {
            assert_eq!(post(p, caminho, Some(&b), "{}").0, 404, "{caminho}");
        }
        let cab = format!("GET /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {b}\r\nConnection: close\r\n\r\n");
        assert_eq!(enviar(p, &cab, b"").0, 405);
        assert_eq!(post(p, "/fontes/teste/evento", Some(&b), "não é json").0, 400);
        assert_eq!(post(p, "/fontes/teste/pedido", Some(&b), "").0, 400);
        assert_eq!(post(p, "/fontes/teste/evento?x=1", Some(&b), "{}").0, 200);
        assert!(matches!(avisos.recv_timeout(Duration::from_secs(1)), Ok(Aviso::Evento { .. })));
        assert!(avisos.recv_timeout(Duration::from_millis(100)).is_err());
    }

    #[test]
    fn porta_ocupada_e_erro_e_a_ponte_nao_troca_de_porta() {
        let outro = TcpListener::bind("127.0.0.1:0").unwrap();
        let porta = outro.local_addr().unwrap().port();
        let erro = Ponte::ligar(porta, TOKEN, Duration::from_secs(1), Arc::new(|_| {})).err().unwrap();
        assert_eq!((erro.codigo, erro.porta), ("porta-ocupada", porta));
    }

    #[test]
    fn sem_token_a_ponte_nem_liga() {
        for token in ["curto", &format!("{TOKEN}\n"), &format!("{TOKEN} x"), &format!("{TOKEN}é")] {
            let erro = Ponte::ligar(0, token, Duration::from_secs(1), Arc::new(|_| {})).err().unwrap();
            assert_eq!(erro.codigo, "token-invalido", "{token:?}");
        }
    }

    // revisão do Codex, achado 1: o tamanho declarado nunca vira memória reservada
    #[test]
    fn tamanho_absurdo_sem_token_e_recusado_na_hora_e_a_ponte_segue_viva() {
        let (ponte, avisos) = ligar(1000);
        let p = ponte.porta();
        for tamanho in ["50000000000", "18446744073709551615"] {
            let cab = format!("POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nContent-Length: {tamanho}\r\n\r\n");
            let inicio = Instant::now();
            assert_eq!(enviar(p, &cab, b"").0, 401);
            assert!(inicio.elapsed() < Duration::from_secs(2), "{:?}", inicio.elapsed());
        }
        let cab = format!("POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {}\r\nContent-Length: 99999999999999999999\r\n\r\n", bearer());
        assert_eq!(enviar(p, &cab, b"").0, 400); // nem cabe num usize
        assert_eq!(post(p, "/fontes/teste/evento", Some(&bearer()), "{}").0, 200);
        assert!(matches!(avisos.recv_timeout(Duration::from_secs(1)), Ok(Aviso::Evento { .. })));
    }

    #[test]
    fn cabecalho_grande_demais_da_431() {
        let (ponte, _avisos) = ligar(1000);
        let cab = format!("POST /fontes/teste/evento HTTP/1.1\r\nX: {}\r\n\r\n", "a".repeat(LIMITE_CABECALHO));
        assert_eq!(enviar(ponte.porta(), &cab, b"").0, 431);
    }

    #[test]
    fn expect_100_continue_recebe_o_continue_antes_do_corpo() {
        let (ponte, avisos) = ligar(1000);
        let mut s = TcpStream::connect(("127.0.0.1", ponte.porta())).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        write!(s, "POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\nAuthorization: {}\r\nContent-Length: 2\r\nExpect: 100-continue\r\n\r\n", bearer()).unwrap();
        let mut continuar = [0u8; 25];
        s.read_exact(&mut continuar).unwrap();
        assert_eq!(&continuar, b"HTTP/1.1 100 Continue\r\n\r\n");
        s.write_all(b"{}").unwrap();
        let mut resposta = String::new();
        s.read_to_string(&mut resposta).unwrap();
        assert!(resposta.starts_with("HTTP/1.1 200 OK"), "{resposta}");
        assert!(matches!(avisos.recv_timeout(Duration::from_secs(1)), Ok(Aviso::Evento { .. })));
    }

    // revisão do Codex, achado 3: quem manda devagar não segura a ponte
    #[test]
    fn cliente_lento_leva_408_no_prazo_e_nao_trava_os_outros() {
        let (canal, avisos) = mpsc::channel();
        let avisar: Avisar = Arc::new(move |a| {
            let _ = canal.send(a);
        });
        let ponte = Ponte::ligar_com_prazo(0, TOKEN, Duration::from_secs(1), Duration::from_millis(400), avisar).unwrap();
        let p = ponte.porta();
        // um byte de cada vez, sem nunca terminar o cabeçalho
        let lento = thread::spawn(move || {
            let mut s = TcpStream::connect(("127.0.0.1", p)).unwrap();
            s.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            let inicio = Instant::now();
            for b in b"POST /fontes/teste/evento HTTP/1.1\r\nHost: x\r\n".iter().cycle().take(40) {
                if s.write_all(&[*b]).is_err() {
                    break;
                }
                thread::sleep(Duration::from_millis(50));
            }
            let mut resposta = String::new();
            let _ = s.read_to_string(&mut resposta);
            (resposta, inicio.elapsed())
        });
        thread::sleep(Duration::from_millis(100));
        assert_eq!(post(p, "/fontes/teste/evento", Some(&bearer()), "{}").0, 200);
        assert!(matches!(avisos.recv_timeout(Duration::from_secs(1)), Ok(Aviso::Evento { .. })));
        let (resposta, tempo) = lento.join().unwrap();
        assert!(resposta.starts_with("HTTP/1.1 408"), "{resposta:?}");
        assert!(tempo < Duration::from_secs(3), "{tempo:?}");
    }

    #[test]
    fn acima_do_teto_de_conexoes_a_nova_e_fechada_e_depois_volta_a_aceitar() {
        let (canal, _avisos) = mpsc::channel();
        let avisar: Avisar = Arc::new(move |a| {
            let _ = canal.send(a);
        });
        let ponte = Ponte::ligar_com_prazo(0, TOKEN, Duration::from_secs(1), Duration::from_millis(800), avisar).unwrap();
        let p = ponte.porta();
        let paradas: Vec<TcpStream> = (0..MAX_CONEXOES).map(|_| TcpStream::connect(("127.0.0.1", p)).unwrap()).collect();
        thread::sleep(Duration::from_millis(200));
        let mut excedente = TcpStream::connect(("127.0.0.1", p)).unwrap();
        excedente.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        let mut resto = Vec::new();
        let _ = excedente.read_to_end(&mut resto);
        assert!(resto.is_empty(), "a conexão acima do teto devia fechar sem resposta");
        drop(paradas);
        thread::sleep(Duration::from_millis(1200)); // as paradas levam 408 e liberam o teto
        assert_eq!(post(p, "/fontes/teste/evento", Some(&bearer()), "{}").0, 200);
    }

    #[test]
    fn acima_do_teto_de_pedidos_o_novo_volta_vazio_na_hora_sem_aparecer() {
        let (ponte, avisos) = ligar(10_000);
        let abertos: Vec<_> = (0..MAX_PEDIDOS).map(|_| abrir_pedido(&ponte, &avisos)).collect();
        let inicio = Instant::now();
        assert_eq!(post(ponte.porta(), "/fontes/teste/pedido", Some(&bearer()), "{}"), (200, String::new()));
        assert!(inicio.elapsed() < Duration::from_secs(1));
        assert!(avisos.recv_timeout(Duration::from_millis(100)).is_err());
        for (id, fio) in abertos {
            ponte.responder(id, None).unwrap();
            assert_eq!(fio.join().unwrap(), (200, String::new()));
        }
    }

    // revisão do Codex, achado 4: a página recarregou e não sabe mais dos pedidos
    #[test]
    fn encerrar_pedidos_devolve_vazio_a_todos_na_hora() {
        let (ponte, avisos) = ligar(10_000);
        let (id1, fio1) = abrir_pedido(&ponte, &avisos);
        let (_id2, fio2) = abrir_pedido(&ponte, &avisos);
        let inicio = Instant::now();
        ponte.encerrar_pedidos();
        assert_eq!(fio1.join().unwrap(), (200, String::new()));
        assert_eq!(fio2.join().unwrap(), (200, String::new()));
        assert!(inicio.elapsed() < Duration::from_secs(1));
        assert!(ponte.responder(id1, Some(PERMITIR.into())).is_err());
    }

    // D2: o Rust não sabe de onde vêm os eventos
    #[test]
    fn o_rust_nao_fala_o_nome_de_nenhuma_fonte() {
        let palavra = ["cla", "ude"].concat();
        let pasta = concat!(env!("CARGO_MANIFEST_DIR"), "/src");
        for arquivo in std::fs::read_dir(pasta).unwrap() {
            let caminho = arquivo.unwrap().path();
            let codigo = std::fs::read_to_string(&caminho).unwrap().to_lowercase();
            assert!(!codigo.contains(&palavra), "{caminho:?} fala em {palavra}");
        }
    }
}
