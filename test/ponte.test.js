import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregar } from '../scripts/classico.js';

// A ponte da página com um Tauri de mentira: o `listen` guarda quem ouve, e o `invoke` anota
// cada resposta devolvida ao Rust.
async function montar() {
  let ouvir = null;
  const respostas = [];
  const mudancas = [];
  const window = {
    __TAURI__: {
      core: {
        invoke: async (comando, args) => {
          if (comando === 'responder_pedido') respostas.push({ ...args });
          return comando === 'ligar_ponte' ? 47321 : undefined;
        },
      },
      event: { listen: async (_, f) => { ouvir = f; } },
    },
  };
  const { Ponte } = carregar(
    ['src/textos/pt-BR.js', 'src/adaptadores/claude-code.js', 'src/ponte.js'], ['Ponte'], { window },
  );
  await Ponte.ligar(m => mudancas.push(m));
  const avisar = payload => ouvir({ payload });
  return { Ponte, respostas, mudancas, avisar };
}

const base = { session_id: 's1', cwd: 'C:/korus' };
const ler = arquivo => ({ tool_name: 'Read', tool_input: { file_path: `C:/korus/${arquivo}` } });
const evento = (corpo) => ({ aviso: 'evento', fonte: 'claude-code', corpo: { ...base, ...corpo } });
const pre = (id, f) => evento({ hook_event_name: 'PreToolUse', tool_use_id: id, ...f });
const pos = (id, f) => evento({ hook_event_name: 'PostToolUse', tool_use_id: id, ...f, tool_response: {} });
const pedido = (id, f) => ({ aviso: 'pedido', fonte: 'claude-code', id, corpo: { ...base, hook_event_name: 'PermissionRequest', ...f } });

const ids = Ponte => [...Ponte.abertos].map(p => p.id);

test('três leituras em paralelo: a ferramenta irmã que começa não solta o pedido (07/10)', async () => {
  const { Ponte, respostas, avisar } = await montar();
  // a ordem vista no transcript: o Pre de cada uma, e o pedido dela, intercalados
  avisar(pre('t15', ler('xereta.md')));
  avisar(pedido(1, ler('xereta.md')));
  avisar(pre('t16', ler('diario.md')));
  avisar(pedido(2, ler('diario.md')));
  avisar(pre('t17', ler('hook.md')));
  avisar(pedido(3, ler('hook.md')));
  assert.deepEqual(ids(Ponte), [1, 2, 3], 'os três esperando, na ordem do terminal');
  assert.deepEqual(respostas, [], 'nenhum foi devolvido ao terminal');
  assert.deepEqual([...Ponte.abertos].map(p => p.evento.passoId), ['t15', 't16', 't17']);

  // o t15 foi respondido no terminal e rodou: só o pedido dele sai
  avisar(pos('t15', ler('xereta.md')));
  assert.deepEqual(ids(Ponte), [2, 3]);
  assert.deepEqual(respostas, [{ id: 1, corpo: null }]);

  // o fim do turno encerra o que sobrou
  avisar(evento({ hook_event_name: 'Stop' }));
  assert.deepEqual(ids(Ponte), []);
  assert.deepEqual(respostas.map(r => r.id), [1, 2, 3]);
  assert.ok(respostas.every(r => r.corpo === null), 'nunca allow sem clique');
});

test('o resultado de outra ferramenta não solta o pedido (Codex, 07/10)', async () => {
  const { Ponte, respostas, avisar } = await montar();
  avisar(pre('a', ler('a.md')));
  avisar(pre('b', { tool_name: 'Bash', tool_input: { command: 'git push' } }));
  avisar(pedido(7, { tool_name: 'Bash', tool_input: { command: 'git push' } }));
  avisar(pos('a', ler('a.md')));
  avisar(evento({ hook_event_name: 'PostToolUseFailure', tool_use_id: 'a', tool_name: 'Read' }));
  assert.deepEqual(ids(Ponte), [7]);
  assert.deepEqual(respostas, []);
  // a falha da própria ferramenta solta
  avisar(evento({ hook_event_name: 'PostToolUseFailure', tool_use_id: 'b', tool_name: 'Bash' }));
  assert.deepEqual(ids(Ponte), []);
});

test('duas chamadas iguais em paralelo ficam cada uma com um id', async () => {
  const { Ponte, avisar } = await montar();
  avisar(pre('x1', ler('a.md')));
  avisar(pre('x2', ler('a.md')));
  avisar(pedido(1, ler('a.md')));
  avisar(pedido(2, ler('a.md')));
  assert.deepEqual([...Ponte.abertos].map(p => p.evento.passoId), ['x1', 'x2']);
});

test('pedido sem PreToolUse conhecido: só a sessão mudando o solta', async () => {
  const { Ponte, avisar } = await montar();
  avisar(pedido(1, ler('a.md')));
  assert.equal(Ponte.abertos[0].evento.passoId, undefined);
  avisar(pre('y', ler('b.md')));
  avisar(pos('y', ler('b.md')));
  assert.deepEqual(ids(Ponte), [1]);
  avisar(evento({ hook_event_name: 'UserPromptSubmit' }));
  assert.deepEqual(ids(Ponte), []);
});

test('evento de outra sessão não mexe no pedido', async () => {
  const { Ponte, avisar } = await montar();
  avisar(pre('a', ler('a.md')));
  avisar(pedido(1, ler('a.md')));
  avisar({ ...evento({ hook_event_name: 'Stop' }), corpo: { ...base, session_id: 's2', hook_event_name: 'Stop' } });
  assert.deepEqual(ids(Ponte), [1]);
});

test('a resposta pela ilha vai para o pedido certo, com o JSON do contrato', async () => {
  const { Ponte, respostas, avisar } = await montar();
  avisar(pre('a', ler('a.md')));
  avisar(pedido(1, ler('a.md')));
  avisar(pre('b', ler('b.md')));
  avisar(pedido(2, ler('b.md')));
  await Ponte.responder(2, 'permitir');
  assert.deepEqual(ids(Ponte), [1]);
  assert.equal(respostas.at(-1).id, 2);
  assert.match(respostas.at(-1).corpo, /"behavior":"allow"/);
});
