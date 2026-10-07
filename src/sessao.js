// A sessão contada (spec 002, F1): os passos desde o último prompt, o +N −M de cada edição e como
// terminou. Só dados, sem tela e sem I/O: a ilha lê daqui e desenha. Nada daqui vai para disco
// (D5): a mensagem final e os nomes de arquivo podem citar segredo, como o `tool_input` (D9 da 001).
// Módulo ES: o Node importa nos testes, e a ilha com import().

const MAX_PASSOS = 10;   // os que ficam guardados (a linha do tempo mostra 10); a contagem segue
const MAX_SESSOES = 20;  // uma sessão que morreu sem SessionEnd não pode ficar para sempre
// F2: sem evento nenhum por 1 hora, a sessão sai da conta de "2 sessões" (o terminal fechado talvez
// não mande o SessionEnd). Ela volta no próximo evento.
const VIVA_POR = 60 * 60 * 1000;

/** A chave de uma sessão: a fonte e o id que ela deu. */
export const chaveDe = evento => `${evento.fonte}\u0000${evento.sessao ?? ''}`;

// o mesmo arquivo escrito de jeitos diferentes conta uma vez só (Windows: sem diferença de caixa)
const chaveDoArquivo = caminho => String(caminho).replace(/\\/g, '/').toLowerCase();

/**
 * As sessões abertas. `receber(evento)` atualiza a sessão do evento e a devolve (ou null, se o
 * evento a encerrou). Cada sessão:
 *   { chave, fonte, sessao, projeto, total, passos: [passo], arquivos: Map, fim, ultimo, quieta }
 *   (`ultimo`: a hora do último evento; `quieta`: o OK foi dado e nada aconteceu desde então)
 *   passo: { id, resumo, estado: 'atual' | 'ok' | 'erro' | 'negado', conta: { mais, menos } | null, hora }
 *   fim:   { mensagem: texto sem Markdown | null, falhou: bool } | null
 */
