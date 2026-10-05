// Os hooks do Xereta dentro do settings.json do Claude Code (D14), sem I/O: tudo recebe e devolve
// objetos. Quem lê e grava o arquivo é o scripts/hooks.js (E3) e, na 005, a janela de
// configurações. Os hooks que não são do Xereta (os do vault, por exemplo) nunca são tocados.

/**
 * Os hooks da §4 da 001: evento do Claude Code, rota da ponte e se casa todas as ferramentas.
 * Sem o SessionStart: o Claude Code ignora hook http nele (e no Setup), visto em 05/10 na 2.1.289.
 * A sessão aparece na ilha no primeiro UserPromptSubmit.
 */
export const HOOKS = [
  { evento: 'UserPromptSubmit', rota: 'evento' },
  { evento: 'PreToolUse', rota: 'evento', todasAsFerramentas: true },
  { evento: 'PostToolUseFailure', rota: 'evento', todasAsFerramentas: true },
  { evento: 'PermissionRequest', rota: 'pedido', todasAsFerramentas: true },
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
export function grupo({ evento, rota, todasAsFerramentas }, { porta, token }) {
  const hook = {
    type: 'http',
    url: `http://127.0.0.1:${porta}/fontes/claude-code/${rota}`,
    // o token vai literal, e não como $VARIAVEL: variável nova não chega a um Claude Code já aberto (D5)
    headers: { Authorization: `Bearer ${token}` },
    timeout: TIMEOUT[rota],
  };
  return todasAsFerramentas ? { matcher: '*', hooks: [hook] } : { hooks: [hook] };
}

/** Tira os hooks do Xereta. Devolve { settings, removidos }; o objeto recebido não muda. */
export function remover(original) {
  conferir(original);
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
    // a chave do evento só some se fomos nós que a esvaziamos. Limitação: um evento que já
    // existia como lista vazia ("Stop": []) também some depois de instalar e remover
    // (depois de instalar, não há como saber que ele existia).
    if (restantes.length === 0 && grupos.length > 0) delete settings.hooks[evento];
    else settings.hooks[evento] = restantes;
  }
  if (removidos > 0 && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return { settings, removidos };
}

/** Põe os hooks do Xereta, trocando os antigos. Rodar duas vezes dá o mesmo resultado. */
export function instalar(original, opcoes) {
  if (!/^[0-9a-f]{64}$/.test(String(opcoes.token))) throw new Error('token-invalido');
  if (!Number.isInteger(opcoes.porta) || opcoes.porta < 1 || opcoes.porta > 65535) throw new Error('porta-invalida');
  const { settings } = remover(original);
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
  // cada hook do Xereta encontrado, como "evento|matcher|hook"
  const achados = Object.entries(settings.hooks ?? {}).flatMap(([evento, grupos]) =>
    grupos.flatMap(g => g.hooks.filter(ehDoXereta).map(h => `${evento}|${g.matcher ?? ''}|${JSON.stringify(h)}`)));
  if (achados.length === 0) return 'desligado';
  const esperados = HOOKS.map(h => {
    const g = grupo(h, opcoes);
    return `${h.evento}|${g.matcher ?? ''}|${JSON.stringify(g.hooks[0])}`;
  });
  const iguais = achados.length === esperados.length && esperados.every(e => achados.includes(e));
  return iguais ? 'ligado' : 'diferente';
}
