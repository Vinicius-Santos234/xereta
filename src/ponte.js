// A ponte do lado da página: liga o HTTP do Rust, entrega cada aviso ao adaptador da fonte
// (D10) e devolve a decisão ao pedido certo. Não sabe desenhar: quem mostra é a ilha.
'use strict';

const Ponte = (() => {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  const ADAPTADORES = { 'claude-code': ADAPTADOR_CLAUDE_CODE };

  // pedidos abertos, na ordem de chegada: { id, fonte, evento }
  const abertos = [];
  let aoMudar = () => {};

  function traduzir(fonte, corpo) {
    const adaptador = ADAPTADORES[fonte];
    if (!adaptador) return null;
    try {
      const evento = adaptador.traduzir(corpo);
      // a hora de chegada ordena os eventos de uma sessão (ex.: um pedido que expira depois de a
      // sessão já ter seguido em frente)
      if (evento) evento.chegou = performance.now();
      return evento;
    } catch (err) {
      // só o tipo do erro: o corpo pode trazer segredo (D9)
      console.error('[xereta] adaptador', fonte, err?.name);
      return null;
    }
  }

  function receber(aviso) {
    if (aviso.aviso === 'evento') {
      const evento = traduzir(aviso.fonte, aviso.corpo);
      if (evento) aoMudar({ evento, abertos });
    } else if (aviso.aviso === 'pedido') {
      const evento = traduzir(aviso.fonte, aviso.corpo);
      // fonte desconhecida ou pedido que não sabemos mostrar: devolve logo, e ele cai no terminal
      if (!evento || evento.tipo !== 'permissao') {
        invoke('responder_pedido', { id: aviso.id, corpo: null }).catch(() => {});
        return;
      }
      evento.pedidoId = aviso.id;
      abertos.push({ id: aviso.id, fonte: aviso.fonte, evento });
      aoMudar({ evento, abertos });
    } else if (aviso.aviso === 'expirou') {
      // sem decisão a tempo: o pedido seguiu para o terminal, que continua esperando você
      const pedido = tirar(aviso.id);
      aoMudar({ evento: null, abertos, paraOTerminal: pedido?.evento ?? null });
    }
  }

  function tirar(id) {
    const i = abertos.findIndex(p => p.id === id);
    return i < 0 ? null : abertos.splice(i, 1)[0];
  }

  return {
    abertos,

    /** Começa a ouvir e liga a ponte. Devolve a porta; o erro vem como { codigo, porta, detalhe }. */
    async ligar(quandoMudar) {
      aoMudar = quandoMudar;
      await listen('ponte', ({ payload }) => receber(payload));
      return invoke('ligar_ponte');
    },

    /** 'permitir' | 'negar' | 'terminal' para o pedido `id`. */
    async responder(id, decisao) {
      const pedido = tirar(id);
      if (!pedido) return;
      // a tela muda junto com a fila, antes de esperar o Rust: a ilha nunca mostra um pedido que
      // já saiu da fila enquanto outra decisão pode chegar
      aoMudar({ evento: null, abertos, paraOTerminal: decisao === 'terminal' ? pedido.evento : null });
      const corpo = decisao === 'terminal' ? null : ADAPTADORES[pedido.fonte].resposta(decisao);
      try {
        await invoke('responder_pedido', { id, corpo });
      } catch (err) {
        // o Rust já tinha encerrado o pedido (o prazo acabou no meio do clique): a decisão não
        // valeu, e o pedido foi para o terminal
        aoMudar({ evento: null, abertos, paraOTerminal: pedido.evento });
        throw err;
      }
    },
  };
})();