export function criarSessoes({ agora = () => Date.now() } = {}) {
  const sessoes = new Map();

  function abrir(evento) {
    const chave = chaveDe(evento);
    let s = sessoes.get(chave);
    if (!s) {
      s = { chave, fonte: evento.fonte, sessao: evento.sessao, projeto: undefined, total: 0, passos: [], ids: new Set(), arquivos: new Map(), fim: null };
      sessoes.set(chave, s);
      if (sessoes.size > MAX_SESSOES) sessoes.delete(sessoes.keys().next().value);
    } else {
      // a que mudou por último vai para o fim da fila (a mais velha é a que sai)
      sessoes.delete(chave);
      sessoes.set(chave, s);
    }
    if (evento.projeto) s.projeto = evento.projeto;
    s.ultimo = agora();
    s.quieta = false;
    return s;
  }

  // As sessões vivas, da que mudou por último para a mais antiga. Um cartão do fim esperando o OK
  // mantém a sessão viva, passe o tempo que passar (D4b): quem volta depois de horas ainda o encontra.
  const vivas = () => [...sessoes.values()].reverse().filter(s => s.fim || agora() - s.ultimo < VIVA_POR);

  /** Quando a próxima sessão viva deixa de contar (ms a partir de agora), ou null. */
  const proximaExpiracao = () => {
    const prazos = vivas().filter(s => !s.fim).map(s => s.ultimo + VIVA_POR - agora());
    return prazos.length ? Math.max(0, Math.min(...prazos)) : null;
  };

  // O evento é de uma ferramenta deste prompt? Com id, só se o id nasceu depois do último prompt
  // (um resultado atrasado do prompt anterior não mexe no novo); sem id, vale (fonte sem ids).
  const doPrompt = (s, evento) => evento.passoId == null || s.ids.has(evento.passoId);

  // O passo do evento: pelo id; sem id, o último. Um id que não está entre os 10 guardados não
  // mexe em outro passo (ele saiu da tela, mas a soma dos arquivos continua contando).
  const passoDo = (s, evento) =>
    (evento.passoId != null ? s.passos.find(p => p.id === evento.passoId) : s.passos.at(-1)) ?? null;

  // D2: no fim, o que ainda estava em curso conta como feito
  const concluirTodos = s => { for (const p of s.passos) if (p.estado === 'atual') p.estado = 'ok'; };

  return {
    receber(evento) {
      if (evento.tipo === 'saida') {
        sessoes.delete(chaveDe(evento));
        return null;
      }
      // um pedido não é passo: o PreToolUse da mesma ferramenta já chegou antes dele
      if (evento.tipo === 'permissao') return sessoes.get(chaveDe(evento)) ?? null;

      const s = abrir(evento);
      // D4b: o cartão do fim fica até o OK ou até o próximo evento da sessão
      s.fim = null;
      switch (evento.tipo) {
        case 'pensando': // D1: os passos contam desde o último prompt
          s.total = 0;
          s.passos = [];
          s.ids = new Set();
          s.arquivos = new Map();
          break;
        case 'ferramenta':
          // D2: o passo fica em curso até o resultado dele (PostToolUse), e não até o próximo
          // começar: chamadas em paralelo começam juntas
          s.total++;
          if (evento.passoId != null) s.ids.add(evento.passoId);
          s.passos.push({ id: evento.passoId ?? null, resumo: evento.resumo, estado: 'atual', conta: null, hora: agora() });
          if (s.passos.length > MAX_PASSOS) s.passos.shift();
          break;
        case 'concluiu': {
          if (!doPrompt(s, evento)) break;
          const p = passoDo(s, evento);
          const conta = evento.edicao?.conta ?? null;
          if (p) { p.estado = 'ok'; p.conta = conta; }
          const caminho = evento.edicao?.caminho;
          if (caminho) {
            const k = chaveDoArquivo(caminho);
            const antes = s.arquivos.get(k) ?? { mais: 0, menos: 0 };
            s.arquivos.set(k, { mais: antes.mais + (conta?.mais ?? 0), menos: antes.menos + (conta?.menos ?? 0) });
          }
          break;
        }
        case 'erro':
          if (evento.ferramenta) {
            // a ferramenta falhou (PostToolUseFailure): ✗ no passo dela
            const p = doPrompt(s, evento) ? passoDo(s, evento) : null;
            if (p) p.estado = 'erro';
          } else {
            // a sessão parou com erro (StopFailure)
            concluirTodos(s);
            s.fim = { mensagem: null, falhou: true };
          }
          break;
        case 'fim':
          concluirTodos(s);
          s.fim = { mensagem: textoSimples(evento.mensagem) || null, falhou: false };
          break;
      }
      return s;
    },

    /** O pedido foi negado pela ilha: ✗ no passo dele (pelo id; sem id, o último). */
    negado(evento) {
      const s = sessoes.get(chaveDe(evento));
      const p = s && doPrompt(s, evento) ? passoDo(s, evento) : null;
      if (p?.estado === 'atual') p.estado = 'negado';
    },

    /** O OK do cartão do fim: a sessão fica quieta até o próximo evento dela. */
    dispensar(evento) {
      const s = sessoes.get(chaveDe(evento));
      if (s) { s.fim = null; s.quieta = true; }
    },

    /** As chaves das sessões vivas (F2), da que mudou por último para a mais antiga. */
    vivas: () => vivas().map(s => s.chave),

    /** Em quantos ms a conta de sessões muda sozinha (uma sessão passa de 1 hora), ou null. */
    proximaExpiracao,

    /**
     * Qual sessão a ilha mostra (D6, F2): a escolhida por clique, se ainda está viva; senão, a que
     * tem um cartão do fim esperando o OK (D4b: o resultado de quem estava longe não some porque
     * outra sessão andou); senão, a que mudou por último e não está quieta. Nenhuma: null.
     */
    naTela(escolhida = null) {
      const lista = vivas();
      if (escolhida && lista.some(s => s.chave === escolhida)) return escolhida;
      return (lista.find(s => s.fim) ?? lista.find(s => !s.quieta))?.chave ?? null;
    },

    /** A sessão seguinte à `atual` na lista das vivas, dando a volta (o clique em "2 sessões"). */
    seguinte(atual) {
      const lista = vivas().map(s => s.chave);
      if (!lista.length) return null;
      return lista[(lista.indexOf(atual) + 1) % lista.length];
    },

    obter: evento => sessoes.get(chaveDe(evento)) ?? null,
    get quantas() { return sessoes.size; },
  };
}

