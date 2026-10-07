// Adaptador do Claude Code (D10): traduz o JSON dos hooks para o formato comum (§4) e monta a
// resposta de um pedido de permissão. Se o formato dos hooks mudar, só este arquivo muda.
'use strict';

const ADAPTADOR_CLAUDE_CODE = (() => {
  const T = TEXTOS;

  // uma linha só e curta: um heredoc inteiro não cabe na ilha
  const linha = texto => {
    const primeira = String(texto).trim().split(/\r?\n/)[0];
    return primeira.length > 120 ? primeira.slice(0, 119) + '…' : primeira;
  };

  const resumirFerramenta = (nome, entrada) => {
    const resumir = T.ferramentas[nome];
    return linha(resumir ? resumir(entrada ?? {}) : T.ferramentas.outra(nome));
  };

  const projeto = cwd => (cwd ? String(cwd).split(/[\\/]/).filter(Boolean).pop() : undefined);

  // arquivo dentro do projeto: relativo a ele; fora: o caminho inteiro (mexer fora do projeto é
  // justamente o que precisa ficar à vista)
  const normalizar = p => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  const caminhoNoProjeto = cwd => arquivo => {
    const a = normalizar(arquivo), base = normalizar(cwd);
    return base && a.toLowerCase().startsWith(base.toLowerCase() + '/') ? a.slice(base.length + 1) : String(arquivo ?? '');
  };

  // o que o pedido quer fazer: verbo e alvo (o alvo vai inteiro numa linha; a tela corta)
  const descreverPedido = (nome, entrada, cwd) => {
    const descrever = T.pedidos[nome];
    const { verbo, alvo } = descrever ? descrever(entrada ?? {}, caminhoNoProjeto(cwd)) : T.pedidos.outra(nome);
    const linhas = String(alvo).trim().split(/\r?\n/);
    const primeira = linhas[0].length > 500 ? linhas[0].slice(0, 499) + '…' : linhas[0];
    return { verbo, alvo: linhas.length > 1 ? `${primeira} …` : primeira };
  };

  // O +N −M de uma edição já feita (D3 da 002), pelo `tool_response` do PostToolUse: o
  // `structuredPatch` traz as linhas reais com "+", "-" ou " " (Edit, também com replace_all, e
  // Write por cima de arquivo existente); o Write de arquivo novo vem com `type: "create"` e o patch
  // vazio, e aí tudo é +. Visto na 2.1.292 em 07/10. Formato desconhecido: sem conta (null).
  const contarLinhas = texto => (texto === '' ? 0 : texto.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length);
  const contarEdicao = resposta => {
    if (!resposta || typeof resposta !== 'object') return null;
    if (resposta.type === 'create' && typeof resposta.content === 'string') return { mais: contarLinhas(resposta.content), menos: 0 };
    if (!Array.isArray(resposta.structuredPatch)) return null;
    let mais = 0, menos = 0;
    for (const trecho of resposta.structuredPatch) {
      for (const l of Array.isArray(trecho?.lines) ? trecho.lines : []) {
        if (typeof l !== 'string') continue;
        if (l[0] === '+') mais++;
        else if (l[0] === '-') menos++;
      }
    }
    return { mais, menos };
  };

  const EDICOES = new Set(['Edit', 'MultiEdit', 'Write']);

  // O PermissionRequest não traz `tool_use_id` (visto na E3). Para saber de qual ferramenta é o
  // pedido, a ponte compara esta assinatura (o nome e a entrada) com a do PreToolUse, que traz o
  // id. Só um resumo (tamanho e FNV-1a do JSON), para não guardar o conteúdo de um Write duas vezes.
  const assinar = (nome, entrada) => {
    const texto = JSON.stringify([nome ?? null, entrada ?? null]);
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
    return `${texto.length}:${(h >>> 0).toString(16)}`;
  };

  // a decisão da ilha para o `behavior` do hook; qualquer outra coisa vira "sem decisão" (D6)
  const COMPORTAMENTO = { permitir: 'allow', negar: 'deny' };

  return {
    /** JSON do hook → evento no formato comum, ou null para ignorar. */
    traduzir(h) {
      const base = { fonte: 'claude-code', sessao: h.session_id, projeto: projeto(h.cwd) };
      const evento = (tipo, resumo) => ({ ...base, tipo, resumo });
      // o passo de uma ferramenta: o nome dela e o id que liga o antes (PreToolUse) ao depois
      const passo = (tipo, resumo) => ({ ...evento(tipo, resumo), ferramenta: h.tool_name, passoId: h.tool_use_id });
      switch (h.hook_event_name) {
        case 'SessionStart': return evento('inicio', T.eventos.inicio);
        case 'UserPromptSubmit': return evento('pensando', T.eventos.pensando);
        case 'PreToolUse': return {
          ...passo('ferramenta', resumirFerramenta(h.tool_name, h.tool_input)),
          assinatura: assinar(h.tool_name, h.tool_input),
        };
        // a ferramenta terminou; nas edições, com o +N −M do patch
        case 'PostToolUse': {
          const concluiu = passo('concluiu', resumirFerramenta(h.tool_name, h.tool_input));
          if (!EDICOES.has(h.tool_name)) return concluiu;
          const caminho = String(h.tool_input?.file_path ?? h.tool_response?.filePath ?? '');
          return { ...concluiu, edicao: { caminho, conta: contarEdicao(h.tool_response) } };
        }
        case 'PostToolUseFailure': return passo('erro', T.eventos.falhou(h.tool_name));
        case 'PermissionRequest': return {
          ...passo('permissao', resumirFerramenta(h.tool_name, h.tool_input)),
          assinatura: assinar(h.tool_name, h.tool_input),
          pedido: descreverPedido(h.tool_name, h.tool_input, h.cwd),
        };
        // a mensagem vai crua: quem mostra tira o Markdown (sessao.js)
        case 'Stop': return {
          ...evento('fim', T.eventos.fim),
          mensagem: typeof h.last_assistant_message === 'string' ? h.last_assistant_message : null,
        };
        case 'StopFailure': return evento('erro', T.eventos.parou);
        case 'SessionEnd': return evento('saida', T.eventos.saida);
        default: return null;
      }
    },

    /** 'permitir' | 'negar' → corpo da resposta do hook. Qualquer outra coisa → null (sem decisão). */
    resposta(decisao) {
      const behavior = Object.hasOwn(COMPORTAMENTO, decisao) ? COMPORTAMENTO[decisao] : null;
      if (!behavior) return null;
      return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior } } });
    },
  };
})();
