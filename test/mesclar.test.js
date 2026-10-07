import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormatoInesperado, HOOKS, chavesCriadas, ehDoXereta, estado, grupo, instalar, remover } from '../src/hooks/mesclar.js';

const OPCOES = { porta: 47321, token: 'a'.repeat(64) };

// o formato do settings.json real: os 4 hooks do vault e outras chaves
const settingsDoVault = () => ({
  model: 'opus',
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: 'vault-inicio' }] }],
    PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'vault-antes' }] }],
    PostToolUse: [
      { matcher: 'Write', hooks: [{ type: 'command', command: 'vault-depois' }] },
      { matcher: 'Edit', hooks: [{ type: 'command', command: 'vault-depois' }] },
    ],
    Stop: [{ hooks: [{ type: 'command', command: 'vault-fim' }] }, { hooks: [{ type: 'command', command: 'vault-semana' }] }],
  },
  theme: 'dark',
});

const doVault = s => Object.fromEntries(Object.entries(s.hooks).map(([ev, gs]) =>
  [ev, gs.filter(g => !g.hooks.some(ehDoXereta))]).filter(([, gs]) => gs.length));

test('instalar põe os 8 hooks e deixa os do vault idênticos', () => {
  const antes = settingsDoVault();
  const depois = instalar(antes, OPCOES);
  assert.deepEqual(doVault(depois), antes.hooks);
  const nossos = Object.values(depois.hooks).flat().flatMap(g => g.hooks).filter(ehDoXereta);
  assert.equal(nossos.length, 8);
  assert.ok(!depois.hooks.SessionStart.some(g => g.hooks.some(ehDoXereta)), 'nada no SessionStart: o Claude Code ignora http ali');
  assert.equal(depois.model, 'opus');
  assert.equal(depois.theme, 'dark');
  assert.deepEqual(antes, settingsDoVault(), 'o objeto recebido não muda');
});

test('os grupos têm a rota, o timeout, o matcher e o token certos', () => {
  const pedido = grupo(HOOKS.find(h => h.evento === 'PermissionRequest'), OPCOES);
  assert.deepEqual(pedido, {
    matcher: '*',
    hooks: [{ type: 'http', url: 'http://127.0.0.1:47321/fontes/claude-code/pedido', headers: { Authorization: `Bearer ${'a'.repeat(64)}` }, timeout: 60 }],
  });
  const inicio = grupo(HOOKS.find(h => h.evento === 'UserPromptSubmit'), OPCOES);
  assert.equal(inicio.matcher, undefined);
  assert.equal(inicio.hooks[0].url, 'http://127.0.0.1:47321/fontes/claude-code/evento');
  assert.equal(inicio.hooks[0].timeout, 2);
  // o PostToolUse em toda ferramenta: solta o pedido respondido no terminal e traz o +N −M (002)
  const depois = grupo(HOOKS.find(h => h.evento === 'PostToolUse'), OPCOES);
  assert.equal(depois.matcher, '*');
  assert.equal(depois.hooks[0].url, 'http://127.0.0.1:47321/fontes/claude-code/evento');
  assert.equal(depois.hooks[0].timeout, 2);
});

test('o PostToolUse do Xereta entra num grupo próprio, ao lado dos do vault', () => {
  const depois = instalar(settingsDoVault(), OPCOES).hooks.PostToolUse;
  assert.equal(depois.length, 3);
  assert.deepEqual(depois.slice(0, 2), settingsDoVault().hooks.PostToolUse);
});

test('rodar duas vezes dá o mesmo que rodar uma', () => {
  const uma = instalar(settingsDoVault(), OPCOES);
  assert.deepEqual(instalar(uma, OPCOES), uma);
});

test('remover devolve exatamente o de antes, também no texto', () => {
  const antes = settingsDoVault();
  const { settings, removidos } = remover(instalar(antes, OPCOES));
  assert.equal(removidos, 8);
  assert.equal(JSON.stringify(settings, null, 2), JSON.stringify(antes, null, 2));
});

test('sem hooks antes: instalar e remover volta a não ter a chave hooks', () => {
  const antes = { model: 'opus' };
  assert.deepEqual(remover(instalar(antes, OPCOES)).settings, antes);
});

test('trocar o token troca os hooks, sem duplicar', () => {
  const velho = instalar(settingsDoVault(), OPCOES);
  const novo = instalar(velho, { ...OPCOES, token: 'b'.repeat(64) });
  const nossos = Object.values(novo.hooks).flat().flatMap(g => g.hooks).filter(ehDoXereta);
  assert.equal(nossos.length, 8);
  assert.ok(nossos.every(h => h.headers.Authorization.endsWith('b'.repeat(64))));
});

