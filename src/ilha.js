// A ilha: pílula recolhida ↔ ilha expandida, o gato, o ícone na bandeja e o que as fontes
// contam. Tudo em JS pela API do Tauri; do Rust vêm o recorte da janela e a ponte (D2).
'use strict';

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow, primaryMonitor, currentMonitor } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;
const { LogicalSize, PhysicalPosition } = window.__TAURI__.dpi;
const { TrayIcon } = window.__TAURI__.tray;
const { Menu, Submenu, MenuItem, PredefinedMenuItem } = window.__TAURI__.menu;
const { defaultWindowIcon } = window.__TAURI__.app;

const TAMANHO = { recolhida: [140, 34], expandida: [420, 110] };
const MARGEM_TOPO = 8;          // px lógicos entre a ilha e o topo da tela
const ESPERA_RECOLHER = 1000;   // ms depois de o mouse sair

const janela = getCurrentWindow();
const el = document.getElementById('ilha');
const $ = id => document.getElementById(id);

// ---------- janela na forma da ilha (D11) ----------
// A janela fica sempre do tamanho da ilha expandida, centralizada no topo, e o Rust a recorta
// na forma da ilha: fora do recorte o clique cai no app de trás. Mover e redimensionar a
// janela a cada hover fazia a pílula pular de lado e o WebView mostrar um quadro velho.
const RAIO = { recolhida: 17, expandida: 28 };
let esc = 1; // escala da janela (DPI), lida depois de posicioná-la

async function posicionarJanela() {
  const monitor = (await primaryMonitor()) ?? (await currentMonitor());
  const m = monitor.scaleFactor;
  const [largura, altura] = TAMANHO.expandida;
  const x = monitor.position.x + Math.round((monitor.size.width - largura * m) / 2);
  const y = monitor.position.y + Math.round(MARGEM_TOPO * m);
  await janela.setSize(new LogicalSize(largura, altura));
  await janela.setPosition(new PhysicalPosition(x, y));
  esc = await janela.scaleFactor();
  // onde fica a pílula na tela, em pixels físicos (o evento `cursor` vem assim), para a patadinha
  const [lp, ap] = TAMANHO.recolhida;
  const left = x + ((largura - lp) / 2) * esc;
  telaPilula = { janelaX: x, janelaY: y, left, top: y, right: left + lp * esc, bottom: y + ap * esc, centroGato: left + 22 * esc };
  vigiaPatada = criarVigiaDePatada({ distancia: 60 * esc, velocidade: 900 * esc });
}

// ---------- o cursor perto da pílula (D10 da 002) ----------
// Recolhida, a janela recortada não recebe `pointermove` de fora. O Rust lê o cursor a 15 qps e só
// avisa (evento `cursor`) quando ele está perto da pílula: para o gato olhar o cursor que passa
// perto e dar a patadinha no que passa rápido. Ler pelo JS (`cursorPosition()` a cada quadro) custava
// 7,5 pontos de CPU e trazia a serra de memória de volta. Ler não captura nada nem rouba clique.
const PERTO_PARA_OLHAR = 240; // px lógicos em volta da pílula
let telaPilula = null;
let vigiaPatada = null;

listen('cursor', ({ payload }) => {
  if (expandida || !telaPilula) return;
  if (!payload) { // saiu de perto
    mascote.ponteiro.ativo = false;
    vigiaPatada.esquecer();
    return;
  }
  const [x, y] = payload, p = telaPilula;
  mascote.ponteiro.ativo = true;
  mascote.ponteiro.x = (x - p.janelaX) / esc;
  mascote.ponteiro.y = (y - p.janelaY) / esc;
  const lado = vigiaPatada(x, y, p, performance.now() / 1000);
  if (lado) gatoPilula.patada(lado);
}).catch(err => console.error('[xereta] cursor', err?.name ?? 'erro'));

// Recolhida, o Rust vigia o cursor em volta da pílula; aberta, não (a ilha vê o mouse sozinha).
function recortar(forma) {
  const [largura, altura] = TAMANHO[forma];
  const x = (TAMANHO.expandida[0] - largura) / 2; // a ilha é centrada na janela (ilha.css)
  const px = v => Math.round(v * esc);
  const perto = forma === 'recolhida' ? px(PERTO_PARA_OLHAR) : null;
  return invoke('recortar', { x: px(x), y: 0, largura: px(largura), altura: px(altura), raio: px(RAIO[forma]), perto });
}

