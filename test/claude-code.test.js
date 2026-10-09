import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregar } from '../scripts/classico.js';

const { ADAPTADOR_CLAUDE_CODE: A } = carregar(
  ['src/textos/pt-BR.js', 'src/adaptadores/claude-code.js'],
  ['ADAPTADOR_CLAUDE_CODE'],
);

const base = { session_id: 's1', cwd: 'C:\\Users\\vinic\\projetos\\vitrine' };
const hook = (nome, extra = {}) => A.traduzir({ ...base, hook_event_name: nome, ...extra });

test('cada um dos 9 hooks vira o tipo certo', () => {
  const esperado = {
    SessionStart: 'inicio', UserPromptSubmit: 'pensando', PreToolUse: 'ferramenta', PostToolUse: 'concluiu',
    PostToolUseFailure: 'erro', PermissionRequest: 'permissao', Stop: 'fim', StopFailure: 'erro', SessionEnd: 'saida',
  };
  for (const [nome, tipo] of Object.entries(esperado)) {
    const e = hook(nome, { tool_name: 'Bash', tool_input: { command: 'npm test' } });
    assert.equal(e.tipo, tipo, nome);
    assert.equal(e.fonte, 'claude-code');
    assert.equal(e.sessao, 's1');
    assert.equal(e.projeto, 'vitrine');
  }
});

test('evento desconhecido é ignorado', () => {
  assert.equal(hook('Notification'), null);
  assert.equal(hook(undefined), null);
});

test('o resumo de cada ferramenta', () => {
  const casos = [
    ['Bash', { command: 'npm test' }, 'Rodando npm test'],
    ['PowerShell', { command: 'git status', description: 'x' }, 'Rodando git status'],
    ['Read', { file_path: 'C:\\x\\src\\frete.ts' }, 'Lendo frete.ts'],
    ['Edit', { file_path: '/home/x/frete.ts' }, 'Editando frete.ts'],
    ['Write', { file_path: 'C:\\x\\novo.md' }, 'Escrevendo novo.md'],
    ['Grep', { pattern: 'FRETE' }, 'Procurando FRETE'],
    ['WebFetch', { url: 'https://docs.claude.com/hooks?x=1' }, 'Abrindo docs.claude.com'],
    ['Task', {}, 'Chamando um ajudante'],
    ['FerramentaNova', {}, 'Usando FerramentaNova'],
  ];
  for (const [tool_name, tool_input, resumo] of casos) {
    assert.equal(hook('PreToolUse', { tool_name, tool_input }).resumo, resumo, tool_name);
  }
});

test('comando longo é cortado em 120 caracteres com reticências', () => {
  const r = hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'x'.repeat(300) } }).resumo;
  assert.equal(r.length, 120);
  assert.ok(r.endsWith('…'));
});

test('heredoc: só a primeira linha', () => {
  const r = hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: "cat <<'EOF'\nsegredo\nEOF" } }).resumo;
  assert.equal(r, "Rodando cat <<'EOF'");
});

test('campos que faltam ou vêm nulos não quebram o adaptador', () => {
  assert.doesNotThrow(() => hook('PreToolUse', { tool_name: 'Bash', tool_input: null }));
  assert.doesNotThrow(() => hook('PreToolUse', { tool_name: 'Read' }));
  assert.equal(hook('PreToolUse', { tool_name: 'Bash', tool_input: null }).resumo, 'Rodando');
  assert.equal(A.traduzir({ hook_event_name: 'Stop' }).projeto, undefined);
  assert.equal(A.traduzir({ hook_event_name: 'Stop', cwd: 'C:\\x\\vitrine\\' }).projeto, 'vitrine');
});