/** Quantos arquivos a sessão editou desde o último prompt, e o +N −M somado. */
export function somaDosArquivos(s) {
  let mais = 0, menos = 0;
  for (const c of s.arquivos.values()) { mais += c.mais; menos += c.menos; }
  return { arquivos: s.arquivos.size, mais, menos };
}

/**
 * A mensagem final numa linha de texto corrido, sem a marcação do Markdown (D4). Quem mostra corta
 * em duas linhas; aqui só se limita o tamanho, para não carregar um relatório inteiro na tela.
 */
export function textoSimples(md, limite = 280) {
  // Roda a cada Stop, na mesma volta do laço que mostra os pedidos: precisa ser linear. Por isso a
  // entrada é cortada antes (duas linhas na tela não precisam de mais), a marcação de bloco é vista
  // linha a linha, e as regex de dentro da linha têm teto (nenhuma volta atrás sem limite).
  const frase = t => (!t || /[.!?:;…]$/.test(t) ? t : `${t}.`);
  // tira do fim os caracteres de `lixo`, sem regex
  const semFim = (t, lixo) => { let n = t.length; while (n > 0 && lixo.includes(t[n - 1])) n--; return t.slice(0, n); };

  const linhas = [];
  let noBloco = false;
  for (const crua of String(md ?? '').slice(0, ENTRADA_MAX).split('\n')) {
    let l = crua.trim();
    if (l.startsWith('```') || l.startsWith('~~~')) { noBloco = !noBloco; continue; } // bloco de código: fora
    if (noBloco || !l) continue;
    while (l.startsWith('>')) l = l.slice(1).trimStart();                        // citação
    if (/^(?:[-*_] *){3,}$/.test(l)) continue;                                   // linha horizontal
    if (/^[|: -]+$/.test(l) && l.includes('-') && l.includes('|')) continue;     // a linha de --- de tabela
    const titulo = /^#{1,6}(?: |$)/.exec(l);
    const item = /^(?:[-*+]|\d{1,9}[.)]) +/.exec(l);
    // título e item de lista viram frase: sem isso "## Pronto" gruda na linha de baixo
    if (titulo) l = frase(semFim(l.slice(titulo[0].length).trimStart(), '# '));
    else if (item) l = frase(l.slice(item[0].length));
    if (l) linhas.push(l);
  }

  let t = linhas.join(' ')
    .replace(/!?\[([^\]]{0,200})\]\([^)]{0,500}\)/g, '$1')       // link e imagem → o texto
    .replace(/`([^`]{0,200})`/g, '$1')                           // código na linha → o código
    .replace(/(\*\*|__)(?=\S)(.{0,300}?\S)\1/g, '$2')            // negrito
    .replace(/(^|[^\w*])\*(?=\S)([^*]{0,300}?\S)\*(?![\w*])/g, '$1$2') // itálico com * (o _ fica: snake_case)
    .replace(/~~(?=\S)(.{0,300}?\S)~~/g, '$1')                   // riscado
    .replace(/\|/g, ' · ')                                       // colunas de tabela
    .replace(/\s+/g, ' ')
    .replace(/·(?: ?·)+/g, '·')                                  // fim de uma linha da tabela e começo da outra
    .replace(/^[ ·]+|[ ·]+$/g, '');                              // sobra de borda de tabela
  if (t.length > limite) t = t.slice(0, limite - 1).trimEnd() + '…';
  return t;
}

const ENTRADA_MAX = 8000; // caracteres da mensagem final que entram na conta