// ---------- o gato ----------
// Um momento (carinho, tonto, saudação) troca o texto da pílula e a fala enquanto dura; no fim,
// voltam os do status, que `escrever` guarda em `textos` (um evento no meio já atualiza os dois).
const textos = { pilula: '', fala: '' };
function aoMomento(nome) {
  const t = nome && TEXTOS.momentos[nome];
  $('texto-pilula').textContent = t?.pilula ?? textoDaPilula();
  $('fala').textContent = t?.fala ?? textos.fala;
}
const gatoPilula = new Gato($('gato-pilula'), { pequeno: true, raio: 12, cx: 22, cy: 19, aoMomento });
const gatoIlha = new Gato($('gato-ilha'), { raio: 27, cx: 52, cy: 60, aoMomento });
gatoPilula.ativo = true;
gatoIlha.ativo = false;

// ---------- o cochilo (§4 da 002) ----------
// Sem evento nenhum por 10 minutos, o gato cochila; o próximo evento o acorda (com o susto, que o
// gato.js faz sozinho ao sair do cochilo). Com um pedido ou um cartão do fim esperando, ele não
// dorme: o selo ✓ na pílula é justamente o que quem volta do café quer ver.
const COCHILO_DEPOIS = 10 * 60 * 1000;
let dormindo = false;
let timerCochilo = null;
function agendarCochilo() {
  clearTimeout(timerCochilo);
  timerCochilo = setTimeout(cochilar, COCHILO_DEPOIS);
}
function cochilar() {
  // o cartão do fim pode estar fora da tela (outra sessão escolhida por clique): conta também,
  // senão o gato dormiria por cima dele quando ele voltasse (Codex, 09/10)
  if (Ponte.abertos.length || cartaoDoFim() || sessoes?.algumFim()) return; // o OK ou o próximo evento agendam de novo
  dormindo = true;
  definirEstado('cochilo');
  $('texto-pilula').textContent = textoDaPilula();
}
function acordar() {
  dormindo = false;
  agendarCochilo();
}
const textoDaPilula = () => (dormindo ? TEXTOS.estados.cochilo.pilula : textos.pilula);

function definirEstado(e) {
  const estado = dormindo ? 'cochilo' : e;
  gatoPilula.mudarEstado(estado);
  gatoIlha.mudarEstado(estado);
  const t = TEXTOS.estados[e];
  textos.pilula = t.pilula;
  textos.fala = t.fala;
  $('texto-pilula').textContent = textoDaPilula();
  $('fala').textContent = t.fala;
}

// `cartao`: null (fala e dica), 'contando' (os passos da sessão) ou 'terminou' (a mensagem final)
function escrever({ titulo = TEXTOS.app, subtitulo = '', pilula, fala, dica = '', contagem = '', cartao = null }) {
  $('titulo').textContent = titulo;
  $('subtitulo').textContent = subtitulo;
  $('contagem').textContent = contagem;
  if (pilula !== undefined) { textos.pilula = pilula; $('texto-pilula').textContent = textoDaPilula(); }
  if (fala !== undefined) { textos.fala = fala; $('fala').textContent = fala; }
  $('dica').textContent = dica;
  el.classList.toggle('contando', cartao === 'contando');
  el.classList.toggle('terminou', cartao === 'terminou');
}

// a ilha sem nada para contar: o subtítulo vira "ouvindo na porta …" quando a ponte liga
let ociosa = { subtitulo: TEXTOS.ilha.modoTeste, dica: TEXTOS.ilha.dicaTeste };
function mostrarOciosa() {
  definirEstado('parado');
  escrever(ociosa);
}
escrever(ociosa);

