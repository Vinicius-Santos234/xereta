// As configurações do Xereta: `config.json` na pasta de configuração do app
// (%APPDATA%\app.xereta.ilha no Windows). Na primeira vez o arquivo nasce com um token novo;
// o instalador dos hooks (E3) lê o token daqui.

use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::ponte::{token_valido, ErroPonte};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    /// Porta fixa da ponte (D4).
    pub porta: u16,
    /// Vai como `Authorization: Bearer` nos hooks (D5).
    pub token: String,
    /// Quanto tempo um pedido fica aberto na ilha. Abaixo dos 60 s do hook (D7).
    pub espera_pedido_segundos: u64,
}

impl Default for Config {
    fn default() -> Self {
        Config { porta: 47321, token: String::new(), espera_pedido_segundos: 15 }
    }
}

/// Lê o `config.json` da pasta; se não existir, ou se faltar o token, cria e grava.
/// Um arquivo que existe mas não dá para entender não é sobrescrito: vira erro na ilha. Isso vale
/// para um token escrito à mão que não passaria num cabeçalho HTTP: a ponte ligaria e todos os
/// hooks levariam 401, sem nada na tela.
pub fn carregar(pasta: &Path) -> Result<Config, ErroPonte> {
    let arquivo = pasta.join("config.json");
    let padrao = Config::default();
    let erro = |codigo, detalhe: String| ErroPonte { codigo, porta: padrao.porta, detalhe };

    let mut config = match fs::read_to_string(&arquivo) {
        Ok(texto) => serde_json::from_str(&texto).map_err(|e| erro("config-invalida", format!("{}: {e}", arquivo.display())))?,
        Err(e) if e.kind() == io::ErrorKind::NotFound => padrao.clone(),
        Err(e) => return Err(erro("falha", format!("{}: {e}", arquivo.display()))),
    };
    if config.porta == 0 || !(1..=55).contains(&config.espera_pedido_segundos) {
        let detalhe = format!("porta {} e espera de {} s", config.porta, config.espera_pedido_segundos);
        return Err(erro("config-invalida", detalhe));
    }
    if !config.token.is_empty() && !token_valido(&config.token) {
        return Err(erro("config-invalida", "token com caracteres que não cabem no cabeçalho, ou curto demais".into()));
    }
    if config.token.is_empty() {
        config.token = novo_token().map_err(|e| erro("falha", e))?;
        let texto = serde_json::to_string_pretty(&config).expect("Config sempre vira JSON");
        fs::create_dir_all(pasta)
            .and_then(|_| fs::write(&arquivo, texto + "\n"))
            .map_err(|e| erro("falha", format!("{}: {e}", arquivo.display())))?;
    }
    Ok(config)
}

/// 32 bytes do gerador do sistema, em hexadecimal (64 caracteres).
fn novo_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

#[cfg(test)]
mod testes {
    use super::*;

    fn pasta_temporaria(nome: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!("xereta-teste-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        p
    }

    #[test]
    fn primeira_vez_cria_o_arquivo_com_token_e_depois_le_o_mesmo() {
        let pasta = pasta_temporaria("primeira");
        let a = carregar(&pasta).unwrap();
        assert_eq!((a.porta, a.espera_pedido_segundos, a.token.len()), (47321, 15, 64));
        assert_eq!(carregar(&pasta).unwrap().token, a.token);
        assert_ne!(carregar(&pasta_temporaria("outra")).unwrap().token, a.token);
    }

    #[test]
    fn campos_que_faltam_ficam_no_padrao_e_os_que_existem_valem() {
        let pasta = pasta_temporaria("parcial");
        fs::create_dir_all(&pasta).unwrap();
        fs::write(pasta.join("config.json"), r#"{ "porta": 50000 }"#).unwrap();
        let c = carregar(&pasta).unwrap();
        assert_eq!((c.porta, c.espera_pedido_segundos, c.token.len()), (50000, 15, 64));
    }

    #[test]
    fn arquivo_estragado_ou_fora_da_faixa_vira_erro_e_nao_e_sobrescrito() {
        let pasta = pasta_temporaria("estragado");
        fs::create_dir_all(&pasta).unwrap();
        for texto in [
            "{ porta: 1",
            r#"{ "porta": 0 }"#,
            r#"{ "esperaPedidoSegundos": 60 }"#,
            r#"{ "token": "curto" }"#,
            r#"{ "token": "0123456789abcdef0123456789abcdef\n" }"#,
            r#"{ "token": "0123456789abcdef0123456789abcdefé" }"#,
        ] {
            fs::write(pasta.join("config.json"), texto).unwrap();
            assert_eq!(carregar(&pasta).unwrap_err().codigo, "config-invalida", "{texto}");
            assert_eq!(fs::read_to_string(pasta.join("config.json")).unwrap(), texto);
        }
    }
}
