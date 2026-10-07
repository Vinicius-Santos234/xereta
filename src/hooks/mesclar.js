// Os hooks do Xereta dentro do settings.json do Claude Code (D14), sem I/O: tudo recebe e devolve
// objetos. Quem lê e grava o arquivo é o scripts/hooks.js (E3) e, na 005, a janela de
// configurações. Os hooks que não são do Xereta (os do vault, por exemplo) nunca são tocados.

/**
 * Os hooks da §4 da 001: evento do Claude Code, rota da ponte e quais ferramentas casam.
 * Sem o SessionStart: o Claude Code ignora hook http nele (e no Setup), visto em 05/10 na 2.1.289.
 * A sessão aparece na ilha no primeiro UserPromptSubmit.
 * O PostToolUse (D2 e D3 da 002): o resultado de cada ferramenta, com o id dela. Solta o pedido
 * respondido no terminal e, nas edições, traz o patch real, de onde sai o +N −M.
 */
export const HOOKS = [
  { evento: 'UserPromptSubmit', rota: 'evento' },
  { evento: 'PreToolUse', rota: 'evento', matcher: '*' },
  { evento: 'PostToolUse', rota: 'evento', matcher: '*' },
  { evento: 'PostToolUseFailure', rota: 'evento', matcher: '*' },
  { evento: 'PermissionRequest', rota: 'pedido', matcher: '*' },
  { evento: 'Stop', rota: 'evento' },
  { evento: 'StopFailure', rota: 'evento' },
  { evento: 'SessionEnd', rota: 'evento' },
];

// status não pode atrasar o Claude Code (D8); o pedido espera o clique com folga (D7)
const TIMEOUT = { evento: 2, pedido: 60 };

const ROTA_DO_XERETA = /^http:\/\/127\.0\.0\.1:\d+\/fontes\/claude-code\/(evento|pedido)$/;

/** Um hook é do Xereta se aponta para a ponte local. Vale para qualquer porta e token. */
export const ehDoXereta = hook =>
  hook !== null && typeof hook === 'object' && hook.type === 'http' && ROTA_DO_XERETA.test(String(hook.url));

export class FormatoInesperado extends Error {
  constructor(caminho) { super(`formato inesperado em ${caminho}`); this.caminho = caminho; }
}

const ehObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const copiar = v => JSON.parse(JSON.stringify(v));
// JSON com as chaves em ordem: dois hooks iguais com as chaves noutra ordem dão o mesmo texto
const canonico = v => JSON.stringify(v, (_, x) =>
  (ehObjeto(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

// confere o formato antes de mexer: o que não for do jeito esperado fica intocado
function conferir(settings) {
  if (!ehObjeto(settings)) throw new FormatoInesperado('(raiz)');
  if (settings.hooks === undefined) return;
  if (!ehObjeto(settings.hooks)) throw new FormatoInesperado('hooks');
  for (const [evento, grupos] of Object.entries(settings.hooks)) {
    if (!Array.isArray(grupos)) throw new FormatoInesperado(`hooks.${evento}`);
    grupos.forEach((g, i) => {
      if (!ehObjeto(g) || !Array.isArray(g.hooks)) throw new FormatoInesperado(`hooks.${evento}[${i}]`);
    });
  }
}

/** O grupo de um hook do Xereta, exatamente como vai para o settings.json. */
export function grupo({ rota, matcher }, { porta, token }) {
  // na ordem de chaves em que o settings.json real ficou (07/10): reinstalar sem mudança não
  // mostra nada na prévia
  const hook = {
    type: 'http',
    url: `http://127.0.0.1:${porta}/fontes/claude-code/${rota}`,
    timeout: TIMEOUT[rota],
    // o token vai literal, e não como $VARIAVEL: variável nova não chega a um Claude Code já aberto (D5)
    headers: { Authorization: `Bearer ${token}` },
  };
  return matcher ? { matcher, hooks: [hook] } : { hooks: [hook] };
}

// `criadas` diz quais chaves o próprio Xereta criou ao instalar: { hooks: bool, eventos: [nomes] }.
// O instalador guarda isso fora do settings.json (instalacao.json). Sem essa anotação, vale o
// palpite: uma chave que ficou vazia porque tiramos os nossos hooks foi criada por nós.
const anotacaoValida = c => c !== null && typeof c === 'object' && typeof c.hooks === 'boolean' &&
  Array.isArray(c.eventos) && c.eventos.every(e => typeof e === 'string');

/** Tira os hooks do Xereta. Devolve { settings, removidos }; o objeto recebido não muda. */
export function remover(original, criadas = null) {
  conferir(original);
  const anotacao = anotacaoValida(criadas) ? criadas : null;
  const settings = copiar(original);
  let removidos = 0;
  if (!settings.hooks) return { settings, removidos };
  for (const [evento, grupos] of Object.entries(settings.hooks)) {
    const restantes = [];
    for (const g of grupos) {
      const outros = g.hooks.filter(h => !ehDoXereta(h));
      removidos += g.hooks.length - outros.length;
      if (outros.length === g.hooks.length) restantes.push(g);         // grupo intocado
      else if (outros.length > 0) restantes.push({ ...g, hooks: outros }); // sobrou hook de outro
    }
    // a chave do evento só some se fomos nós que a criamos (um "Stop": [] que já existia fica)
    const esvaziamos = restantes.length === 0 && grupos.length > 0;
    const criadaPorNos = anotacao ? anotacao.eventos.includes(evento) : true;
    if (esvaziamos && criadaPorNos) delete settings.hooks[evento];
    else settings.hooks[evento] = restantes;
  }
  const hooksCriadoPorNos = anotacao ? anotacao.hooks : true;
  if (removidos > 0 && hooksCriadoPorNos && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return { settings, removidos };
}

/** Quais chaves `instalar` vai criar (ou criou, se já há uma anotação): guardar para remover. */
export function chavesCriadas(original, criadas = null) {
  const { settings: base } = remover(original, criadas);
  return {
    hooks: base.hooks === undefined,
    eventos: HOOKS.map(h => h.evento).filter(evento => base.hooks?.[evento] === undefined),
  };
}

/** Põe os hooks do Xereta, trocando os antigos. Rodar duas vezes dá o mesmo resultado. */
export function instalar(original, opcoes, criadas = null) {
  if (!/^[0-9a-f]{64}$/.test(String(opcoes.token))) throw new Error('token-invalido');
  if (!Number.isInteger(opcoes.porta) || opcoes.porta < 1 || opcoes.porta > 65535) throw new Error('porta-invalida');
  const { settings } = remover(original, criadas);
  settings.hooks ??= {};
  for (const h of HOOKS) {
    settings.hooks[h.evento] ??= [];
    settings.hooks[h.evento].push(grupo(h, opcoes));
  }
  return settings;
}

/**
 * 'desligado' (nenhum hook do Xereta), 'ligado' (todos, com a porta e o token atuais) ou
 * 'diferente' (há hooks do Xereta, mas não são exatamente os esperados).
 */
export function estado(settings, opcoes) {
  conferir(settings);
  // cada hook do Xereta encontrado, como "evento|matcher|hook"; a ordem das chaves não conta
  const achados = Object.entries(settings.hooks ?? {}).flatMap(([evento, grupos]) =>
    grupos.flatMap(g => g.hooks.filter(ehDoXereta).map(h => `${evento}|${g.matcher ?? ''}|${canonico(h)}`)));
  if (achados.length === 0) return 'desligado';
  const esperados = HOOKS.map(h => {
    const g = grupo(h, opcoes);
    return `${h.evento}|${g.matcher ?? ''}|${canonico(g.hooks[0])}`;
  });
  const iguais = achados.length === esperados.length && esperados.every(e => achados.includes(e));
  return iguais ? 'ligado' : 'diferente';
}
