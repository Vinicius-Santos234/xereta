// Todos os textos do Xereta ficam aqui (D16). Para outro idioma, um arquivo irmão com as
// mesmas chaves.
'use strict';

// só o nome do arquivo, sem a pasta
const nomeDoArquivo = caminho => String(caminho ?? '').split(/[\\/]/).pop();
const hostDaUrl = url => { try { return new URL(url).host; } catch { return String(url ?? ''); } };

const TEXTOS = {
  app: 'Xereta',
  bandeja: {
    dica: 'Xereta',
    estadoTeste: 'Estado de teste',
    carasExtras: 'Caras extras',
    pausar: 'Pausar',
    mostrar: 'Mostrar',
    sair: 'Sair',
  },
  ilha: {
    modoTeste: 'modo de teste',
    dicaTeste: 'Troque o estado pelo ícone na bandeja.',
    ouvindo: porta => `ouvindo na porta ${porta}`,
    maisPedidos: n => `+${n}`,
    quer: verbo => `quer ${verbo}`,
    permitir: 'Permitir',
    negar: 'Negar',
    noTerminal: 'No terminal',
  },
  // o que um pedido de permissão quer fazer: o verbo e o alvo (comando, arquivo, endereço).
  // `caminho` mostra o arquivo relativo ao projeto, ou completo quando ele está fora do projeto.
  pedidos: {
    Bash: (e, caminho) => ({ verbo: 'rodar', alvo: e.command ?? '' }),
    PowerShell: (e, caminho) => ({ verbo: 'rodar', alvo: e.command ?? '' }),
    Edit: (e, caminho) => ({ verbo: 'editar', alvo: caminho(e.file_path) }),
    MultiEdit: (e, caminho) => ({ verbo: 'editar', alvo: caminho(e.file_path) }),
    Write: (e, caminho) => ({ verbo: 'escrever', alvo: caminho(e.file_path) }),
    NotebookEdit: (e, caminho) => ({ verbo: 'editar', alvo: caminho(e.notebook_path) }),
    WebFetch: e => ({ verbo: 'abrir', alvo: hostDaUrl(e.url) }),
    WebSearch: e => ({ verbo: 'pesquisar', alvo: e.query ?? '' }),
    outra: nome => ({ verbo: 'usar', alvo: nome }),
  },
  // o instalador dos hooks (npm run hooks), que roda no terminal
  instalador: {
    uso: 'Uso: npm run hooks -- instalar | remover | estado   [--sim] [--confirmar <código>]',
    semConfig: arquivo => `Não achei ${arquivo}.\nAbra o Xereta uma vez (npm run tauri dev) para ele criar o token, e rode de novo.`,
    configInvalida: arquivo => `Não entendi ${arquivo}: falta a porta ou o token. Nada foi gravado.`,
    settingsInvalido: (arquivo, erro) => `O ${arquivo} não é um JSON válido (${erro}). Nada foi gravado.`,
    formatoInesperado: caminho => `O settings.json tem "${caminho}" num formato que eu não conheço. Nada foi gravado.`,
    jaInstalado: 'Os hooks do Xereta já estão no settings.json, iguais. Nada a fazer.',
    nadaARemover: 'Não há hooks do Xereta no settings.json. Nada a fazer.',
    previa: acao => `Isto é exatamente o que ${acao === 'instalar' ? 'entra no' : 'sai do'} settings.json. Os outros hooks ficam intactos.`,
    codigo: codigo => `Código desta prévia: ${codigo}`,
    sim: (acao, codigo) => `Nada foi gravado (--sim). Para gravar exatamente isto: npm run hooks -- ${acao} --confirmar ${codigo}`,
    perguntar: 'Gravar? (s/N) ',
    cancelado: 'Nada foi gravado.',
    mudou: 'O settings.json mudou desde a prévia. Nada foi gravado: rode de novo para ver a prévia nova.',
    backup: arquivo => `Backup: ${arquivo}`,
    sobrou: arquivo => `Atenção: não consegui apagar ${arquivo}. Ele tem o token do Xereta: apague à mão.`,
    instalado: 'Pronto. O Claude Code recarrega os hooks sozinho, inclusive nas sessões já abertas. Se alguma não aparecer na ilha, abra uma sessão nova.',
    removido: 'Removidos. As sessões novas do Claude Code não chamam mais o Xereta.',
    estado: {
      desligado: 'Desligado: nenhum hook do Xereta no settings.json.',
      ligado: 'Ligado: os 7 hooks do Xereta, com a porta e o token atuais.',
      diferente: 'Há hooks do Xereta, mas diferentes dos de agora (porta, token, ou um hook a mais ou a menos). Rode "npm run hooks -- instalar" para atualizar.',
    },
  },
  // o que a ilha mostra quando a ponte não liga; a chave é o código que vem do Rust
  errosPonte: {
    'porta-ocupada': porta => ({ pilula: `Porta ${porta} ocupada`, fala: `A porta ${porta} já está em uso.`, dica: `Quem usa: netstat -ano | findstr ${porta}. Feche-o e abra o Xereta de novo.` }),
    'config-invalida': () => ({ pilula: 'Config com defeito', fala: 'Não entendi o config.json.', dica: 'Confira o arquivo em %APPDATA%\\app.xereta.ilha.' }),
    falha: () => ({ pilula: 'Ponte desligada', fala: 'Não consegui ligar a ponte.', dica: 'Os pedidos continuam no terminal.' }),
  },
  fontes: {
    'claude-code': 'Claude Code',
  },
  // resumo do que a ferramenta está fazendo, por nome de ferramenta
  ferramentas: {
    Bash: e => `Rodando ${e.command ?? ''}`,
    PowerShell: e => `Rodando ${e.command ?? ''}`,
    Read: e => `Lendo ${nomeDoArquivo(e.file_path)}`,
    Edit: e => `Editando ${nomeDoArquivo(e.file_path)}`,
    MultiEdit: e => `Editando ${nomeDoArquivo(e.file_path)}`,
    Write: e => `Escrevendo ${nomeDoArquivo(e.file_path)}`,
    NotebookEdit: e => `Editando ${nomeDoArquivo(e.notebook_path)}`,
    Grep: e => `Procurando ${e.pattern ?? ''}`,
    Glob: e => `Procurando ${e.pattern ?? ''}`,
    WebFetch: e => `Abrindo ${hostDaUrl(e.url)}`,
    WebSearch: e => `Pesquisando ${e.query ?? ''}`,
    Task: () => 'Chamando um ajudante',
    Agent: () => 'Chamando um ajudante',
    outra: nome => `Usando ${nome}`,
  },
  eventos: {
    inicio: 'Sessão nova',
    pensando: 'Pensando…',
    falhou: nome => `${nome} falhou`,
    noTerminal: resumo => `No terminal: ${resumo}`,
    respondido: resumo => `Respondido no terminal: ${resumo}`,
    encerrado: resumo => `Encerrado no terminal: ${resumo}`,
    negado: alvo => `Negado: ${alvo}`,
    fim: 'Prontinho!',
    parou: 'Parou com erro',
    saida: 'Sessão encerrada',
  },
  estados: {
    parado: { rotulo: 'Parado', fala: 'Tudo quieto por aqui.', pilula: 'Tudo quieto' },
    pensando: { rotulo: 'Pensando', fala: 'Hmm, deixa eu ver…', pilula: 'Pensando…' },
    trabalhando: { rotulo: 'Trabalhando', fala: 'Bora!', pilula: 'Trabalhando…' },
    esperando: { rotulo: 'Esperando você', fala: 'Opa! Posso?', pilula: 'Posso?' },
    feliz: { rotulo: 'Feliz', fala: 'Prontinho!', pilula: 'Prontinho!' },
    erro: { rotulo: 'Erro', fala: 'Deu ruim…', pilula: 'Deu ruim' },
    oi: { rotulo: 'Oi!', fala: 'Opa, cheguei!', pilula: 'Opa!' },
    feito: { rotulo: 'Tá feito', fala: 'Tá feito!', pilula: 'Tá feito!' },
    testes: { rotulo: 'Testes no verde', fala: 'Tudo verdinho!', pilula: 'Verdinho!' },
    aqui: { rotulo: 'Ó, aqui!', fala: 'Ó, aqui! Posso?', pilula: 'Posso?' },
    negou: { rotulo: 'Você negou', fala: 'Tá bom, não mexo.', pilula: 'Não mexo' },
    ops: { rotulo: 'Ops', fala: 'Ops.', pilula: 'Ops' },
    eita: { rotulo: 'Eita', fala: 'Eita… tem certeza?', pilula: 'Eita…' },
    socorro: { rotulo: 'Deu muito ruim', fala: 'DEU MUITO RUIM!', pilula: 'Socorro!' },
  },
};
