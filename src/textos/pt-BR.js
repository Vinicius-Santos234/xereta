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
    pedidoTeste: 'Pedido aberto (teste)',
    permitir: 'Permitir',
    negar: 'Negar',
    noTerminal: 'No terminal',
    semPedido: 'Nenhum pedido aberto',
  },
  ilha: {
    modoTeste: 'modo de teste',
    dicaTeste: 'Troque o estado pelo ícone na bandeja.',
    ouvindo: porta => `ouvindo na porta ${porta}`,
    dicaPedido: 'Responda pelo ícone na bandeja (teste).',
    maisPedidos: n => `+${n}`,
  },
  // o que a ilha mostra quando a ponte não liga; a chave é o código que vem do Rust
  errosPonte: {
    'porta-ocupada': porta => ({ pilula: `Porta ${porta} ocupada`, fala: `A porta ${porta} já está em uso.`, dica: 'Feche o outro programa e abra o Xereta de novo.' }),
    'config-invalida': () => ({ pilula: 'Config com defeito', fala: 'Não entendi o config.json.', dica: 'Confira o arquivo em %APPDATA%\\app.xereta.ilha.' }),
    falha: () => ({ pilula: 'Ponte desligada', fala: 'Não consegui ligar a ponte.', dica: 'Os pedidos continuam no terminal.' }),
  },
  fontes: {
    'claude-code': 'Claude Code',
  },
  // resumo do que a ferramenta está fazendo, por nome de ferramenta
  ferramentas: {
    Bash: e => `Rodando ${e.command ?? ''}`,
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
