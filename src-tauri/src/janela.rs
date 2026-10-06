//! A janela de quem fez um pedido (E4, "No terminal"): qual processo está do outro lado de uma
//! conexão, e trazer para a frente a janela onde ele roda. É Rust de plataforma (D2): o JS só
//! pede "traga a janela do pedido N", e nada aqui sabe de onde o pedido veio.

/// O processo dono da ponta cliente de uma conexão local: quem conectou de `porta_cliente` na
/// `porta_servidor` de 127.0.0.1.
#[cfg(windows)]
pub fn processo_da_conexao(porta_cliente: u16, porta_servidor: u16) -> Option<u32> {
    use windows::Win32::NetworkManagement::IpHelper::{
        GetExtendedTcpTable, MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_CONNECTIONS,
    };
    use windows::Win32::Networking::WinSock::AF_INET;

    let mut tamanho = 0u32;
    // a tabela pode crescer entre as chamadas: tenta algumas vezes com o tamanho novo
    for _ in 0..4 {
        let mut buf = vec![0u8; tamanho as usize + 4096];
        tamanho = buf.len() as u32;
        let r = unsafe {
            GetExtendedTcpTable(Some(buf.as_mut_ptr().cast()), &mut tamanho, false, AF_INET.0 as u32, TCP_TABLE_OWNER_PID_CONNECTIONS, 0)
        };
        if r != 0 {
            continue; // ERROR_INSUFFICIENT_BUFFER: `tamanho` já veio com o necessário
        }
        let tabela = buf.as_ptr().cast::<MIB_TCPTABLE_OWNER_PID>();
        let linhas = unsafe {
            std::slice::from_raw_parts((*tabela).table.as_ptr().cast::<MIB_TCPROW_OWNER_PID>(), (*tabela).dwNumEntries as usize)
        };
        let porta = |p: u32| u16::from_be(p as u16);
        // 127.0.0.1 na ordem da rede, nos dois lados: a ponte só escuta ali
        let local = u32::from_ne_bytes([127, 0, 0, 1]);
        return linhas
            .iter()
            .find(|l| {
                l.dwLocalAddr == local && l.dwRemoteAddr == local
                    && porta(l.dwLocalPort) == porta_cliente && porta(l.dwRemotePort) == porta_servidor
            })
            .map(|l| l.dwOwningPid);
    }
    None
}

#[cfg(not(windows))]
pub fn processo_da_conexao(_porta_cliente: u16, _porta_servidor: u16) -> Option<u32> {
    None
}

/// Traz para a frente a janela onde o processo `pid` roda. Devolve se conseguiu.
///
/// Primeiro pelo console do processo: no cmd e no PowerShell clássicos ele é a janela; no Windows
/// Terminal (inclusive quando o cmd abre "emprestado" dentro dele), é uma janela invisível cujo
/// dono é a janela do Terminal. Se isso não der uma janela visível (o terminal do VS Code, por
/// exemplo), sobe pelos processos pais até achar uma.
#[cfg(windows)]
pub fn trazer_para_frente(pid: u32) -> bool {
    let janela = janela_do_console(pid).or_else(|| janela_de_um_pai(pid));
    janela.is_some_and(|h| unsafe { focar(h) })
}

#[cfg(not(windows))]
pub fn trazer_para_frente(_pid: u32) -> bool {
    false
}

#[cfg(windows)]
use windows::Win32::Foundation::HWND;

/// A janela do console de `pid`, ou a dona dela (Windows Terminal), se estiver visível.
#[cfg(windows)]
fn janela_do_console(pid: u32) -> Option<HWND> {
    use std::sync::Mutex;
    use windows::Win32::System::Console::{AttachConsole, FreeConsole, GetConsoleWindow, ATTACH_PARENT_PROCESS};
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GA_ROOTOWNER};

    // o console é um só por processo: dois pedidos ao mesmo tempo não podem se cruzar aqui
    static UM_POR_VEZ: Mutex<()> = Mutex::new(());
    let _vez = UM_POR_VEZ.lock().unwrap_or_else(|e| e.into_inner());
    // Enquanto o console do outro está emprestado, um Ctrl+C ou Ctrl+Break nele chegaria também ao
    // Xereta, e o tratamento padrão encerra o processo: ignora os sinais durante a consulta. O
    // tratador entra logo depois de emprestar (emprestar reinicia os tratadores) e sai antes de
    // devolver; sobra só o instante entre o AttachConsole e a linha seguinte.
    unsafe extern "system" fn ignorar(_sinal: u32) -> windows::core::BOOL {
        windows::core::BOOL::from(true)
    }
    use windows::Win32::System::Console::SetConsoleCtrlHandler;
    unsafe {
        // no dev o Xereta tem o console do npm; na release, nenhum
        let tinha_console = !GetConsoleWindow().is_invalid();
        let _ = FreeConsole();
        let console = if AttachConsole(pid).is_ok() {
            let _ = SetConsoleCtrlHandler(Some(ignorar), true);
            let h = GetConsoleWindow();
            let _ = SetConsoleCtrlHandler(Some(ignorar), false);
            let _ = FreeConsole();
            Some(h).filter(|h| !h.is_invalid())
        } else {
            None
        };
        if tinha_console {
            let _ = AttachConsole(ATTACH_PARENT_PROCESS);
        }
        let console = console?;
        [GetAncestor(console, GA_ROOTOWNER), console].into_iter().find(|&h| visivel_com_titulo(h))
    }
}

