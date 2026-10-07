import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contar, diffLinhas, linhas, trechos } from '../src/diff.js';

test('textos iguais não têm mudança', () => {
  const ops = diffLinhas('a\nb\nc\n', 'a\nb\nc\n');
  assert.deepEqual(contar(ops), { mais: 0, menos: 0 });
  assert.equal(trechos(ops).length, 0);
});

test('CRLF e LF contam como o mesmo texto', () => {
  assert.deepEqual(contar(diffLinhas('a\r\nb\r\n', 'a\nb\n')), { mais: 0, menos: 0 });
});

test('uma linha trocada é −1 +1, com os números de linha certos', () => {
  const ops = diffLinhas('const FRETE = 0.196;\nfim\n', 'const FRETE = 0.20;\nfim\n');
  assert.deepEqual(contar(ops), { mais: 1, menos: 1 });
  assert.deepEqual(ops.find(o => o.tipo === '-'), { tipo: '-', texto: 'const FRETE = 0.196;', a: 1, b: null });
  assert.deepEqual(ops.find(o => o.tipo === '+'), { tipo: '+', texto: 'const FRETE = 0.20;', a: null, b: 1 });
});

test('inserir no meio não marca o resto como mudado', () => {
  const ops = diffLinhas('1\n2\n3\n4\n', '1\n2\nnovo\n3\n4\n');
  assert.deepEqual(contar(ops), { mais: 1, menos: 0 });
  assert.equal(ops.at(-1).a, 4);
  assert.equal(ops.at(-1).b, 5);
});

test('arquivo novo é tudo +', () => {
  assert.deepEqual(contar(diffLinhas('', 'a\nb\nc')), { mais: 3, menos: 0 });
  assert.deepEqual(linhas(''), []);
});

test('mudanças longe uma da outra viram dois trechos, com contexto', () => {
  const antes = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
  const depois = antes.replace('l2\n', 'X\n').replace('l17\n', 'Y\n');
  const t = trechos(diffLinhas(antes, depois), 2);
  assert.equal(t.length, 2);
  assert.equal(t[0][0].texto, 'l0');
  assert.ok(t[0].some(o => o.tipo === '+' && o.texto === 'X'));
});
