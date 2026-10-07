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

const base = { session_id: 's1', cwd: 'C:/vitrine' };
const ler = arquivo => ({ tool_name: 'Read', tool_input: { file_path: `C:/vitrine/${arquivo}` } });
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

test('uma chamada idêntica depois de um pedido respondido não herda o id dele (Codex, 07/10)', async () => {
  const { Ponte, respostas, avisar } = await montar();
  const push = { tool_name: 'Bash', tool_input: { command: 'git push' } };
  avisar(pre('a', push));
  avisar(pedido(1, push));
  await Ponte.responder(1, 'permitir'); // A permitida, ainda rodando
  avisar(pre('b', push));
  avisar(pedido(2, push));
  assert.equal(Ponte.abertos[0].evento.passoId, 'b');
  avisar(pos('a', push)); // o resultado de A não solta o pedido de B
  assert.deepEqual(ids(Ponte), [2]);
  assert.equal(respostas.length, 1);
});

test('entrada reescrita por outro hook: vale a única ferramenta igual em curso (Codex, 07/10)', async () => {
  const { Ponte, avisar } = await montar();
  avisar(pre('a', { tool_name: 'Bash', tool_input: { command: 'echo antigo' } }));
  avisar(pre('r', ler('x.md')));
  avisar(pedido(1, { tool_name: 'Bash', tool_input: { command: 'echo novo' } }));
  assert.equal(Ponte.abertos[0].evento.passoId, 'a');
  avisar(pos('a', { tool_name: 'Bash', tool_input: { command: 'echo novo' } }));
  assert.deepEqual(ids(Ponte), []);
});

test('entrada reescrita com duas ferramentas iguais em curso: fica sem id, e a irmã não o solta', async () => {
  const { Ponte, avisar } = await montar();
  avisar(pre('a', { tool_name: 'Bash', tool_input: { command: 'echo 1' } }));
  avisar(pre('b', { tool_name: 'Bash', tool_input: { command: 'echo 2' } }));
  avisar(pedido(1, { tool_name: 'Bash', tool_input: { command: 'echo 3' } }));
  assert.equal(Ponte.abertos[0].evento.passoId, undefined);
  avisar(pos('a', { tool_name: 'Bash', tool_input: { command: 'echo 1' } }));
  assert.deepEqual(ids(Ponte), [1]);
});

test('as entradas que colidiam no hash vão cada uma para a sua ferramenta (Codex, 07/10)', async () => {
  const { Ponte, avisar } = await montar();
  const um = { tool_name: 'Bash', tool_input: { command: 'echo 409ca48055951e46' } };
  const dois = { tool_name: 'Bash', tool_input: { command: 'echo 1005047aa1c99bdf' } };
  avisar(pre('a', um));
  avisar(pre('b', dois));
  avisar(pedido(2, dois));
  assert.equal(Ponte.abertos[0].evento.passoId, 'b');
  avisar(pos('a', um));
  assert.deepEqual(ids(Ponte), [2]);
});

test('ferramentas concluídas não deixam sessões vazias guardadas; no máximo 32 (Codex, 07/10)', async () => {
  const { Ponte, avisar } = await montar();
  for (let i = 0; i < 100; i++) {
    const sessao = { session_id: `s${i}` };
    avisar({ ...pre('a', ler('a.md')), corpo: { ...base, ...sessao, hook_event_name: 'PreToolUse', tool_use_id: 'a', ...ler('a.md') } });
    avisar({ ...pos('a', ler('a.md')), corpo: { ...base, ...sessao, hook_event_name: 'PostToolUse', tool_use_id: 'a', ...ler('a.md'), tool_response: {} } });
  }
  assert.equal(Ponte.sessoesEmCurso, 0);
  for (let i = 0; i < 100; i++) {
    avisar({ ...pre('a', ler('a.md')), corpo: { ...base, session_id: `t${i}`, hook_event_name: 'PreToolUse', tool_use_id: 'a', ...ler('a.md') } });
  }
  assert.equal(Ponte.sessoesEmCurso, 32);
});

test('a pergunta do Claude volta na hora para o terminal e vira aviso na ilha', async () => {
  const { Ponte, respostas, mudancas, avisar } = await montar();
  avisar(pre('q', { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Qual banco?' }] } }));
  avisar(pedido(9, { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Qual banco?' }] } }));
  assert.deepEqual(ids(Ponte), []);
  assert.deepEqual(respostas, [{ id: 9, corpo: null }]);
  assert.equal(mudancas.at(-1).evento.tipo, 'pergunta');
  assert.equal(mudancas.at(-1).evento.resumo, 'Pergunta no terminal: Qual banco?');
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
