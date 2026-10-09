import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregar } from '../scripts/classico.js';

// O motor do gato sem tela: um canvas de mentira, cujo contexto aceita qualquer chamada. Aqui só
// se testa o comportamento (estados, momentos, patadinha); o desenho se confere no protótipo.
const contexto = new Proxy({}, { get: () => () => contexto });
const canvas = () => ({
  getContext: () => contexto,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 110 }),
});
// quantos gradientes e Path2D o desenho cria (cada um segura memória nativa no WebView2)
const criados = { gradientes: 0, caminhos: 0 };
const contando = new Proxy({}, {
  get: (_, nome) => (nome === 'createLinearGradient' || nome === 'createRadialGradient'
    ? () => { criados.gradientes++; return contando; }
    : () => contando),
});
class Path2D { constructor() { criados.caminhos++; } moveTo() {} lineTo() {} arcTo() {} bezierCurveTo() {} closePath() {} }
const { Gato, criarVigiaDePatada, mascote, ESTADOS, MOMENTOS, TEXTOS } = carregar(
  ['src/textos/pt-BR.js', 'src/mascote/gato.js'],
  ['Gato', 'criarVigiaDePatada', 'mascote', 'ESTADOS', 'MOMENTOS', 'TEXTOS'],
  {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    window: { devicePixelRatio: 1 },
    setTimeout: () => 0,
    Path2D,
  },
);

// o relógio dos cliques, de mentira: o `passar` o adianta junto com o gato
let agora = 0;
const novo = (estado = 'parado', opcoes = {}) => new Gato(canvas(), { estado, relogio: () => agora, ...opcoes });
// o tempo passa em passos de 1/60 s, como no laço da ilha
const passar = (g, s) => { for (let t = 0; t < s; t += 1 / 60) g.atualizar(1 / 60); agora += s; };

test('todo estado e todo momento têm texto (o menu de teste da bandeja usa todos)', () => {
  for (const e of Object.keys(ESTADOS)) assert.ok(TEXTOS.estados[e]?.pilula, e);
  for (const m of Object.keys(MOMENTOS)) assert.ok(TEXTOS.momentos[m]?.rotulo, m);
});

test('sair do cochilo é com susto, e só depois o estado novo', () => {
  const g = novo('cochilo');
  g.mudarEstado('pensando');
  assert.equal(g.estado, 'susto');
  assert.equal(g.base, 'pensando');
  passar(g, .5);
  assert.equal(g.estado, 'pensando');
});

test('com "reduzir movimento", acorda sem susto e não dá patadinha', () => {
  mascote.reduzirMovimento = true;
  try {
    const g = novo('cochilo');
    g.mudarEstado('pensando');
    assert.equal(g.estado, 'pensando');
    assert.equal(g.patada(1), false);
  } finally {
    mascote.reduzirMovimento = false;
  }
});

test('um estado comum espera o momento acabar; um pedido o corta na hora', () => {
  const avisos = [];
  const g = novo('trabalhando', { aoMomento: n => avisos.push(n) });
  g.reagir('tonto');
  g.mudarEstado('procurando');
  assert.equal(g.estado, 'tonto');
  passar(g, 3.1);
  assert.equal(g.estado, 'procurando');

  g.reagir('tonto');
  g.mudarEstado('esperando');
  assert.equal(g.estado, 'esperando');
  assert.equal(g.momento, null);
  assert.deepEqual(avisos, ['tonto', null, 'tonto', null]);
});

test('três cliques em 2 s são carinho; seis, tonto; com pedido na tela, nenhum dos dois', () => {
  const g = novo('parado');
  assert.equal(g.cutucar(), null);
  assert.equal(g.cutucar(), null);
  assert.equal(g.cutucar(), 'carinho');
  assert.equal(g.cutucar(), null);
  assert.equal(g.cutucar(), null);
  assert.equal(g.cutucar(), 'tonto');
  assert.equal(g.estado, 'tonto');

  // cliques espaçados não somam
  const h = novo('parado');
  h.cutucar(); h.cutucar(); passar(h, 2.1); h.cutucar();
  assert.equal(h.momento, null);

  const p = novo('esperando');
  for (let i = 0; i < 6; i++) assert.equal(p.cutucar(), null);
  assert.equal(p.estado, 'esperando');
});

test('o 👋 da sessão nova não atropela outro momento, como o susto ou a saudação (Codex, 09/10)', () => {
  for (const antes of ['susto', 'saudacao', 'carinho']) {
    const g = novo('pensando');
    g.reagir(antes);
    assert.equal(g.reagir('oi'), false, antes);
    assert.equal(g.momento.nome, antes);
  }
  const g = novo('pensando');
  assert.equal(g.reagir('oi'), true);
});