// ---------- o que as fontes contam (E2) ----------
// Tipo do formato comum (§4) → cara do gato, só para quando o sessao.js não carregou; com ele, quem
// decide é o `estadoDoGato` (procurando, maratona, cansado, a reação pequena da D9).
const ESTADO_DO_TIPO = {
  inicio: 'oi', pensando: 'pensando', ferramenta: 'trabalhando', concluiu: 'trabalhando', permissao: 'esperando',
  erro: 'erro', fim: 'feliz', saida: 'parado', noTerminal: 'esperando', respondido: 'trabalhando',
  negado: 'negou', encerrado: 'parado', pergunta: 'pergunta',
};
// F2: o último status de cada sessão (o último evento que não é pedido, ou o que ficou no lugar de
// um pedido), para mostrar qualquer uma quando os pedidos acabam. A chave é a mesma do sessao.js.
const chaveDe = evento => `${evento.fonte}\u0000${evento.sessao ?? ''}`;
const statusDe = new Map();
let ponteLigada = false;
let escolhida = null; // a sessão trocada por clique em "2 sessões"; vale até a ilha recolher

// a sessão na tela e o status dela; sem o sessao.js, o status mais recente (como na F1)
function statusNaTela() {
  if (sessoes) return statusDe.get(sessoes.naTela(escolhida)) ?? null;
  let recente = null;
  for (const s of statusDe.values()) if (!recente || s.chegou > recente.chegou) recente = s;
  return recente;
}

// quantas sessões a ilha conta (as vivas que têm o que mostrar)
const sessoesNaConta = () => (sessoes ? sessoes.vivas().filter(k => statusDe.has(k)) : [...statusDe.keys()]);

// Como um pedido sai da tela vira o status que fica no lugar dele, até o próximo evento da sessão.
const DEPOIS_DO_PEDIDO = {
  // sem decisão da ilha: a sessão está parada, esperando você no terminal
  noTerminal: e => ({ tipo: 'noTerminal', resumo: TEXTOS.eventos.noTerminal(e.resumo) }),
  // a sessão andou depois do pedido: você respondeu no terminal
  respondido: e => ({ tipo: 'respondido', resumo: TEXTOS.eventos.respondido(e.resumo) }),
  // a fonte fechou a conexão (Esc, ou o Claude Code saiu): não dá para dizer o que aconteceu
  encerrado: e => ({ tipo: 'encerrado', resumo: TEXTOS.eventos.encerrado(e.resumo) }),
  negado: e => ({ tipo: 'negado', resumo: TEXTOS.eventos.negado(e.pedido?.alvo ?? e.resumo) }),
  // permitido: a ferramenta vai rodar, e o resumo dela ("Rodando npm test") volta a valer
  permitido: e => ({ tipo: 'ferramenta', resumo: e.resumo }),
};

// O pedido que está na tela, e desde quando. Um clique só vale para o pedido que estava na tela
// quando o botão foi APERTADO, e só se ele já estava visível havia um instante: apertar no pedido A
// e soltar depois de o B tomar o lugar não aprova o B, e o segundo clique de um clique duplo
// (o Windows aceita até 500 ms entre os dois) também não.
const ESPERA_DECIDIR = 600; // ms
const naTela = { id: null, desde: 0 };
let gesto = null; // { id, valido } do botão apertado

function decidir(id, decisao) {
  // "No terminal" traz a janela do terminal para a frente antes de soltar o pedido, enquanto o
  // Rust ainda sabe de quem ele é. Não achar a janela não impede nada.
  const antes = decisao === 'terminal' ? invoke('trazer_janela_do_pedido', { id }).catch(() => false) : Promise.resolve();
  antes.then(() => Ponte.responder(id, decisao)).catch(err => console.error('[xereta]', err));
}

// ---------- a sessão contada (002, F1) ----------
// As sessões vêm de sessao.js (módulo ES), carregado no início, antes de a ponte ligar.
let Sessao = null;
let sessoes = null;

const MARCA = { atual: '›', ok: '✓', erro: '✗', negado: '✗' };
const COR_DA_MARCA = { ok: 'ok', erro: 'erro', negado: 'erro' };
// statuses que contam o que aconteceu com o último passo (o do pedido): tomam o lugar dele
const SOBRE_O_PEDIDO = new Set(['noTerminal', 'respondido', 'encerrado', 'negado', 'pergunta']);

