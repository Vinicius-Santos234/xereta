// O instalador de ponta a ponta, numa pasta temporária: nunca toca o settings.json de verdade.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/hooks.js', import.meta.url));
const TOKEN = 'c'.repeat(64);
const pasta = mkdtempSync(join(tmpdir(), 'xereta-hooks-'));
after(() => rmSync(pasta, { recursive: true, force: true }));

const SETTINGS = join(pasta, 'settings.json');
const CONFIG = join(pasta, 'config.json');
writeFileSync(CONFIG, JSON.stringify({ porta: 47321, token: TOKEN, esperaPedidoSegundos: 5 }));

const ORIGINAL = JSON.stringify({
  model: 'opus',
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: 'vault-inicio' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'vault-fim' }] }],
  },
  theme: 'dark',
}, null, 2) + '\n';

function rodar(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, XERETA_SETTINGS: SETTINGS, XERETA_CONFIG: CONFIG },
    encoding: 'utf8',
  });
  return { codigo: r.status, saida: r.stdout + r.stderr };
}
const codigoDa = saida => saida.match(/prévia: ([0-9a-f]{12})/)[1];
const backups = () => readdirSync(pasta).filter(f => f.includes('.bak-'));
const temporarios = () => readdirSync(pasta).filter(f => f.endsWith('.tmp'));

test('instalar, de novo, estado e remover', () => {
  writeFileSync(SETTINGS, ORIGINAL);

  const previa = rodar('instalar', '--sim');
  assert.equal(previa.codigo, 0);
  assert.equal(readFileSync(SETTINGS, 'utf8'), ORIGINAL, '--sim não grava');
  assert.ok(!previa.saida.includes(TOKEN), 'o token não aparece inteiro na prévia');
  assert.ok(previa.saida.includes('cccc…'));

  const gravou = rodar('instalar', '--confirmar', codigoDa(previa.saida));
  assert.equal(gravou.codigo, 0, gravou.saida);
  assert.match(gravou.saida, /sessão nova/);
  assert.equal(backups().length, 1);
  assert.equal(readFileSync(join(pasta, backups()[0]), 'utf8'), ORIGINAL, 'o backup é o arquivo de antes');
  const instalado = readFileSync(SETTINGS, 'utf8');
  const j = JSON.parse(instalado);
  assert.deepEqual(j.hooks.SessionStart[0], { hooks: [{ type: 'command', command: 'vault-inicio' }] });
  assert.deepEqual(j.hooks.Stop[0], { hooks: [{ type: 'command', command: 'vault-fim' }] });

  const deNovo = rodar('instalar', '--sim');
  assert.equal(deNovo.codigo, 0);
  assert.match(deNovo.saida, /Nada a fazer/);
  assert.equal(readFileSync(SETTINGS, 'utf8'), instalado);

  assert.match(rodar('estado').saida, /Ligado/);

  const remocao = rodar('remover', '--sim');
  const removeu = rodar('remover', '--confirmar', codigoDa(remocao.saida));
  assert.equal(removeu.codigo, 0, removeu.saida);
  assert.equal(readFileSync(SETTINGS, 'utf8'), ORIGINAL, 'remover devolve o arquivo byte a byte');
  assert.match(rodar('estado').saida, /Desligado/);
  assert.deepEqual(temporarios(), []);
});

test('recusa se o arquivo mudou depois da prévia', () => {
  writeFileSync(SETTINGS, ORIGINAL);
  const codigo = codigoDa(rodar('instalar', '--sim').saida);
  const mexido = ORIGINAL.replace('"dark"', '"light"');
  writeFileSync(SETTINGS, mexido); // o Claude Code (ou você) mexeu no arquivo no meio
  const r = rodar('instalar', '--confirmar', codigo);
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /mudou desde a prévia/);
  assert.equal(readFileSync(SETTINGS, 'utf8'), mexido, 'nada foi gravado');
  assert.deepEqual(temporarios(), []);
});

test('código errado é recusado; sem terminal e sem código não grava', () => {
  writeFileSync(SETTINGS, ORIGINAL);
  assert.equal(rodar('instalar', '--confirmar', '000000000000').codigo, 1);
  assert.equal(rodar('instalar').codigo, 1);
  assert.equal(readFileSync(SETTINGS, 'utf8'), ORIGINAL);
});