test('o pedido diz o verbo e o alvo', () => {
  const pedido = (tool_name, tool_input) => hook('PermissionRequest', { tool_name, tool_input }).pedido;
  assert.deepEqual({ ...pedido('Bash', { command: 'git push origin main' }) }, { verbo: 'rodar', alvo: 'git push origin main' });
  assert.deepEqual({ ...pedido('PowerShell', { command: 'git init -b main', description: 'x' }) }, { verbo: 'rodar', alvo: 'git init -b main' });
  assert.deepEqual({ ...pedido('Bash', { command: "cat <<'EOF'\nsegredo\nEOF" }) }, { verbo: 'rodar', alvo: "cat <<'EOF' …" });
  assert.equal(pedido('Bash', { command: 'x'.repeat(900) }).alvo.length, 500);
  // dentro do projeto: relativo; fora: o caminho inteiro
  assert.deepEqual({ ...pedido('Edit', { file_path: 'C:\\Users\\vinic\\projetos\\vitrine\\src\\frete.ts' }) }, { verbo: 'editar', alvo: 'src/frete.ts' });
  assert.equal(pedido('Write', { file_path: 'c:/users/vinic/projetos/VITRINE/.env' }).alvo, '.env');
  assert.equal(pedido('Write', { file_path: 'C:\\Users\\vinic\\.ssh\\config' }).alvo, 'C:\\Users\\vinic\\.ssh\\config');
  assert.equal(pedido('Write', { file_path: 'C:\\Users\\vinic\\projetos\\vitrine-velho\\a.txt' }).alvo, 'C:\\Users\\vinic\\projetos\\vitrine-velho\\a.txt', 'pasta vizinha com o mesmo começo não é o projeto');
  assert.deepEqual({ ...pedido('FerramentaNova', {}) }, { verbo: 'usar', alvo: 'FerramentaNova' });
  assert.doesNotThrow(() => pedido('Bash', null));
  assert.equal(hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' } }).pedido, undefined);
});

test('a resposta de permissão é exatamente o JSON do contrato', () => {
  assert.equal(A.resposta('permitir'), '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}');
  assert.equal(A.resposta('negar'), '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny"}}}');
});

test('qualquer outra decisão é "sem decisão", nunca allow', () => {
  for (const d of ['noTerminal', '', null, undefined, 'allow', 'constructor', '__proto__', 'toString']) {
    assert.equal(A.resposta(d), null, String(d));
  }
});

// os tool_response reais da 2.1.292 (07/10), com o caminho trocado
const pos = (tool_name, tool_input, tool_response) =>
  hook('PostToolUse', { tool_name, tool_input, tool_response, tool_use_id: 'toolu_1' });

test('o passo leva a ferramenta e o id que liga o antes ao depois', () => {
  const antes = hook('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'C:/x/a.ts' }, tool_use_id: 'toolu_1' });
  assert.equal(antes.ferramenta, 'Edit');
  assert.equal(antes.passoId, 'toolu_1');
  assert.equal(pos('Edit', { file_path: 'C:/x/a.ts' }, {}).passoId, 'toolu_1');
  assert.equal(hook('PostToolUseFailure', { tool_name: 'Bash', tool_use_id: 'toolu_2' }).passoId, 'toolu_2');
  assert.equal(hook('Stop').passoId, undefined);
});

test('+N −M do Edit sai do patch real, também com replace_all', () => {
  const simples = pos('Edit', { file_path: 'C:/p/rep.txt', old_string: 'beta x', new_string: 'beta y', replace_all: false }, {
    filePath: 'C:/p/rep.txt', oldString: 'beta x', newString: 'beta y', originalFile: 'alfa\nbeta x\ngama\n',
    structuredPatch: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [' alfa', '-beta x', '+beta y', ' gama'] }],
    userModified: false, replaceAll: false,
  });
  assert.deepEqual({ ...simples.edicao.conta }, { mais: 1, menos: 1 });
  assert.equal(simples.edicao.caminho, 'C:/p/rep.txt');
  assert.equal(simples.resumo, 'Editando rep.txt');

  const todas = pos('Edit', { file_path: 'C:/p/rep.txt', old_string: ' x', new_string: ' z', replace_all: true }, {
    structuredPatch: [{ lines: [' alfa', ' beta y', ' gama', '-delta x', '-epsilon x', '+delta z', '+epsilon z'] }], replaceAll: true,
  });
  assert.deepEqual({ ...todas.edicao.conta }, { mais: 2, menos: 2 });
});