// As duas linhas do cartão: o passo anterior e o atual. Um status que não é passo ("Pensando…",
// "No terminal: …") entra como a linha atual.
function linhasDoCartao(sessao, status) {
  const anterior = sessao.passos.at(-2), ultimo = sessao.passos.at(-1);
  const ehPasso = status.tipo === 'ferramenta' || status.tipo === 'concluiu' || (status.tipo === 'erro' && status.ferramenta);
  if (ehPasso) return [anterior, ultimo];
  const linha = { estado: status.tipo === 'negado' ? 'negado' : 'atual', resumo: status.resumo, conta: null };
  return SOBRE_O_PEDIDO.has(status.tipo) ? [anterior, linha] : [ultimo, linha];
}

function escreverPasso(no, passo) {
  no.hidden = !passo;
  if (!passo) return;
  const marca = no.querySelector('.marca');
  marca.textContent = MARCA[passo.estado] ?? MARCA.atual;
  marca.className = `marca ${COR_DA_MARCA[passo.estado] ?? ''}`;
  no.querySelector('.texto').textContent = passo.resumo;
  const conta = no.querySelector('.conta');
  conta.hidden = !passo.conta;
  if (passo.conta) {
    conta.querySelector('.mais').textContent = TEXTOS.cartao.mais(passo.conta.mais);
    conta.querySelector('.menos').textContent = TEXTOS.cartao.menos(passo.conta.menos);
  }
}

function mostrarEvento(evento) {
  const sessao = sessoes?.obter(evento);
  if (sessao?.fim) return mostrarFim(evento, sessao);
  definirEstado(Sessao ? Sessao.estadoDoGato(evento, sessao) : (ESTADO_DO_TIPO[evento.tipo] ?? 'parado'));
  escrever({
    titulo: evento.projeto ?? TEXTOS.app,
    subtitulo: TEXTOS.fontes[evento.fonte] ?? evento.fonte,
    pilula: evento.resumo,
    fala: evento.resumo,
    contagem: sessao?.total ? TEXTOS.cartao.passos(sessao.total) : '',
    cartao: sessao ? 'contando' : null,
  });
  if (sessao) {
    const [anterior, atual] = linhasDoCartao(sessao, evento);
    escreverPasso($('passo-anterior'), anterior);
    escreverPasso($('passo-atual'), atual);
  }
}

// D4, D4b: "vitrine terminou · 9 passos · 2 arquivos (+12 −4)", a mensagem final e o OK
function mostrarFim(evento, sessao) {
  const { falhou, limite, mensagem } = sessao.fim;
  definirEstado(Sessao.estadoDoGato(evento, sessao));
  const projeto = evento.projeto ?? sessao.projeto ?? TEXTOS.app;
  const soma = Sessao.somaDosArquivos(sessao);
  escrever({
    titulo: (limite ? TEXTOS.cartao.noLimite : falhou ? TEXTOS.cartao.parou : TEXTOS.cartao.terminou)(projeto),
    subtitulo: [sessao.total ? TEXTOS.cartao.passos(sessao.total) : '', soma.arquivos ? TEXTOS.cartao.arquivos(soma) : '']
      .filter(Boolean).join(' · '),
    pilula: evento.resumo,
    cartao: 'terminou',
  });
  $('mensagem').textContent = mensagem ?? (limite ? TEXTOS.eventos.limite : falhou ? TEXTOS.eventos.parou : TEXTOS.cartao.semMensagem);
}

// O OK: o cartão do fim sai, e a ilha mostra outra sessão ou volta a ficar quieta. Como nos botões
// do pedido, o clique vale para o cartão que estava na tela quando o botão foi APERTADO: se o fim de
// outra sessão tomar o lugar antes de soltar, o OK não o dispensa sem ele ter sido visto.
let gestoOk = null;
$('bt-ok').textContent = TEXTOS.cartao.ok;
$('bt-ok').addEventListener('pointerdown', () => { gestoOk = statusNaTela(); });
$('bt-ok').addEventListener('click', ev => {
  ev.stopPropagation(); // o clique não chega ao gato
  const status = statusNaTela();
  const apertado = gestoOk;
  gestoOk = null;
  if (!status || status !== apertado) return;
  if (sessoes) sessoes.dispensar(status);
  else statusDe.delete(chaveDe(status));
  escolhida = null;
  mostrar();
  agendarCochilo(); // o cartão do fim segurava o cochilo; a conta recomeça do OK
  if (!mouseDentro) agendarRecolher();
});