test('formato inesperado e uso errado', () => {
  writeFileSync(SETTINGS, '{"hooks": []}\n');
  const r = rodar('instalar', '--sim');
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /formato que eu não conheço/);
  assert.equal(rodar('outra-coisa').codigo, 2);
});

test('CRLF: sem nada a remover não grava; instalar e remover devolve o arquivo byte a byte', () => {
  const crlf = ORIGINAL.replace(/\n/g, '\r\n');
  writeFileSync(SETTINGS, crlf);
  const nada = rodar('remover', '--sim');
  assert.equal(nada.codigo, 0);
  assert.match(nada.saida, /Nada a fazer/);
  const instalou = rodar('instalar', '--confirmar', codigoDa(rodar('instalar', '--sim').saida));
  assert.equal(instalou.codigo, 0, instalou.saida);
  assert.ok(!/[^\r]\n/.test(readFileSync(SETTINGS, 'utf8')), 'continua todo em CRLF');
  assert.equal(rodar('remover', '--confirmar', codigoDa(rodar('remover', '--sim').saida)).codigo, 0);
  assert.equal(readFileSync(SETTINGS, 'utf8'), crlf);
});

test('trocar o token não mostra nem o token novo nem o antigo', () => {
  const ANTIGO = 'd'.repeat(64);
  writeFileSync(SETTINGS, ORIGINAL);
  writeFileSync(CONFIG, JSON.stringify({ porta: 47321, token: ANTIGO, esperaPedidoSegundos: 5 }));
  rodar('instalar', '--confirmar', codigoDa(rodar('instalar', '--sim').saida));
  writeFileSync(CONFIG, JSON.stringify({ porta: 47321, token: TOKEN, esperaPedidoSegundos: 5 }));
  const troca = rodar('instalar', '--sim');
  assert.ok(troca.saida.includes('dddd…') && troca.saida.includes('cccc…'), troca.saida);
  assert.ok(!troca.saida.includes(ANTIGO) && !troca.saida.includes(TOKEN));
});

test('estruturas vazias que já existiam voltam iguais, pela anotação', () => {
  const comVazios = JSON.stringify({ model: 'opus', hooks: { Stop: [], SessionStart: [{ hooks: [{ type: 'command', command: 'vault' }] }] } }, null, 2) + '\n';
  writeFileSync(SETTINGS, comVazios);
  assert.equal(rodar('instalar', '--confirmar', codigoDa(rodar('instalar', '--sim').saida)).codigo, 0);
  const anotacao = JSON.parse(readFileSync(join(pasta, 'instalacao.json'), 'utf8'))[SETTINGS];
  assert.equal(anotacao.hooks, false);
  assert.ok(!anotacao.eventos.includes('Stop'), 'o Stop já existia');
  assert.equal(rodar('remover', '--confirmar', codigoDa(rodar('remover', '--sim').saida)).codigo, 0);
  assert.equal(readFileSync(SETTINGS, 'utf8'), comVazios, 'o "Stop": [] continua lá');
  assert.equal(JSON.parse(readFileSync(join(pasta, 'instalacao.json'), 'utf8'))[SETTINGS], undefined);
});

test('remover sem settings.json não cria arquivo', () => {
  rmSync(SETTINGS, { force: true });
  const r = rodar('remover', '--sim');
  assert.equal(r.codigo, 0);
  assert.match(r.saida, /Nada a fazer/);
  assert.ok(!readdirSync(pasta).includes('settings.json'));
});

test('sem settings.json: instalar cria o arquivo, sem backup', () => {
  rmSync(SETTINGS, { force: true });
  const antes = backups().length;
  const codigo = codigoDa(rodar('instalar', '--sim').saida);
  assert.equal(rodar('instalar', '--confirmar', codigo).codigo, 0);
  assert.equal(backups().length, antes);
  assert.equal(Object.keys(JSON.parse(readFileSync(SETTINGS, 'utf8')).hooks).length, 7);
});