test('+N −M do Write: arquivo novo é tudo +, por cima de um existente é o patch', () => {
  const novo = pos('Write', { file_path: 'C:/p/novo.txt', content: 'a\nb\nc\n' },
    { type: 'create', filePath: 'C:/p/novo.txt', content: 'a\nb\nc\n', structuredPatch: [], originalFile: null });
  assert.deepEqual({ ...novo.edicao.conta }, { mais: 3, menos: 0 });
  const crlf = pos('Write', { file_path: 'C:/p/w.txt' }, { type: 'create', content: 'a\r\nb', structuredPatch: [] });
  assert.deepEqual({ ...crlf.edicao.conta }, { mais: 2, menos: 0 });
  const vazio = pos('Write', { file_path: 'C:/p/v.txt', content: '' }, { type: 'create', content: '', structuredPatch: [] });
  assert.deepEqual({ ...vazio.edicao.conta }, { mais: 0, menos: 0 });
  const sobre = pos('Write', { file_path: 'C:/p/sobre.txt', content: 'um\ndois\nTRES\nquatro\ncinco\n' }, {
    type: 'update', structuredPatch: [{ lines: [' um', ' dois', '-tres', '+TRES', ' quatro', '+cinco'] }], originalFile: 'um\ndois\ntres\nquatro\n',
  });
  assert.deepEqual({ ...sobre.edicao.conta }, { mais: 2, menos: 1 });
});

test('patch em formato desconhecido fica sem conta, e nada quebra', () => {
  for (const resposta of [undefined, null, 'texto', {}, { structuredPatch: 'x' }]) {
    assert.equal(pos('Edit', { file_path: 'a' }, resposta).edicao.conta, null, JSON.stringify(resposta));
  }
  // linhas estranhas no meio de um patch válido são ignoradas
  const r = pos('Edit', { file_path: 'a' }, { structuredPatch: [null, { lines: [42, '+a', '\\ No newline at end of file'] }] });
  assert.deepEqual({ ...r.edicao.conta }, { mais: 1, menos: 0 });
  assert.doesNotThrow(() => hook('PostToolUse', { tool_name: 'Edit' }));
  assert.equal(hook('PostToolUse', { tool_name: 'Edit' }).edicao.caminho, '');
});

test('o Stop leva a mensagem final crua, ou null', () => {
  assert.equal(hook('Stop', { last_assistant_message: 'Corrigi o **frete**.' }).mensagem, 'Corrigi o **frete**.');
  assert.equal(hook('Stop').mensagem, null);
  assert.equal(hook('Stop', { last_assistant_message: 42 }).mensagem, null);
});

test('PostToolUse de quem não edita é só "concluiu", sem conta', () => {
  const r = hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 'b1', tool_response: { stdout: 'ok' } });
  assert.equal(r.tipo, 'concluiu');
  assert.equal(r.passoId, 'b1');
  assert.equal(r.edicao, undefined);
});

test('a assinatura liga o pedido ao PreToolUse da mesma chamada, e só a ela', () => {
  const entrada = { command: 'git push origin main', description: 'x' };
  const antes = hook('PreToolUse', { tool_name: 'Bash', tool_input: entrada, tool_use_id: 'p1' });
  const pedido = hook('PermissionRequest', { tool_name: 'Bash', tool_input: { ...entrada } });
  assert.equal(pedido.assinatura, antes.assinatura);
  assert.notEqual(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'git push' } }).assinatura, antes.assinatura);
  assert.notEqual(hook('PermissionRequest', { tool_name: 'PowerShell', tool_input: entrada }).assinatura, antes.assinatura);
  // a ordem das chaves não conta (Codex, 07/10)
  const invertida = hook('PermissionRequest', { tool_name: 'Bash', tool_input: { description: 'x', command: 'git push origin main' } });
  assert.equal(invertida.assinatura, antes.assinatura);
  // as duas entradas que colidiam no hash de 32 bits (Codex, 07/10) agora são diferentes
  const a = hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'echo 409ca48055951e46' } });
  const b = hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'echo 1005047aa1c99bdf' } });
  assert.notEqual(a.assinatura, b.assinatura);
  assert.equal(hook('PostToolUse', { tool_name: 'Bash' }).assinatura, undefined);
});

test('a pergunta do Claude (AskUserQuestion) vira aviso, e não pedido', () => {
  const r = hook('PermissionRequest', {
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'Continua a conversa anterior?\nou começa uma nova', header: 'Codex', options: [] }] },
  });
  assert.equal(r.tipo, 'pergunta');
  assert.equal(r.resumo, 'Pergunta no terminal: Continua a conversa anterior?');
  assert.equal(r.pedido, undefined);
  assert.equal(hook('PermissionRequest', { tool_name: 'AskUserQuestion' }).resumo, 'Pergunta no terminal');
  assert.equal(hook('PreToolUse', { tool_name: 'AskUserQuestion', tool_input: {} }).resumo, 'Fazendo uma pergunta');
});

