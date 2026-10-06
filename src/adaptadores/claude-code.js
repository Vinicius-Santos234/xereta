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

  // a decisão da ilha para o `behavior` do hook; qualquer outra coisa vira "sem decisão" (D6)
  const COMPORTAMENTO = { permitir: 'allow', negar: 'deny' };

  return {
    /** JSON do hook → evento no formato comum, ou null para ignorar. */
    traduzir(h) {
      const base = { fonte: 'claude-code', sessao: h.session_id, projeto: projeto(h.cwd) };
      const evento = (tipo, resumo) => ({ ...base, tipo, resumo });
      switch (h.hook_event_name) {
        case 'SessionStart': return evento('inicio', T.eventos.inicio);
        case 'UserPromptSubmit': return evento('pensando', T.eventos.pensando);
        case 'PreToolUse': return evento('ferramenta', resumirFerramenta(h.tool_name, h.tool_input));
        case 'PostToolUseFailure': return evento('erro', T.eventos.falhou(h.tool_name));
        case 'PermissionRequest': return {
          ...evento('permissao', resumirFerramenta(h.tool_name, h.tool_input)),
          pedido: descreverPedido(h.tool_name, h.tool_input, h.cwd),
        };
        case 'Stop': return evento('fim', T.eventos.fim);
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
