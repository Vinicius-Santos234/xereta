// Núcleo fino (D2): abre a janela, dá a ela uma forma e liga a ponte HTTP. Regra de negócio
// fica no JS.

mod config;
mod ponte;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{Emitter, Manager};

use ponte::{ErroPonte, Ponte};

/// A ponte, depois de ligada. Quem liga é a página, quando já está ouvindo os avisos: assim
/// nenhum evento chega antes de ter quem o mostre.
#[derive(Default)]
struct PonteLigada(Mutex<Option<Ponte>>);

/// Liga a ponte e devolve a porta. Chamar de novo quer dizer que a página recarregou e perdeu a
/// lista do que mostrava: os pedidos abertos voltam vazios e caem no terminal na hora, em vez de
/// esperar 45 s escondidos.
#[tauri::command]
fn ligar_ponte(app: tauri::AppHandle, estado: tauri::State<PonteLigada>) -> Result<u16, ErroPonte> {
    let mut ligada = estado.0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(ponte) = ligada.as_ref() {
        ponte.encerrar_pedidos();
        return Ok(ponte.porta());
    }
    let pasta = app.path().app_config_dir().map_err(|e| ErroPonte { codigo: "falha", porta: 0, detalhe: e.to_string() })?;
    let config = config::carregar(&pasta)?;
    let avisar = Arc::new(move |aviso| {
        let _ = app.emit("ponte", aviso);
    });
    let ponte = Ponte::ligar(config.porta, &config.token, Duration::from_secs(config.espera_pedido_segundos), avisar)?;
    let porta = ponte.porta();
    *ligada = Some(ponte);
    Ok(porta)
}

/// A decisão da página para o pedido `id`, já no formato da fonte. `None` = sem decisão.
#[tauri::command]
fn responder_pedido(estado: tauri::State<PonteLigada>, id: u64, corpo: Option<String>) -> Result<(), String> {
    let ligada = estado.0.lock().unwrap_or_else(|e| e.into_inner());
    ligada.as_ref().ok_or("a ponte não está ligada")?.responder(id, corpo)
}

/// Recorta a janela num retângulo arredondado (px físicos, relativos à janela).
/// Fora do recorte a janela não desenha nem recebe clique: o clique cai no app de trás (D11).
/// A janela fica sempre do tamanho da ilha expandida; só a forma muda, então o WebView
/// nunca é redimensionado e a animação não engasga.
#[tauri::command]
fn recortar(
    janela: tauri::WebviewWindow,
    x: i32,
    y: i32,
    largura: i32,
    altura: i32,
    raio: i32,
) -> Result<(), String> {
    if largura <= 0 || altura <= 0 || raio < 0 || largura > 16_384 || altura > 16_384 {
        return Err(format!("recorte inválido: {largura}×{altura}, raio {raio}"));
    }
    #[cfg(windows)]
    {
        use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};
        let hwnd = janela.hwnd().map_err(|e| e.to_string())?;
        unsafe {
            // CreateRoundRectRgn não inclui a borda direita e a de baixo, daí o +1.
            let regiao = CreateRoundRectRgn(x, y, x + largura + 1, y + altura + 1, raio * 2, raio * 2);
            // região nula para o SetWindowRgn quer dizer "sem recorte": a janela inteira pegaria clique
            if regiao.is_invalid() {
                return Err("CreateRoundRectRgn falhou".into());
            }
            // só depois de um SetWindowRgn bem-sucedido a região passa a ser do Windows
            if SetWindowRgn(hwnd, Some(regiao), true) == 0 {
                let _ = DeleteObject(regiao.into());
                return Err("SetWindowRgn falhou".into());
            }
        }
    }
    #[cfg(not(windows))]
    let _ = (janela, x, y);
    Ok(())
}

/// Uma ilha só: abrir o Xereta de novo não cria outra ilha nem outro ícone na bandeja.
/// O mutex com nome vive enquanto o processo viver; o Windows o solta quando ele fecha.
#[cfg(windows)]
fn ja_esta_aberto() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows::Win32::System::Threading::CreateMutexW;
    unsafe { CreateMutexW(None, false, w!("Local\\app.xereta.ilha")).is_ok() && GetLastError() == ERROR_ALREADY_EXISTS }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    if ja_esta_aberto() {
        return;
    }
    tauri::Builder::default()
        .manage(PonteLigada::default())
        .invoke_handler(tauri::generate_handler![recortar, ligar_ponte, responder_pedido])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Xereta");
}