test('os cliques contam no relógio de verdade: escondido, o gato não atualiza, mas o tempo passa (Codex, 09/10)', () => {
  const g = novo('parado');
  g.cutucar(); g.cutucar();
  agora += 10; // a ilha recolheu: este gato não rodou o atualizar nesses 10 s
  assert.equal(g.cutucar(), null);
  assert.equal(g.momento, null);
});

test('no cochilo, três cliques são carinho, mas seis não deixam tonto (09/10, decisão do Vinicius)', () => {
  const g = novo('cochilo');
  const momentos = [];
  for (let i = 0; i < 9; i++) momentos.push(g.cutucar());
  assert.deepEqual(momentos.filter(Boolean), ['carinho']);
  assert.notEqual(g.estado, 'tonto');
  passar(g, 3.5);
  assert.equal(g.estado, 'cochilo'); // o carinho acaba e ele segue dormindo
});

test('a patadinha: nunca com pedido, no cochilo ou no meio de um momento; dura menos de 1 s', () => {
  for (const e of ['esperando', 'pergunta', 'cochilo']) assert.equal(novo(e).patada(1), false, e);
  const m = novo('parado');
  m.reagir('carinho');
  assert.equal(m.patada(1), false);

  const g = novo('parado');
  assert.equal(g.patada(-1), true);
  assert.equal(g.gestoDe(-1), 'patada');
  assert.equal(g.patada(1), false); // uma de cada vez
  passar(g, .6);
  assert.equal(g.gestoDe(-1), null);
});

test('o gato escondido herda o momento do que estava na tela', () => {
  const visivel = novo('trabalhando'), escondido = novo('trabalhando');
  visivel.reagir('tonto');
  passar(visivel, 1);
  escondido.herdarMomento(visivel);
  assert.equal(escondido.estado, 'tonto');
  passar(escondido, 2.1);
  assert.equal(escondido.estado, 'trabalhando');

  // e um momento velho, parado no escondido, some quando o visível já não tem nenhum
  const parado = novo('parado'), atual = novo('parado');
  parado.reagir('tonto');
  parado.herdarMomento(atual);
  assert.equal(parado.momento, null);
  assert.equal(parado.estado, 'parado');
});

test('a vigia da patadinha: rápido, perto e fora da pílula; uma a cada 30 s', () => {
  const ret = { left: 100, top: 0, right: 240, bottom: 34, centroGato: 122 };
  const v = criarVigiaDePatada();
  // devagar, perto: nada
  assert.equal(v(300, 40, ret, 0), 0);
  assert.equal(v(298, 40, ret, .1), 0);
  // rápido mas longe (mais de 60 px): nada
  v.esquecer();
  assert.equal(v(400, 200, ret, 1), 0);
  assert.equal(v(300, 200, ret, 1.05), 0);
  // rápido, dentro da pílula: nada (aí é o hover)
  v.esquecer();
  assert.equal(v(200, 10, ret, 2), 0);
  assert.equal(v(150, 10, ret, 2.05), 0);
  // rápido e perto, à direita do gato: patada para a direita
  v.esquecer();
  assert.equal(v(300, 40, ret, 3), 0);
  assert.equal(v(260, 40, ret, 3.02), 1);
  // logo depois, de novo: espera os 30 s
  assert.equal(v(220, 50, ret, 3.04), 0);
  v.esquecer();
  assert.equal(v(40, 20, ret, 40), 0);
  assert.equal(v(80, 20, ret, 40.02), -1);
  // um buraco grande entre duas leituras não vira velocidade
  const w = criarVigiaDePatada();
  assert.equal(w(300, 40, ret, 0), 0);
  assert.equal(w(250, 40, ret, 1), 0);
});

test('o desenho guarda gradientes e caminhos em vez de criar a cada quadro (memória do WebView2)', () => {
  // cada gradiente e cada Path2D segura memória nativa que o coletor do V8 não enxerga: criados a
  // cada quadro, faziam a memória subir em serra até ~210 MB (F3 da 002)
  for (const [opcoes, estado] of [[{ pequeno: true, raio: 12, cx: 22, cy: 19 }, 'parado'], [{ raio: 27, cx: 52, cy: 60 }, 'esperando']]) {
    const g = new Gato({ getContext: () => contando, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 110 }) },
      { estado, ...opcoes });
    // os primeiros segundos enchem a cache (o pulso do "esperando" passa por umas 50 transparências)
    for (let i = 0; i < 300; i++) { g.atualizar(1 / 15); g.desenhar(); }
    criados.gradientes = criados.caminhos = 0;
    for (let i = 0; i < 300; i++) { g.atualizar(1 / 15); g.desenhar(); }
    // antes: ~18 gradientes e 7 Path2D por quadro na pílula (~7.500 em 300 quadros); agora, os
    // mesmos guardados, e a cabeça e a mancha vão direto no contexto
    assert.ok(criados.gradientes + criados.caminhos < 10, `${estado}: ${criados.gradientes} gradientes, ${criados.caminhos} caminhos em 300 quadros`);
  }
});
