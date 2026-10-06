import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregar } from '../scripts/classico.js';

const { ADAPTADOR_CLAUDE_CODE: A } = carregar(
  ['src/textos/pt-BR.js', 'src/adaptadores/claude-code.js'],
  ['ADAPTADOR_CLAUDE_CODE'],
);

const base = { session_id: 's1', cwd: 'C:\\Users\\vinic\\projetos\\korus' };
const hook = (nome, extra = {}) => A.traduzir({ ...base, hook_event_name: nome, ...extra });

test('cada um dos 8 hooks vira o tipo certo', () => {
  const esperado = {
    SessionStart: 'inicio', UserPromptSubmit: 'pensando', PreToolUse: 'ferramenta',
    PostToolUseFailure: 'erro', PermissionRequest: 'permissao', Stop: 'fim', StopFailure: 'erro', SessionEnd: 'saida',
  };
  for (const [nome, tipo] of Object.entries(esperado)) {
    const e = hook(nome, { tool_name: 'Bash', tool_input: { command: 'npm test' } });
    assert.equal(e.tipo, tipo, nome);
    assert.equal(e.fonte, 'claude-code');
    assert.equal(e.sessao, 's1');
    assert.equal(e.projeto, 'korus');
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
    ['Read', { file_path: 'C:\\x\\src\\billing.ts' }, 'Lendo billing.ts'],
    ['Edit', { file_path: '/home/x/billing.ts' }, 'Editando billing.ts'],
    ['Write', { file_path: 'C:\\x\\novo.md' }, 'Escrevendo novo.md'],
    ['Grep', { pattern: 'TVA' }, 'Procurando TVA'],
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
  assert.equal(A.traduzir({ hook_event_name: 'Stop', cwd: 'C:\\x\\korus\\' }).projeto, 'korus');
});

test('o pedido diz o verbo e o alvo', () => {
  const pedido = (tool_name, tool_input) => hook('PermissionRequest', { tool_name, tool_input }).pedido;
  assert.deepEqual({ ...pedido('Bash', { command: 'git push origin main' }) }, { verbo: 'rodar', alvo: 'git push origin main' });
  assert.deepEqual({ ...pedido('PowerShell', { command: 'git init -b main', description: 'x' }) }, { verbo: 'rodar', alvo: 'git init -b main' });
  assert.deepEqual({ ...pedido('Bash', { command: "cat <<'EOF'\nsegredo\nEOF" }) }, { verbo: 'rodar', alvo: "cat <<'EOF' …" });
  assert.equal(pedido('Bash', { command: 'x'.repeat(900) }).alvo.length, 500);
  // dentro do projeto: relativo; fora: o caminho inteiro
  assert.deepEqual({ ...pedido('Edit', { file_path: 'C:\\Users\\vinic\\projetos\\korus\\src\\billing.ts' }) }, { verbo: 'editar', alvo: 'src/billing.ts' });
  assert.equal(pedido('Write', { file_path: 'c:/users/vinic/projetos/KORUS/.env' }).alvo, '.env');
  assert.equal(pedido('Write', { file_path: 'C:\\Users\\vinic\\.ssh\\config' }).alvo, 'C:\\Users\\vinic\\.ssh\\config');
  assert.equal(pedido('Write', { file_path: 'C:\\Users\\vinic\\projetos\\korus-velho\\a.txt' }).alvo, 'C:\\Users\\vinic\\projetos\\korus-velho\\a.txt', 'pasta vizinha com o mesmo começo não é o projeto');
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
