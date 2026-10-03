// Núcleo fino (D2): por enquanto só abre a janela. A ponte HTTP entra na E2.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Xereta");
}