test('um grupo misto perde só o hook do Xereta', () => {
  const nosso = grupo(HOOKS[0], OPCOES).hooks[0];
  const antes = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'meu' }, nosso] }] } };
  const { settings } = remover(antes);
  assert.deepEqual(settings, { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'meu' }] }] } });
});

test('ehDoXereta reconhece qualquer porta, e só a ponte local', () => {
  assert.ok(ehDoXereta({ type: 'http', url: 'http://127.0.0.1:50000/fontes/claude-code/evento' }));
  assert.ok(!ehDoXereta({ type: 'http', url: 'http://localhost:47321/fontes/claude-code/evento' }));
  assert.ok(!ehDoXereta({ type: 'http', url: 'http://127.0.0.1:47321/outra/coisa' }));
  assert.ok(!ehDoXereta({ type: 'command', command: 'http://127.0.0.1:47321/fontes/claude-code/evento' }));
  assert.ok(!ehDoXereta(null));
});

test('formato inesperado: recusa sem mexer em nada', () => {
  for (const ruim of [[], { hooks: [] }, { hooks: { Stop: {} } }, { hooks: { Stop: [{ command: 'x' }] } }]) {
    const copia = JSON.parse(JSON.stringify(ruim));
    assert.throws(() => instalar(ruim, OPCOES), FormatoInesperado);
    assert.throws(() => remover(ruim), FormatoInesperado);
    assert.deepEqual(ruim, copia);
  }
});

test('token e porta inválidos são recusados', () => {
  assert.throws(() => instalar({}, { ...OPCOES, token: 'curto' }), /token-invalido/);
  assert.throws(() => instalar({}, { ...OPCOES, token: 'A'.repeat(64) }), /token-invalido/);
  assert.throws(() => instalar({}, { ...OPCOES, porta: 0 }), /porta-invalida/);
});

test('estado: desligado, ligado e diferente', () => {
  assert.equal(estado(settingsDoVault(), OPCOES), 'desligado');
  const ligado = instalar(settingsDoVault(), OPCOES);
  assert.equal(estado(ligado, OPCOES), 'ligado');
  assert.equal(estado(ligado, { ...OPCOES, token: 'b'.repeat(64) }), 'diferente');
  assert.equal(estado(ligado, { ...OPCOES, porta: 50000 }), 'diferente');
  // um hook seu depois dos do Xereta não muda nada
  ligado.hooks.Stop.push({ hooks: [{ type: 'command', command: 'depois' }] });
  assert.equal(estado(ligado, OPCOES), 'ligado');
  // faltando um, é diferente
  delete ligado.hooks.SessionEnd;
  assert.equal(estado(ligado, OPCOES), 'diferente');
});

test('as chaves do hook noutra ordem continuam "ligado", e reinstalar não muda nada', () => {
  const ligado = instalar(settingsDoVault(), OPCOES);
  const invertido = copiaComChavesInvertidas(ligado);
  assert.equal(estado(invertido, OPCOES), 'ligado');
  // a ordem que o instalador grava é a do settings.json real: type, url, timeout, headers
  assert.deepEqual(Object.keys(grupo(HOOKS[0], OPCOES).hooks[0]), ['type', 'url', 'timeout', 'headers']);
  assert.equal(JSON.stringify(instalar(ligado, OPCOES)), JSON.stringify(ligado));
});

function copiaComChavesInvertidas(v) {
  if (Array.isArray(v)) return v.map(copiaComChavesInvertidas);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).reverse().map(k => [k, copiaComChavesInvertidas(v[k])]));
}

test('com a anotação, estruturas vazias que já existiam voltam iguais', () => {
  for (const antes of [{ hooks: {} }, { hooks: { Stop: [] } }, { hooks: { Stop: [], UserPromptSubmit: [] } }, settingsDoVault()]) {
    const criadas = chavesCriadas(antes);
    const { settings } = remover(instalar(antes, OPCOES, criadas), criadas);
    assert.equal(JSON.stringify(settings), JSON.stringify(antes), JSON.stringify(antes));
  }
});

test('chavesCriadas: o que a instalação cria, também depois de instalada sem anotação', () => {
  const antes = settingsDoVault();
  const criadas = chavesCriadas(antes);
  assert.equal(criadas.hooks, false);
  assert.deepEqual(criadas.eventos, ['UserPromptSubmit', 'PostToolUseFailure', 'PermissionRequest', 'StopFailure', 'SessionEnd']);
  assert.deepEqual(chavesCriadas(instalar(antes, OPCOES)), criadas);
  assert.deepEqual(chavesCriadas({}), { hooks: true, eventos: HOOKS.map(h => h.evento) });
});

test('anotação estragada vale como sem anotação', () => {
  const antes = settingsDoVault();
  for (const ruim of [{}, { hooks: 'sim' }, { hooks: true, eventos: [1] }, 'x']) {
    assert.deepEqual(remover(instalar(antes, OPCOES), ruim).settings, antes);
  }
});