// "2 sessões": um clique mostra a seguinte (D6). A escolha vale até a ilha recolher.
$('bt-sessoes').addEventListener('click', ev => {
  ev.stopPropagation();
  if (!sessoes) return;
  escolhida = sessoes.seguinte(sessoes.naTela(escolhida));
  mostrar();
});

// O "2" da pílula e o "2 sessões" da ilha aberta. A conta muda sozinha quando uma sessão passa de
// 1 hora sem eventos: a ilha se redesenha nessa hora, sem esperar um evento novo.
let timerConta = null;
function mostrarConta() {
  clearTimeout(timerConta);
  const ms = sessoes?.proximaExpiracao();
  if (ms != null) timerConta = setTimeout(mostrar, ms + 1000);
  const n = sessoesNaConta().length;
  $('sessoes-pilula').hidden = n < 2;
  $('sessoes-pilula').textContent = n;
  $('bt-sessoes').hidden = n < 2;
  $('bt-sessoes').textContent = TEXTOS.cartao.sessoes(n);
}

// o pedido na tela: "vitrine · quer rodar · Claude Code", o alvo e os botões
function mostrarPedido(evento, mais) {
  definirEstado('esperando');
  const { verbo, alvo } = evento.pedido ?? { verbo: '', alvo: evento.resumo };
  const fonte = TEXTOS.fontes[evento.fonte] ?? evento.fonte;
  escrever({
    titulo: evento.projeto ?? TEXTOS.app,
    subtitulo: [TEXTOS.ilha.quer(verbo), fonte, mais ? TEXTOS.ilha.maisPedidos(mais) : ''].filter(Boolean).join(' · '),
    pilula: evento.resumo,
  });
  $('alvo').textContent = alvo;
  $('alvo').title = alvo;
}

// O pedido aberto mais antigo manda na ilha, seja de que sessão for; sem pedidos, vale o status da
// sessão na tela (F2).
function mostrar() {
  const abertos = Ponte.abertos;
  const primeiro = abertos[0]?.id ?? null;
  if (primeiro !== naTela.id) {
    naTela.id = primeiro;
    naTela.desde = performance.now();
    gesto = null; // um botão apertado no pedido anterior não vale para este
  }
  mostrarConta();
  el.classList.toggle('pedindo', abertos.length > 0);
  if (abertos.length) return mostrarPedido(abertos[0].evento, abertos.length - 1);
  const status = statusNaTela();
  if (status) mostrarEvento(status);
  else mostrarOciosa(); // título, subtítulo e alvo do pedido que acabou não podem ficar para trás
}

function aoMudarPonte({ evento, saiu }) {
  acordar(); // qualquer novidade da ponte acorda o gato e recomeça a conta do cochilo
  if (evento) {
    sessoes?.receber(evento);
    const chave = chaveDe(evento);
    if (evento.tipo === 'saida') {
      // F2: o SessionEnd tira a sessão da conta e da tela
      statusDe.delete(chave);
      if (escolhida === chave) escolhida = null;
    } else if (evento.tipo !== 'permissao') {
      statusDe.set(chave, evento);
    }
  }
  // O status que fica no lugar do pedido que saiu. Se a sessão dele já andou depois do pedido (até
  // terminou), o aviso chegou atrasado e não vale mais.
  if (saiu) {
    // o ✗ no passo negado vale sempre; só o status mostrado é que pode ter chegado atrasado
    if (saiu.como === 'negado') sessoes?.negado(saiu.evento);
    const chave = chaveDe(saiu.evento);
    const sessaoAndou = statusDe.get(chave)?.chegou > saiu.evento.chegou;
    if (!sessaoAndou && (statusDe.has(chave) || !sessoes || sessoes.obter(saiu.evento))) {
      statusDe.set(chave, { ...saiu.evento, ...DEPOIS_DO_PEDIDO[saiu.como](saiu.evento) });
    }
  }
  // até 2× as sessões guardadas no sessao.js: o resto é de sessões que já saíram de lá
  if (statusDe.size > 40) {
    const maisAntigo = [...statusDe.entries()].sort((a, b) => a[1].chegou - b[1].chegou)[0][0];
    statusDe.delete(maisAntigo);
  }

  mostrar();
  // um pedido ou o cartão do fim (D4b) abrem a ilha e a deixam aberta até a resposta ou o OK
  if (Ponte.abertos.length || cartaoDoFim()) abrirSozinha();
  else if (!mouseDentro) agendarRecolher(); // a ilha só ficou aberta por causa do pedido ou do fim
}

