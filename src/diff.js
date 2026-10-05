// Diff de linhas, sem I/O. O instalador dos hooks (E3) mostra com ele a prévia do settings.json;
// a 002 conta o +N −M de cada edição e a 003 mostra o diff do pedido com o mesmo código.
// Módulo ES: o Node e as páginas com <script type="module"> importam direto.

/** Linhas de um texto, sem a quebra do fim. CRLF e LF contam igual. */
export const linhas = texto => (texto === '' ? [] : String(texto).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'));

/**
 * Compara dois textos linha a linha.
 * Devolve uma lista de { tipo: ' ' | '-' | '+', texto, a, b } (a e b: número da linha em cada
 * lado, a partir de 1; null quando a linha não existe daquele lado).
 */
export function diffLinhas(antes, depois) {
  const A = linhas(antes), B = linhas(depois);

  // começo e fim iguais saem antes da conta: quase toda mudança real é pequena e localizada
  let ini = 0;
  while (ini < A.length && ini < B.length && A[ini] === B[ini]) ini++;
  let fimA = A.length, fimB = B.length;
  while (fimA > ini && fimB > ini && A[fimA - 1] === B[fimB - 1]) { fimA--; fimB--; }

  // maior subsequência comum do miolo (tabela de baixo para cima)
  const n = fimA - ini, m = fimB - ini;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = A[ini + i] === B[ini + j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  for (let k = 0; k < ini; k++) ops.push({ tipo: ' ', texto: A[k], a: k + 1, b: k + 1 });
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[ini + i] === B[ini + j]) {
      ops.push({ tipo: ' ', texto: A[ini + i], a: ini + i + 1, b: ini + j + 1 }); i++; j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops.push({ tipo: '+', texto: B[ini + j], a: null, b: ini + j + 1 }); j++;
    } else {
      ops.push({ tipo: '-', texto: A[ini + i], a: ini + i + 1, b: null }); i++;
    }
  }
  for (let k = 0; k < A.length - fimA; k++) {
    ops.push({ tipo: ' ', texto: A[fimA + k], a: fimA + k + 1, b: fimB + k + 1 });
  }
  return ops;
}

/** Quantas linhas entram e saem: o "+N −M". */
export function contar(ops) {
  let mais = 0, menos = 0;
  for (const o of ops) { if (o.tipo === '+') mais++; else if (o.tipo === '-') menos++; }
  return { mais, menos };
}

/** Agrupa as mudanças em trechos, cada um com `contexto` linhas iguais em volta. */
export function trechos(ops, contexto = 3) {
  const mudou = ops.map(o => o.tipo !== ' ');
  const resultado = [];
  let atual = null;
  ops.forEach((o, k) => {
    const perto = mudou.slice(Math.max(0, k - contexto), k + contexto + 1).some(Boolean);
    if (!perto) { atual = null; return; }
    if (!atual) { atual = []; resultado.push(atual); }
    atual.push(o);
  });
  return resultado;
}
