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
        case 'PermissionRequest': return evento('permissao', resumirFerramenta(h.tool_name, h.tool_input));
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
