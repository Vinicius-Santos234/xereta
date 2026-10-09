//! O cursor perto da pílula (D10 da 002). Recortada, a janela não recebe o mouse de fora, e ler a
//! posição pelo JS (o `cursorPosition()` do Tauri, 15 vezes por segundo) custava 7,5 pontos de CPU
//! e fazia a memória do WebView2 subir em serra: cada leitura era uma ida e volta pela ponte de
//! comandos. Aqui uma linha de fundo lê o cursor no mesmo ritmo e só avisa a página quando ele está
//! perto da região recortada. Longe ou com a ilha aberta, a página não recebe nada. Quem decide o
//! que fazer com o cursor (o olhar, a patadinha) continua sendo o JS.

use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::Emitter;

/// 15 leituras por segundo, o ritmo do desenho da pílula
const INTERVALO: Duration = Duration::from_millis(66);

/// O que o `recortar` conta para a vigia: a janela, a região recortada (px físicos relativos à
/// janela) e a distância em que o cursor conta como perto. `perto` zero: vigia parada.
pub struct Vigia {
    janela: AtomicIsize,
    regiao: Mutex<(i32, i32, i32, i32)>,
    perto: AtomicI32,
    mudou: AtomicBool,
}

/// Uma ilha, uma vigia.
pub static VIGIA: Vigia = Vigia {
    janela: AtomicIsize::new(0),
    regiao: Mutex::new((0, 0, 0, 0)),
    perto: AtomicI32::new(0),
    mudou: AtomicBool::new(false),
};

impl Vigia {
    pub fn vigiar(&self, janela: isize, regiao: (i32, i32, i32, i32), perto: Option<i32>) {
        self.janela.store(janela, Ordering::Relaxed);
        *self.regiao.lock().unwrap_or_else(|e| e.into_inner()) = regiao;
        self.perto.store(perto.unwrap_or(0).max(0), Ordering::Relaxed);
        self.mudou.store(true, Ordering::Relaxed);
    }
}

/// A posição do cursor se ele está a até `perto` px do retângulo (esquerda, topo, direita, baixo),
/// em px físicos da tela; senão, `None`.
pub fn se_perto(cursor: (i32, i32), ret: (i32, i32, i32, i32), perto: i32) -> Option<(i32, i32)> {
    let (x, y) = (i64::from(cursor.0), i64::from(cursor.1));
    let (l, t, r, b) = (i64::from(ret.0), i64::from(ret.1), i64::from(ret.2), i64::from(ret.3));
    let dx = (l - x).max(0).max(x - r);
    let dy = (t - y).max(0).max(y - b);
    let p = i64::from(perto);
    (perto > 0 && dx <= p && dy <= p && dx * dx + dy * dy <= p * p).then_some(cursor)
}

/// Liga a linha de fundo. Ela avisa a página com o evento `cursor`: a posição enquanto o cursor
/// está perto, e `null` uma vez quando ele se afasta (ou quando a vigia para).
pub fn iniciar(app: tauri::AppHandle) {
    let vigia = &VIGIA;
    std::thread::spawn(move || {
        let mut estava_perto = false;
        loop {
            std::thread::sleep(INTERVALO);
            let perto = vigia.perto.load(Ordering::Relaxed);
            if vigia.mudou.swap(false, Ordering::Relaxed) && estava_perto && perto == 0 {
                estava_perto = false;
                let _ = app.emit("cursor", None::<(i32, i32)>);
            }
            if perto == 0 {
                continue;
            }
            let regiao = *vigia.regiao.lock().unwrap_or_else(|e| e.into_inner());
            let Some(agora) = ler(vigia.janela.load(Ordering::Relaxed), regiao, perto) else {
                if estava_perto {
                    estava_perto = false;
                    let _ = app.emit("cursor", None::<(i32, i32)>);
                }
                continue;
            };
            estava_perto = true;
            let _ = app.emit("cursor", Some(agora));
        }
    });
}

/// O cursor, se perto da região recortada da janela `hwnd`.
#[cfg(windows)]
fn ler(hwnd: isize, regiao: (i32, i32, i32, i32), perto: i32) -> Option<(i32, i32)> {
    use windows::Win32::Foundation::{HWND, POINT, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetWindowRect};
    let mut p = POINT::default();
    let mut janela = RECT::default();
    unsafe {
        GetCursorPos(&mut p).ok()?;
        GetWindowRect(HWND(hwnd as *mut _), &mut janela).ok()?;
    }
    let (x, y, l, a) = regiao;
    let ret = (janela.left + x, janela.top + y, janela.left + x + l, janela.top + y + a);
    se_perto((p.x, p.y), ret, perto)
}

#[cfg(not(windows))]
fn ler(_hwnd: isize, _regiao: (i32, i32, i32, i32), _perto: i32) -> Option<(i32, i32)> {
    None
}

#[cfg(test)]
mod testes {
    use super::se_perto;

    const PILULA: (i32, i32, i32, i32) = (100, 0, 240, 34);

    #[test]
    fn perto_e_ate_a_distancia_em_volta_do_retangulo() {
        assert_eq!(se_perto((300, 10), PILULA, 60), Some((300, 10))); // 60 à direita
        assert_eq!(se_perto((301, 10), PILULA, 60), None);
        assert_eq!(se_perto((150, 94), PILULA, 60), Some((150, 94))); // 60 abaixo
        assert_eq!(se_perto((150, 95), PILULA, 60), None);
        // na quina, a distância é a diagonal
        assert_eq!(se_perto((280, 74), PILULA, 60), Some((280, 74)));
        assert_eq!(se_perto((285, 79), PILULA, 60), None);
        // dentro também conta (a página decide o que fazer)
        assert_eq!(se_perto((150, 10), PILULA, 60), Some((150, 10)));
    }

    #[test]
    fn vigia_parada_nunca_ve_o_cursor() {
        assert_eq!(se_perto((150, 10), PILULA, 0), None);
        // e longe de verdade não estoura a conta
        assert_eq!(se_perto((i32::MAX, i32::MIN), PILULA, 60), None);
    }
}
