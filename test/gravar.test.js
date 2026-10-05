// A gravação do settings.json por dentro, numa pasta temporária.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ArquivoMudou, gravar, limparTemporarios, sha256 } from '../scripts/gravar.js';

const pasta = mkdtempSync(join(tmpdir(), 'xereta-gravar-'));
after(() => rmSync(pasta, { recursive: true, force: true }));
const ARQ = join(pasta, 'settings.json');
const sobras = () => readdirSync(pasta).filter(f => f.endsWith('.tmp'));
const backups = () => readdirSync(pasta).filter(f => f.includes('.bak-'));

test('grava, com backup do conteúdo de antes', () => {
  writeFileSync(ARQ, 'antes\n');
  const r = gravar({ arquivo: ARQ, textoAntes: 'antes\n', textoNovo: 'depois\n', hashDaPrevia: sha256('antes\n'), carimbo: '20261005-000001' });
  assert.equal(readFileSync(ARQ, 'utf8'), 'depois\n');
  assert.equal(readFileSync(r.backup, 'utf8'), 'antes\n');
  assert.equal(r.sobrou, null);
  assert.deepEqual(sobras(), []);
});

test('outro processo grava entre a prévia e a troca: recusa, e a gravação dele fica', () => {
  writeFileSync(ARQ, 'antes\n');
  assert.throws(() => gravar({
    arquivo: ARQ, textoAntes: 'antes\n', textoNovo: 'do xereta\n', hashDaPrevia: sha256('antes\n'), carimbo: '20261005-000002',
    antesDaTroca: () => writeFileSync(ARQ, 'do claude code\n'),
  }), ArquivoMudou);
  assert.equal(readFileSync(ARQ, 'utf8'), 'do claude code\n');
  assert.deepEqual(sobras(), []);
});

test('o arquivo já tinha mudado antes de começar: recusa sem backup nem temporário', () => {
  writeFileSync(ARQ, 'mexido\n');
  const antes = backups().length;
  assert.throws(() => gravar({ arquivo: ARQ, textoAntes: 'antes\n', textoNovo: 'x\n', hashDaPrevia: sha256('antes\n'), carimbo: '20261005-000003' }), ArquivoMudou);
  assert.equal(backups().length, antes);
  assert.deepEqual(sobras(), []);
});

test('dois backups no mesmo segundo não colidem', () => {
  writeFileSync(ARQ, 'a\n');
  const um = gravar({ arquivo: ARQ, textoAntes: 'a\n', textoNovo: 'b\n', hashDaPrevia: sha256('a\n'), carimbo: '20261005-000004' });
  const dois = gravar({ arquivo: ARQ, textoAntes: 'b\n', textoNovo: 'c\n', hashDaPrevia: sha256('b\n'), carimbo: '20261005-000004' });
  assert.notEqual(um.backup, dois.backup);
  assert.equal(readFileSync(dois.backup, 'utf8'), 'b\n');
});

test('limpa só os temporários do Xereta que sobraram de antes', () => {
  writeFileSync(join(pasta, 'settings.json.xereta-999.tmp'), 'token velho');
  writeFileSync(join(pasta, 'settings.json.outro.tmp'), 'não é nosso');
  assert.deepEqual(limparTemporarios(ARQ), []);
  assert.deepEqual(sobras(), ['settings.json.outro.tmp']);
});