// os botões do pedido; o clique não chega ao gato (que seria cutucado)
for (const bt of document.querySelectorAll('.acoes button')) {
  bt.textContent = TEXTOS.ilha[{ permitir: 'permitir', negar: 'negar', terminal: 'noTerminal' }[bt.dataset.decisao]];
  bt.addEventListener('pointerdown', () => {
    gesto = { id: naTela.id, valido: naTela.id !== null && performance.now() - naTela.desde >= ESPERA_DECIDIR };
  });
  bt.addEventListener('click', ev => {
    ev.stopPropagation();
    const g = gesto;
    gesto = null;
    if (g?.valido && g.id === naTela.id) decidir(g.id, bt.dataset.decisao);
  });
}

function mostrarErroPonte(erro) {
  const texto = (TEXTOS.errosPonte[erro?.codigo] ?? TEXTOS.errosPonte.falha)(erro?.porta);
  definirEstado('erro');
  escrever({ subtitulo: '', ...texto });
}

el.addEventListener('pointermove', ev => {
  mascote.ponteiro.x = ev.clientX;
  mascote.ponteiro.y = ev.clientY;
  mascote.ponteiro.ativo = true;
});
el.addEventListener('pointerleave', () => { mascote.ponteiro.ativo = false; });
// Clicar no gato: três cliques em 2 s são carinho, seis são o tonto. O momento vale para os dois
// gatos (o escondido o herda ao aparecer). Clicar não rouba o foco: a janela não pega foco (D13).
el.addEventListener('click', () => {
  const [visivel, outro] = expandida ? [gatoIlha, gatoPilula] : [gatoPilula, gatoIlha];
  if (visivel.cutucar()) outro.herdarMomento(visivel);
});

// ---------- expandir e recolher ----------
// Expandir: o recorte cresce primeiro (o que aparece é transparente), depois o CSS anima a ilha.
// Recolher: o CSS anima, e só no fim o recorte volta para a pílula.
let pronta = false; // só reage ao mouse depois do primeiro posicionamento e recorte
let expandida = false;
let timerRecolher = null;
let timerFim = null;

// o fim da transição do CSS, com uma folga; com "reduzir movimento" ela dura 1 ms, e o recorte
// grande não pode ficar pegando clique depois de a ilha já ter encolhido
function duracaoAnimacao() {
  return parseFloat(getComputedStyle(el).getPropertyValue('--duracao')) + 20;
}

// Quem chama durante uma expansão em andamento espera a mesma: a saudação só começa depois do
// `herdarMomento` dela, que senão a apagava (mouse entrando enquanto o recorte crescia; Codex, 09/10).
let expandindo = null;
function expandir() {
  clearTimeout(timerRecolher);
  // a expansão em andamento pode ter sido cancelada (o mouse saiu e voltou): aí abre de novo depois
  if (expandindo) return expandindo.then(() => (expandida ? undefined : expandir()));
  if (!pronta || expandida) return Promise.resolve();
  expandindo = abrirIlha().finally(() => { expandindo = null; });
  return expandindo;
}

async function abrirIlha() {
  expandida = true;
  clearTimeout(timerFim);
  try {
    await recortar('expandida');
  } catch (err) {
    expandida = false; // sem recorte grande a ilha aberta sairia cortada: fica recolhida
    console.error('[xereta]', err);
    return;
  }
  if (!expandida) return; // o mouse já saiu enquanto o recorte crescia
  gatoIlha.herdarMomento(gatoPilula);
  gatoIlha.ativo = true;
  el.classList.add('expandida');
  timerFim = setTimeout(() => { if (expandida) gatoPilula.ativo = false; }, duracaoAnimacao());
}

// o cartão do fim está na tela (D4b)
const cartaoDoFim = () => el.classList.contains('terminou');