/// Sobe pelos pais de `pid` (sem passar do Explorer) e devolve a primeira janela visível de um deles.
#[cfg(windows)]
fn janela_de_um_pai(pid: u32) -> Option<HWND> {
    let processos = processos();
    let mut cadeia = Vec::new();
    let mut atual = pid;
    for _ in 0..12 {
        let Some(&(_, pai, ref nome)) = processos.iter().find(|p| p.0 == atual) else { break };
        if ["explorer.exe", "services.exe", "wininit.exe", "svchost.exe"].contains(&nome.as_str()) {
            break;
        }
        cadeia.push(atual);
        if pai == 0 || pai == atual {
            break;
        }
        atual = pai;
    }
    // o primeiro parente que tem janela; se ele tiver mais de uma (o VS Code com dois projetos),
    // não dá para saber qual é a do pedido, e é melhor não trazer nenhuma do que trazer a errada
    let janelas = janelas_visiveis();
    let parente = cadeia.iter().find(|p| janelas.iter().any(|j| j.0 == **p))?;
    let dele: Vec<HWND> = janelas.iter().filter(|j| j.0 == *parente).map(|j| j.1).collect();
    (dele.len() == 1).then(|| dele[0])
}

/// (pid, pid do pai, nome do executável em minúsculas) de todos os processos.
#[cfg(windows)]
fn processos() -> Vec<(u32, u32, String)> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    let mut lista = Vec::new();
    unsafe {
        let Ok(foto) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return lista };
        let mut p = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        let mut ok = Process32FirstW(foto, &mut p).is_ok();
        while ok {
            let fim = p.szExeFile.iter().position(|&c| c == 0).unwrap_or(p.szExeFile.len());
            lista.push((p.th32ProcessID, p.th32ParentProcessID, String::from_utf16_lossy(&p.szExeFile[..fim]).to_lowercase()));
            ok = Process32NextW(foto, &mut p).is_ok();
        }
        let _ = CloseHandle(foto);
    }
    lista
}

/// (pid, janela) de cada janela de topo visível, sem dona e com título.
#[cfg(windows)]
fn janelas_visiveis() -> Vec<(u32, HWND)> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::LPARAM;
    use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindow, GetWindowThreadProcessId, GW_OWNER};

    unsafe extern "system" fn cada(h: HWND, l: LPARAM) -> BOOL {
        let lista = &mut *(l.0 as *mut Vec<(u32, HWND)>);
        let sem_dona = GetWindow(h, GW_OWNER).map_or(true, |d| d.is_invalid());
        if sem_dona && visivel_com_titulo(h) {
            let mut pid = 0u32;
            GetWindowThreadProcessId(h, Some(&mut pid));
            lista.push((pid, h));
        }
        BOOL::from(true)
    }
    let mut lista: Vec<(u32, HWND)> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(cada), LPARAM(&mut lista as *mut _ as isize));
    }
    lista
}

#[cfg(windows)]
unsafe fn visivel_com_titulo(h: HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, IsWindowVisible};
    !h.is_invalid() && IsWindowVisible(h).as_bool() && GetWindowTextLengthW(h) > 0
}

/// Restaura (se minimizada) e traz para a frente. O Windows só deixa quem recebeu a última
/// entrada do usuário mudar a janela da frente; o clique na ilha conta. Se mesmo assim recusar,
/// junta por um instante a entrada desta thread à da janela da frente e tenta de novo.
#[cfg(windows)]
unsafe fn focar(h: HWND) -> bool {
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };
    if IsIconic(h).as_bool() {
        let _ = ShowWindow(h, SW_RESTORE);
    }
    if SetForegroundWindow(h).as_bool() {
        return true;
    }
    let da_frente = GetWindowThreadProcessId(GetForegroundWindow(), None);
    let nossa = GetCurrentThreadId();
    let juntou = da_frente != 0 && da_frente != nossa && AttachThreadInput(nossa, da_frente, true).as_bool();
    let _ = BringWindowToTop(h);
    let ok = SetForegroundWindow(h).as_bool();
    if juntou {
        let _ = AttachThreadInput(nossa, da_frente, false);
    }
    ok
}

#[cfg(all(test, windows))]
mod testes {
    use super::*;
    use std::net::{TcpListener, TcpStream};

    #[test]
    fn o_dono_da_conexao_e_quem_conectou() {
        let ouvinte = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let servidor = ouvinte.local_addr().unwrap().port();
        let cliente = TcpStream::connect(("127.0.0.1", servidor)).unwrap();
        let porta_cliente = cliente.local_addr().unwrap().port();
        assert_eq!(processo_da_conexao(porta_cliente, servidor), Some(std::process::id()));
        // uma porta que ninguém usa não tem dono
        assert_eq!(processo_da_conexao(porta_cliente, servidor.wrapping_add(1)), None);
    }

    #[test]
    fn a_lista_de_processos_tem_este_processo_e_o_pai_dele() {
        let eu = std::process::id();
        let lista = processos();
        let (_, pai, nome) = lista.iter().find(|p| p.0 == eu).cloned().expect("este processo está na lista");
        assert!(nome.ends_with(".exe"));
        assert!(lista.iter().any(|p| p.0 == pai));
    }
}