test('pedidos de leitura e busca dizem o arquivo ou a pasta', () => {
  const pedido = (tool_name, tool_input) => hook('PermissionRequest', { tool_name, tool_input }).pedido;
  assert.deepEqual({ ...pedido('Read', { file_path: 'C:\\Users\\vinic\\Documents\\Claude\\CLAUDE.md' }) },
    { verbo: 'ler', alvo: 'C:\\Users\\vinic\\Documents\\Claude\\CLAUDE.md' });
  assert.equal(pedido('Read', { file_path: 'C:\\Users\\vinic\\projetos\\vitrine\\src\\a.ts' }).alvo, 'src/a.ts');
  assert.deepEqual({ ...pedido('Grep', { pattern: 'FRETE', path: 'C:\\Users\\vinic\\Documents\\Claude' }) },
    { verbo: 'procurar', alvo: 'FRETE em C:\\Users\\vinic\\Documents\\Claude' });
  assert.equal(pedido('Glob', { pattern: '**/*.md' }).alvo, '**/*.md');
});

test('a Skill diz qual é', () => {
  assert.equal(hook('PreToolUse', { tool_name: 'Skill', tool_input: { skill: 'codex:rescue', args: 'x' } }).resumo, 'Usando a skill codex:rescue');
  assert.equal(hook('PreToolUse', { tool_name: 'Skill', tool_input: {} }).resumo, 'Usando uma skill');
});

test('as ferramentas de busca vêm marcadas como procura (o gato fica procurando)', () => {
  for (const nome of ['Grep', 'Glob', 'WebSearch', 'WebFetch']) {
    assert.equal(hook('PreToolUse', { tool_name: nome, tool_input: {} }).procura, true, nome);
    assert.equal(hook('PostToolUse', { tool_name: nome, tool_input: {} }).procura, true, nome);
  }
  for (const nome of ['Bash', 'Read', 'Edit']) assert.equal(hook('PreToolUse', { tool_name: nome, tool_input: {} }).procura, undefined, nome);
});

test('um Bash de teste que terminou bem vem marcado como teste (a cara 👌, D13)', () => {
  const bash = (nome, command) => hook(nome, { tool_name: 'Bash', tool_input: { command }, tool_use_id: 't' });
  for (const c of ['npm test', 'cd src-tauri && cargo test', 'node --test test/', 'npm run test -- --watch=false',
    'pytest -q', 'python -m pytest', 'npx vitest run', 'go test ./...', 'dotnet test', 'flutter test', 'pnpm test',
    'CI=1 npm test', 'npx jest', 'yarn jest --ci', 'npm test 2>&1 | tail -3', 'npm run lint; npm test', './gradlew test']) {
    assert.equal(bash('PostToolUse', c).teste, true, c);
  }
  // falar de teste não é rodar teste (Codex, 09/10)
  for (const c of ['git status', 'npm install', 'cat test/gato.test.js', 'npm run build', 'echo testes',
    'echo npm test', 'pip install pytest', 'npm install jest', 'grep -n "cargo test" README.md']) {
    assert.equal(bash('PostToolUse', c).teste, undefined, c);
  }
  // só no resultado: começar a rodar ou falhar não é o verde
  assert.equal(bash('PreToolUse', 'npm test').teste, undefined);
  assert.equal(bash('PostToolUseFailure', 'npm test').teste, undefined);
  assert.equal(hook('PostToolUse', { tool_name: 'Read', tool_input: { command: 'npm test' } }).teste, undefined);
  // linear: um comando enorme passa rápido
  const t0 = performance.now();
  bash('PostToolUse', 'npm '.repeat(50_000) + 'x');
  assert.ok(performance.now() - t0 < 50);
});

test('StopFailure de rate_limit vira o limite de uso; outro motivo é o erro de sempre', () => {
  const limite = hook('StopFailure', { error_type: 'rate_limit' });
  assert.equal(limite.tipo, 'erro');
  assert.equal(limite.motivo, 'limite');
  assert.equal(limite.resumo, 'Bati no limite de uso');
  const outro = hook('StopFailure', { error_type: 'server_error' });
  assert.equal(outro.motivo, undefined);
  assert.equal(outro.resumo, 'Parou com erro');
  assert.equal(hook('StopFailure').motivo, undefined);
});