function recolher() {
  // com um pedido na tela a ilha não recolhe: os botões sumiriam (P1, emenda da E4); com o cartão
  // do fim, também não: ele fica até o OK (D4b)
  if (!expandida || Ponte.abertos.length) return;
  // a sessão escolhida por clique só vale enquanto a ilha está aberta (F2); voltar à automática
  // pode trazer um cartão do fim de outra sessão, e aí a ilha fica aberta
  if (escolhida) { escolhida = null; mostrar(); }
  if (cartaoDoFim()) return;
  expandida = false;
  gatoPilula.herdarMomento(gatoIlha);
  gatoPilula.ativo = true;
  vigiaPatada?.esquecer(); // a última posição lida é de antes de abrir
  el.classList.remove('expandida');
  clearTimeout(timerFim);
  timerFim = setTimeout(() => {
    if (expandida) return;
    gatoIlha.ativo = false;
    recortar('recolhida').catch(err => console.error('[xereta]', err));
  }, duracaoAnimacao());
}

let mouseDentro = false;
let fimDaSaudacao = 0; // performance.now() até quando a saudação segura a ilha aberta
function agendarRecolher() {
  clearTimeout(timerRecolher);
  // um evento no meio da saudação (o prompt que já vinha) não a corta antes dos 2 s (Codex, 09/10)
  const espera = Math.max(ESPERA_RECOLHER, fimDaSaudacao - performance.now());
  timerRecolher = setTimeout(recolher, espera);
}
// um pedido ou o cartão do fim abrem a ilha sozinhos, sem o mouse (e sem roubar o foco: a janela
// não pega foco, D13)
function abrirSozinha() {
  if (!pausada) expandir();
}

// A saudação, uma vez por abertura do app: a ilha abre sozinha enquanto o gato espia de baixo e
// acena, e recolhe quando ela acaba. Na pílula o aceno não cabe (o canvas acaba na bochecha), e a
// espiada sozinha passava despercebida. É o gato da ilha que saúda do começo: o `herdarMomento`
// copiaria o momento, mas não a subida de baixo. Mouse em cima, pedido ou cartão do fim seguram a
// ilha aberta, como sempre.
const SAUDACAO_ABERTA = 2000; // ms; a saudação dura 1,9 s (gato.js)
async function saudar() {
  await expandir();
  if (!expandida) return;
  gatoIlha.reagir('saudacao');
  fimDaSaudacao = performance.now() + SAUDACAO_ABERTA;
  if (!mouseDentro) agendarRecolher();
}

el.addEventListener('mouseenter', () => {
  mouseDentro = true;
  if (!expandida && ponteLigada) mostrar(); // abre com a conta e a sessão de agora (sem apagar um erro da ponte)
  expandir();
});
el.addEventListener('mouseleave', () => { mouseDentro = false; agendarRecolher(); });

// ---------- bandeja ----------
let pausada = false;

async function criarBandeja() {
  // no dev, recarregar a página não pode deixar dois ícones
  const antiga = await TrayIcon.getById('xereta');
  if (antiga) await antiga.close();

  const item = e => MenuItem.new({ id: `estado:${e}`, text: TEXTOS.estados[e].rotulo, action: () => definirEstado(e) });
  const chaves = Object.keys(ESTADOS);
  const principais = await Promise.all(chaves.filter(e => !ESTADOS[e].extra).map(item));
  const extras = await Promise.all(chaves.filter(e => ESTADOS[e].extra).map(item));

  const estadoTeste = await Submenu.new({
    text: TEXTOS.bandeja.estadoTeste,
    items: [
      ...principais,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await Submenu.new({ text: TEXTOS.bandeja.carasExtras, items: extras }),
    ],
  });

  // Os pedidos se respondem só pelos botões da ilha (E4). A bandeja respondia até a E4, mas um
  // menu aberto pode mostrar um pedido que já trocou, e o clique iria para o pedido errado.

  const pausar = await MenuItem.new({
    id: 'pausar',
    text: TEXTOS.bandeja.pausar,
    action: async () => {
      pausada = !pausada;
      if (pausada) await janela.hide();
      else await janela.show();
      if (!pausada && (Ponte.abertos.length || cartaoDoFim())) abrirSozinha(); // chegou durante a pausa
      await pausar.setText(pausada ? TEXTOS.bandeja.mostrar : TEXTOS.bandeja.pausar);
    },
  });
  const sair = await MenuItem.new({ id: 'sair', text: TEXTOS.bandeja.sair, action: () => janela.destroy() });

  const menu = await Menu.new({
    items: [estadoTeste, await PredefinedMenuItem.new({ item: 'Separator' }), pausar, sair],
  });
  await TrayIcon.new({
    id: 'xereta',
    icon: await defaultWindowIcon(),
    tooltip: TEXTOS.bandeja.dica,
    menu,
    showMenuOnLeftClick: true,
  });
}

// ---------- laço de desenho ----------
// Recolhida, a ilha desenha a 15 quadros por segundo: ela fica aberta o dia todo. A 30 qps, o
// WebView2 guardava a memória de cada desenho do canvas e só a devolvia de tempos em tempos
// (serra de ~80 a ~220 MB); a 15 qps ela fica plana. Expandida, vai no ritmo da tela, até 60
// qps: num monitor de 144 Hz, desenhar a cada quadro seria mais que o dobro do necessário.
const QPS_RECOLHIDA = 15;
const QPS_EXPANDIDA = 60;

// A memória nativa do desenho só volta numa coleta completa do V8, que ele agenda pelo heap do JS
// (~2 MB aqui) e sem enxergar essa memória: conforme o humor do coletor, ela subia em serra até
// ~210 MB (F3 da 002; uma coleta pedida pela depuração a derrubava na hora). Uma coleta a cada 20 s
// custa poucos milissegundos. O `gc` só existe com `--expose-gc` (tauri.conf.json); sem ele, nada.
const COLETA_A_CADA = 20_000;
if (typeof globalThis.gc === 'function') setInterval(() => globalThis.gc(), COLETA_A_CADA);

let ultimo = performance.now();
let acumulado = 0;
function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(.05, (agora - ultimo) / 1000);
  ultimo = agora;
  if (pausada) return;
  acumulado += dt;
  if (acumulado < 1 / ((expandida ? QPS_EXPANDIDA : QPS_RECOLHIDA) + .5)) return;
  for (const g of [gatoPilula, gatoIlha]) {
    if (!g.ativo) continue;
    g.atualizar(acumulado);
    g.desenhar();
  }
  acumulado = 0;
}

// ---------- escala do Windows mudou com o app aberto ----------
// Posição, recorte e canvas dependem da escala: refaz os três.
janela.onScaleChanged(async () => {
  await posicionarJanela();
  await recortar(expandida ? 'expandida' : 'recolhida');
  for (const g of [gatoPilula, gatoIlha]) { g.redimensionar(); g.desenhar(); }
}).catch(err => console.error('[xereta]', err));

// ---------- início ----------
(async () => {
  definirEstado('parado');
  await posicionarJanela();
  await recortar('recolhida');
  pronta = true;
  agendarCochilo();
  // desenha a pílula já, sem esperar o laço: dois quadros a 144 Hz não bastam para o
  // primeiro desenho dele, que vai a 15 qps
  gatoPilula.atualizar(0);
  gatoPilula.desenhar();
  requestAnimationFrame(quadro);
  // só mostra depois do primeiro quadro desenhado, para não piscar fundo branco (V4)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    janela.show().then(saudar).catch(err => console.error('[xereta]', err));
  }));
  await criarBandeja();
  // por último: a ponte só liga quando a ilha já sabe mostrar o que chega
  try {
    Sessao = await import('./sessao.js');
    sessoes = Sessao.criarSessoes();
  } catch (err) {
    // sem o módulo a ilha mostra só o status de agora, como na 001
    console.error('[xereta] sessao.js', err?.name);
  }
  try {
    const porta = await Ponte.ligar(aoMudarPonte);
    ponteLigada = true;
    ociosa = { ...ociosa, subtitulo: TEXTOS.ilha.ouvindo(porta) };
    $('subtitulo').textContent = ociosa.subtitulo;
  } catch (err) {
    console.error('[xereta] ponte', err?.codigo, err?.detalhe ?? err);
    mostrarErroPonte(err);
  }
})().catch(err => console.error('[xereta]', err));
