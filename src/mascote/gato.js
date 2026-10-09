// O gato do Xereta: desenho em Canvas 2D com molas.
// Script clássico (sem módulo) para funcionar também no protótipo aberto direto do disco
// (design/mascote.html). Os textos de cada estado ficam em textos/pt-BR.js.
'use strict';

const TAU = Math.PI * 2;

// `selo`: o sinal na orelha clara (D7 da 002), que se lê até na pílula; sem selo, o miolo rosa
const ESTADOS = {
  parado:      { cor: [150, 175, 215], brilho: .16, tinta: 0,   olhos: 'normal',      orelhas: 'tremer',  bigodes: 'repouso' },
  pensando:    { cor: [150, 140, 255], brilho: .32, tinta: .22, olhos: 'normal',      orelhas: 'radar',   bigodes: 'queixo',    selo: 'pensando' },
  trabalhando: { cor: [ 70, 205, 190], brilho: .30, tinta: .16, olhos: 'foco',        orelhas: 'helice',  bigodes: 'digitando', selo: 'trabalhando' },
  esperando:   { cor: [255, 186,  60], brilho: .45, tinta: .30, olhos: 'pidao',       orelhas: 'alerta',  bigodes: 'apontar',   selo: 'exclamacao', pulso: true },
  feliz:       { cor: [110, 215, 120], brilho: .40, tinta: .16, olhos: 'feliz',       orelhas: 'pular',   bigodes: 'comemorar', selo: 'certo' },
  erro:        { cor: [255,  95,  95], brilho: .40, tinta: .25, olhos: 'esbugalhado', orelhas: 'murchar', bigodes: 'murchar',   selo: 'errado', suor: true },

  // os da 002 (F3)
  procurando:  { cor: [ 90, 170, 255], brilho: .30, tinta: .16, olhos: 'normal',      orelhas: 'radar',   bigodes: 'repouso',   selo: 'lupa' },
  pergunta:    { cor: [235, 115, 210], brilho: .42, tinta: .26, olhos: 'pidao',       orelhas: 'curiosa', bigodes: 'repouso',   selo: 'pergunta', pulso: true },
  maratona:    { cor: [ 70, 205, 190], brilho: .30, tinta: .16, olhos: 'foco',        orelhas: 'normal',  bigodes: 'repouso',   selo: 'trabalhando', caneca: true, gestos: { 1: 'segurar', '-1': 'segurar' } },
  cochilo:     { cor: [115, 125, 200], brilho: .14, tinta: .08, olhos: 'dormindo',    orelhas: 'relaxar', bigodes: 'repouso',   selo: 'z', afunda: .16, gestos: { 1: 'travesseiro', '-1': 'travesseiro' } },
  cansado:     { cor: [165, 160, 172], brilho: .22, tinta: .16, olhos: 'cansado',     orelhas: 'caidas',  bigodes: 'murchar',   selo: 'bateria', suor: true, afunda: .06 },

  // caras extras: os bigodes viram braços e fazem gestos (gestos: lado -1 = esquerda, 1 = direita)
  oi:          { extra: true, cor: [120, 190, 255], brilho: .32, tinta: .18, olhos: 'normal',    orelhas: 'alerta',       bigodes: 'repouso', gestos: { 1: 'acenar' } },
  feito:       { extra: true, cor: [110, 215, 120], brilho: .40, tinta: .16, olhos: 'feliz',     orelhas: 'pular',        bigodes: 'repouso', gestos: { 1: 'joinha' }, selo: 'certo' },
  testes:      { extra: true, cor: [110, 215, 120], brilho: .36, tinta: .16, olhos: 'piscadela', orelhas: 'umaEmPe',      bigodes: 'repouso', gestos: { 1: 'ok' }, selo: 'certo' },
  aqui:        { extra: true, cor: [255, 186,  60], brilho: .45, tinta: .30, olhos: 'pidao',     orelhas: 'alerta',       bigodes: 'repouso', gestos: { 1: 'apontar', '-1': 'tamborilar' }, pulso: true, selo: 'exclamacao' },
  negou:       { extra: true, cor: [150, 175, 215], brilho: .22, tinta: .10, olhos: 'deLado',    orelhas: 'murcharDuas',  bigodes: 'repouso', gestos: { 1: 'naoNao' }, olhar: [-.34, -.06] },
  ops:         { extra: true, cor: [255, 150,  90], brilho: .26, tinta: .14, olhos: 'meh',       orelhas: 'murchar',      bigodes: 'repouso', gestos: { 1: 'ombros', '-1': 'ombros' }, olhar: [0, -.1], selo: 'errado' },
  eita:        { extra: true, cor: [255,  90,  60], brilho: .45, tinta: .28, olhos: 'normal',    orelhas: 'arrepiar',     bigodes: 'repouso', gestos: { 1: 'tapar', '-1': 'tapar' },     pulso: true, selo: 'exclamacao' },
  socorro:     { extra: true, cor: [255,  70,  70], brilho: .50, tinta: .30, olhos: 'saltando',  orelhas: 'arrepiar',     bigodes: 'repouso', gestos: { 1: 'bochecha', '-1': 'bochecha' }, selo: 'errado' },
};

// Momentos: reações curtas por cima do estado, que voltam sozinhas a ele. Só trocam o que
// listam (a cor e o selo continuam os do estado, se não disserem outra coisa).
const MOMENTOS = {
  susto:    { dur: .45, olhos: 'esbugalhado', orelhas: 'susto',   bigodes: 'repouso', gestos: null, caneca: false, afunda: 0 },
  carinho:  { dur: 1.3, olhos: 'feliz',       orelhas: 'relaxar' },
  tonto:    { dur: 3,   olhos: 'espiral',     orelhas: 'tonto',   bigodes: 'murchar', gestos: null, caneca: false, selo: null },
  saudacao: { dur: 1.9, olhos: 'normal',      orelhas: 'alerta',  bigodes: 'repouso', gestos: { 1: 'acenar' }, caneca: false, afunda: 0 },
  // a cara 👋 das extras, como momento: no prompt de uma sessão nova, por cima do "pensando" (D13)
  oi:       { dur: 1.5, olhos: 'normal',      orelhas: 'alerta',  bigodes: 'repouso', gestos: { 1: 'acenar' }, caneca: false, afunda: 0 },
};

// com um pedido na tela, o gato não brinca: nada de carinho, tonto nem patadinha
const URGENTES = new Set(['esperando', 'pergunta', 'aqui', 'eita']);

// ---------- as luvinhas ----------
// Unidades da mão: origem no punho, dedos para cima (-y). Cada parte é uma cápsula,
// um retângulo arredondado ou um anel; o contorno sai de desenhar tudo duas vezes.
const PUNHO = { tipo: 'ret', x: 0, y: -.12, w: 1.3, h: .5, r: .25 };
const MAOS = {
  joinha: [
    { tipo: 'ret', x: .05, y: -1, w: 1.65, h: 1.35, r: .6 },
    { tipo: 'cap', x1: -.5, y1: -1.4, x2: -.5, y2: -2.45, w: .62 },
    { tipo: 'vinco', x1: .1, y1: -1.3, x2: .75, y2: -1.3 },
    { tipo: 'vinco', x1: .1, y1: -.95, x2: .75, y2: -.95 },
    { tipo: 'vinco', x1: .1, y1: -.62, x2: .7, y2: -.62 },
  ],
  indicador: [
    { tipo: 'ret', x: 0, y: -1, w: 1.6, h: 1.3, r: .6 },
    { tipo: 'cap', x1: -.25, y1: -1.45, x2: -.25, y2: -2.85, w: .52 },
    { tipo: 'vinco', x1: .15, y1: -1.15, x2: .72, y2: -1.15 },
    { tipo: 'vinco', x1: .15, y1: -.8, x2: .72, y2: -.8 },
  ],
  ok: [
    { tipo: 'ret', x: .1, y: -.95, w: 1.5, h: 1.25, r: .6 },
    { tipo: 'anel', x: -.5, y: -1.95, r: .45, w: .38 },
    { tipo: 'cap', x1: 0, y1: -1.4, x2: .1, y2: -2.65, w: .4 },
    { tipo: 'cap', x1: .4, y1: -1.4, x2: .65, y2: -2.5, w: .4 },
    { tipo: 'cap', x1: .75, y1: -1.25, x2: 1.15, y2: -2.15, w: .38 },
  ],
  palma: [
    { tipo: 'ret', x: 0, y: -1.05, w: 1.7, h: 1.45, r: .65 },
    { tipo: 'cap', x1: -.55, y1: -1.55, x2: -.75, y2: -2.55, w: .42 },
    { tipo: 'cap', x1: -.18, y1: -1.65, x2: -.22, y2: -2.75, w: .42 },
    { tipo: 'cap', x1: .2, y1: -1.65, x2: .25, y2: -2.75, w: .42 },
    { tipo: 'cap', x1: .56, y1: -1.55, x2: .78, y2: -2.45, w: .42 },
    { tipo: 'cap', x1: -.75, y1: -.9, x2: -1.4, y2: -1.55, w: .46 },
  ],
};

// Onde fica o punho (em raios, a partir do centro da cabeça, para o lado direito),
// o ângulo da mão, o tamanho e a animação de cada gesto.
const GESTOS = {
  joinha:     { mao: 'joinha',    w: [1.22, .02],  ang: 0,    esc: 1,    anim: t => ({ dy: Math.sin(t * TAU * 1.2) * .025 }) },
  ok:         { mao: 'ok',        w: [1.22, -.02], ang: .12,  esc: 1,    anim: t => ({ da: Math.sin(t * TAU * .8) * .06 }) },
  naoNao:     { mao: 'indicador', w: [1.18, -.05], ang: 0,    esc: 1,    anim: t => ({ da: Math.sin(t * TAU * 2.6) * .42 }) },
  apontar:    { mao: 'indicador', w: [1.25, .12],  ang: 1.45, esc: 1,    anim: t => ({ dx: Math.sin(t * TAU * 2) * .035 }) },
  tamborilar: { mao: 'palma',     w: [1.12, .34],  ang: 1.9,  esc: .8,   anim: t => ({ dy: -Math.abs(Math.sin(t * TAU * 4.5)) * .05 }) },
  acenar:     { mao: 'palma',     w: [1.3, -.25],  ang: .15,  esc: 1,    anim: t => ({ da: Math.sin(t * TAU * 2.2) * .38 }) },
  ombros:     { mao: 'palma',     w: [1.3, .22],   ang: 1.25, esc: .85,  anim: t => ({ dy: -Math.max(0, Math.sin(t * TAU * .8)) * .06 }) },
  tapar:      { mao: 'palma',     w: [.42, .26],   ang: -.12, esc: 1.08, anim: t => ({ dy: Math.sin(t * TAU * 6) * .008 }) },
  bochecha:   { mao: 'palma',     w: [.86, .5],    ang: -.32, esc: .9,  anim: t => ({ dy: Math.sin(t * TAU * 7) * .01 }) },
  // as duas luvinhas deitadas debaixo do queixo, como travesseiro (cochilo)
  travesseiro: { mao: 'palma',    w: [.6, 1.0],    ang: -1.62, esc: .9, anim: t => ({ dy: Math.sin(t * TAU * .2) * .012 }) },
  // as duas em volta da caneca (maratona)
  segurar:    { mao: 'palma',     w: [.5, 1.2],    ang: -1.15, esc: .7,  anim: t => ({ dy: Math.sin(t * TAU * .5) * .01 }) },
  // a patadinha: recua, bate para fora e volta, guiada pelo relógio da própria patada
  // (na pílula o canvas acaba logo depois da bochecha: o golpe é curto e mais de giro que de ida)
  patada:     { mao: 'palma',     w: [.98, .3],    ang: .35,  esc: 1,   anim: (t, g) => {
    const k = Math.min(1, Math.max(0, g.patadaT) / DURACAO_PATADA);
    const golpe = k < .25 ? -k / .25 * .1 : Math.sin((k - .25) / .75 * Math.PI) * .32;
    return { dx: golpe, dy: -golpe * .5, da: golpe * 2.6 };
  } },
};
const DURACAO_PATADA = .55;

const CONTORNO = 'rgba(30,22,32,.78)';

function tracarParte(c, p, u, e) {
  c.beginPath();
  if (p.tipo === 'cap') {
    c.lineWidth = p.w * u + 2 * e;
    c.moveTo(p.x1 * u, p.y1 * u);
    c.lineTo(p.x2 * u, p.y2 * u);
    c.stroke();
  } else if (p.tipo === 'ret') {
    c.roundRect((p.x - p.w / 2) * u - e, (p.y - p.h / 2) * u - e, p.w * u + 2 * e, p.h * u + 2 * e, p.r * u + e);
    c.fill();
  } else if (p.tipo === 'anel') {
    c.lineWidth = p.w * u + 2 * e;
    c.arc(p.x * u, p.y * u, p.r * u, 0, TAU);
    c.stroke();
  }
}

// `recheio`: o gradiente do recheio, que quem chama guarda (ver `guardar` no Gato)
function desenharMao(c, nome, u, e, recheio) {
  const partes = [PUNHO, ...MAOS[nome].filter(p => p.tipo !== 'vinco')];
  c.lineCap = 'round';
  // 1. contorno, com sombra caindo no rosto
  c.save();
  c.shadowColor = 'rgba(0,0,0,.28)';
  c.shadowBlur = u * .7;
  c.shadowOffsetY = u * .3;
  c.fillStyle = c.strokeStyle = CONTORNO;
  for (const p of partes) tracarParte(c, p, u, e);
  c.restore();
  // 2. recheio com a mesma luz da cabeça
  c.fillStyle = c.strokeStyle = recheio;
  for (const p of partes) tracarParte(c, p, u, 0);
  // 3. o punho da luva, um tom abaixo
  c.fillStyle = '#e9dfd0';
  tracarParte(c, PUNHO, u, 0);
  // 4. vincos dos dedos
  c.strokeStyle = 'rgba(30,22,32,.45)';
  c.lineWidth = Math.max(.7, u * .09);
  for (const p of MAOS[nome]) {
    if (p.tipo !== 'vinco') continue;
    c.beginPath(); c.moveTo(p.x1 * u, p.y1 * u); c.lineTo(p.x2 * u, p.y2 * u); c.stroke();
  }
}

// ---------- utilidades ----------
// o alfa em passos de 1/50: um gradiente com alfa que pulsa vira poucas variações guardadas
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.round(a * 50) / 50})`;
// os pontos de um gradiente guardado, arredondados a 1/4 de px: a luz não mostra a diferença
const q4 = v => Math.round(v * 4) / 4;
const MAX_GUARDADOS = 600;
const lerp = (a, b, t) => a + (b - a) * t;
// quem usa o gato pode mudar estas opções (o protótipo liga o "reduzir movimento" na mão)
const prefereMenosMovimento = matchMedia('(prefers-reduced-motion: reduce)');
const mascote = {
  reduzirMovimento: prefereMenosMovimento.matches,
  ponteiro: { x: 0, y: 0, ativo: false },
};
// acompanha a opção do Windows mudada com o app aberto, como o CSS já faz
prefereMenosMovimento.addEventListener('change', ev => { mascote.reduzirMovimento = ev.matches; });
const mov = () => (mascote.reduzirMovimento ? 0 : 1);

class Mola {
  constructor(v = 0, k = 180, c = 16) { this.v = v; this.vel = 0; this.alvo = v; this.k = k; this.c = c; }
  passo(dt) {
    const a = this.k * (this.alvo - this.v) - this.c * this.vel;
    this.vel += a * dt;
    this.v += this.vel * dt;
  }
  chute(i) { this.vel += i; }
}

function poliArredondado(pts, r) {
  const p = new Path2D();
  const n = pts.length;
  const a = pts[n - 1], b = pts[0];
  p.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < n; i++) {
    const c = pts[i], d = pts[(i + 1) % n];
    p.arcTo(c[0], c[1], d[0], d[1], r);
  }
  p.closePath();
  return p;
}

// superelipse um pouco mais cheia embaixo: cara de bochecha, não de bola. Os pontos são do contorno
// de raio 1, calculados uma vez; o desenho os estica para o rx e o ry de cada quadro.
const CONTORNO_CABECA = (() => {
  const n = 2.3, passos = 72, pontos = [];
  for (let k = 0; k <= passos; k++) {
    const a = (k / passos) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    let x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
    if (y > 0) x *= 1 + .05 * y;
    pontos.push(x, y);
  }
  return pontos;
})();

// O contorno da cabeça vai direto no contexto, sem Path2D: ele muda a cada quadro (respiração,
// amasso, pulo), e um Path2D novo por quadro é memória nativa que o coletor demora a devolver.
function tracarCabeca(c, rx, ry) {
  const p = CONTORNO_CABECA;
  c.beginPath();
  c.moveTo(p[0] * rx, p[1] * ry);
  for (let i = 2; i < p.length; i += 2) c.lineTo(p[i] * rx, p[i + 1] * ry);
  c.closePath();
}

// O desenho do selo, centrado em (0, 0), dentro de um quadrado de lado ~2u. Traço grosso e sem
// texto de fonte, para se ler com 6 px de altura na pílula.
function desenharSelo(c, tipo, u, t, m) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1.1, u * .34);
  const ponto = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const linha = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
  switch (tipo) {
    case 'pensando': // … : os pontos acendem um por um, como quem ainda está escrevendo
      for (let i = 0; i < 3; i++) {
        const f = m ? ((t * 1.1 - i * .22) % 1 + 1) % 1 : 1;
        c.globalAlpha = f < .7 ? 1 : .3;
        ponto((i - 1) * .78 * u, .5 * u, u * .27);
      }
      c.globalAlpha = 1;
      break;
    case 'trabalhando': // ⋯ : os pontos no meio, numa onda
      for (let i = 0; i < 3; i++) ponto((i - 1) * .78 * u, -Math.max(0, Math.sin(t * TAU * 1.6 - i * 1.1)) * .45 * u * m + .05 * u, u * .27);
      break;
    case 'exclamacao':
      linha(0, -.85 * u, 0, .2 * u);
      ponto(0, .78 * u, u * .22);
      break;
    case 'pergunta':
      c.beginPath();
      c.arc(0, -.38 * u, .45 * u, Math.PI * 1.05, Math.PI * 2.35);
      c.lineTo(0, .25 * u);
      c.stroke();
      ponto(0, .8 * u, u * .22);
      break;
    case 'certo':
      linha(-.7 * u, .02 * u, -.18 * u, .55 * u, .72 * u, -.6 * u);
      break;
    case 'errado':
      linha(-.58 * u, -.58 * u, .58 * u, .58 * u);
      linha(.58 * u, -.58 * u, -.58 * u, .58 * u);
      break;
    case 'lupa':
      c.beginPath(); c.arc(-.15 * u, -.15 * u, .48 * u, 0, TAU); c.stroke();
      linha(.22 * u, .22 * u, .68 * u, .68 * u);
      break;
    case 'z':
      linha(-.5 * u, -.55 * u, .5 * u, -.55 * u, -.5 * u, .55 * u, .5 * u, .55 * u);
      break;
    case 'bateria': { // a carga acabou: o contorno, o polo e um tiquinho vermelho
      c.lineWidth = Math.max(1, u * .24);
      c.beginPath(); c.roundRect(-.78 * u, -.45 * u, 1.4 * u, .9 * u, .15 * u); c.stroke();
      c.fillRect(.68 * u, -.2 * u, .2 * u, .4 * u);
      c.fillStyle = '#e0303c';
      c.fillRect(-.6 * u, -.27 * u, .3 * u, .54 * u);
      break;
    }
  }
}

// um "z" do cochilo, centrado em (0, 0)
function desenharZ(c, r) {
  c.beginPath();
  c.moveTo(-r, -r); c.lineTo(r, -r); c.lineTo(-r, r); c.lineTo(r, r);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = Math.max(1.6, r * .9);
  c.strokeStyle = 'rgba(30,22,32,.55)';
  c.stroke();
  c.lineWidth = Math.max(.9, r * .45);
  c.strokeStyle = '#f2ecff';
  c.stroke();
}

// Vê se o cursor passou RÁPIDO perto da pílula, sem entrar nela (D10 da 002). Recebe a posição
// do cursor e o retângulo da pílula na mesma unidade, e o tempo em segundos. Devolve o lado da
// patada (-1, 1) ou 0. No máximo uma patada a cada `intervalo` segundos.
function criarVigiaDePatada({ distancia = 60, velocidade = 900, intervalo = 30 } = {}) {
  let anterior = null;
  let ultima = -Infinity;
  // `dt`: o tempo entre esta leitura e a anterior, como o Rust mediu. Ele só avisa quando o cursor
  // mexe (parado, a mesma posição seria à toa), então o aviso anterior pode ter chegado há 1 s: o
  // cursor estava lá, parado, até a leitura de 66 ms atrás. Sem `dt`, vale a hora de chegada, e um
  // buraco grande não vira velocidade.
  const vigia = (x, y, ret, t, dt) => {
    const a = anterior;
    anterior = { x, y, t };
    const passo = dt ?? t - (a?.t ?? t);
    if (!a || passo <= 0 || (dt == null && passo > .25)) return 0;
    const v = Math.hypot(x - a.x, y - a.y) / passo;
    const dx = Math.max(ret.left - x, 0, x - ret.right);
    const dy = Math.max(ret.top - y, 0, y - ret.bottom);
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > distancia || v < velocidade || t - ultima < intervalo) return 0;
    ultima = t;
    return x < ret.centroGato ? -1 : 1;
  };
  vigia.esquecer = () => { anterior = null; };
  return vigia;
}

function estrela(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}

// ---------- o gato ----------
class Gato {
  constructor(canvas, opcoes = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    // `orelha`: a escala das orelhas (na pílula, maiores, para o selo se ler)
    // `largura`, `altura`, `dpr`: tamanho fixo, para desenhar pixel a pixel (o protótipo a 100%)
    // `aoMomento(nome)`: avisa quando um momento começa, e com null quando ele acaba
    // `relogio()`: segundos de verdade, para os cliques. O `this.t` só anda no `atualizar`, e o gato
    // escondido não atualiza: dois cliques antes de a ilha recolher somavam com um 10 s depois
    this.op = Object.assign({ estado: 'parado', pequeno: false, raio: null, cx: null, cy: null,
      relogio: () => performance.now() / 1000 }, opcoes);
    this.op.orelha ??= this.op.pequeno ? 1.4 : 1;
    this.t = Math.random() * 10;

    this.yaw = new Mola(0, 70, 12);
    this.pitch = new Mola(0, 70, 12);
    this.roll = new Mola(0, 90, 10);
    this.amasso = new Mola(0, 260, 9);
    this.pulo = new Mola(0, 200, 11);
    this.chacoalho = new Mola(0, 400, 6);
    this.afunda = new Mola(0, 60, 11);

    this.momento = null;
    this.cliques = [];
    this.patadaT = -1;
    this.patadaLado = 1;
    this.zs = [];
    this.proxZ = 0;

    this.piscar = 0;
    this.piscando = -1;
    this.proxPiscada = 1 + Math.random() * 3;

    this.orelhas = [-1, 1].map(s => ({ s, rot: new Mola(0, 200, 11), ergue: new Mola(0, 220, 10), giro: 0 }));
    this.bigodes = [-1, 1].flatMap(s => [0, 1, 2].map(i => ({
      s, i, ang: new Mola(0, 220, 16), dobra: new Mola(0, 200, 16), comp: new Mola(1, 200, 16), osc: 0,
    })));
    this.particulas = [];
    this.proxBrilho = 0;
    // uma mão por lado: aparece com mola, e os bigodes daquele lado viram o braço
    this.maos = {};
    for (const s of [-1, 1]) {
      this.maos[s] = { gesto: null, ultimo: 'joinha', tam: new Mola(0, 300, 13), wx: new Mola(1.1, 160, 13), wy: new Mola(.1, 160, 13), ang: new Mola(0, 160, 13) };
    }
    this.olhoPulo = new Mola(0, 220, 7);

    // a pílula não desenha bigodes: as molas deles nem entram na conta. As mãos entram, por
    // causa da patadinha, que acontece justamente na pílula
    this.molas = [this.yaw, this.pitch, this.roll, this.amasso, this.pulo, this.chacoalho, this.olhoPulo, this.afunda];
    for (const o of this.orelhas) this.molas.push(o.rot, o.ergue);
    for (const s of [-1, 1]) { const mao = this.maos[s]; this.molas.push(mao.tam, mao.wx, mao.wy, mao.ang); }
    if (!this.op.pequeno) for (const b of this.bigodes) this.molas.push(b.ang, b.dobra, b.comp);

    this.redimensionar();
    this.mudarEstado(this.op.estado, true);
  }

  redimensionar() {
    const r = this.cv.getBoundingClientRect();
    this.w = this.op.largura ?? (r.width || 220);
    this.h = this.op.altura ?? (r.height || 220);
    this.dpr = this.op.dpr ?? (window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.R = this.op.raio ?? Math.min(this.w, this.h) * 0.24;
    this.cx = this.op.cx ?? this.w / 2;
    this.cy = this.op.cy ?? this.h * 0.53;
    // o tamanho mudou: o que estava guardado é de outro tamanho (e, com o canvas novo, de outro contexto)
    this.guardados = new Map();
  }

  // Gradientes e caminhos (Path2D) guardados, porque se repetem de um quadro para o outro. Cada um
  // segura memória nativa do Skia que o coletor do V8 não enxerga: criar uns 25 por quadro fazia o
  // WebView2 subir em serra até ~210 MB, conforme o humor do coletor (medido na F3 da 002). Com um
  // teto, para um olhar que passeia muito não guardar para sempre.
  guardar(chave, criar) {
    let v = this.guardados.get(chave);
    if (v === undefined) {
      if (this.guardados.size >= MAX_GUARDADOS) this.guardados.clear();
      v = criar();
      this.guardados.set(chave, v);
    }
    return v;
  }

  // Um gradiente guardado. `pontos`: os do createLinearGradient (4) ou do createRadialGradient (6),
  // arredondados a 1/4 de px; `paradas`: [posição, cor, posição, cor, ...].
  gradiente(pontos, ...paradas) {
    const p = pontos.map(q4);
    return this.guardar(`${p.join(',')}|${paradas.join('|')}`, () => {
      const g = p.length === 4 ? this.ctx.createLinearGradient(...p) : this.ctx.createRadialGradient(...p);
      for (let i = 0; i < paradas.length; i += 2) g.addColorStop(paradas[i], paradas[i + 1]);
      return g;
    });
  }

  // O estado que a ilha pediu. Com um momento na tela, o estado novo espera o momento acabar,
  // menos um pedido, que corta o momento na hora. Sair do cochilo é sempre com susto.
  mudarEstado(e, inicio = false) {
    const antes = this.base;
    this.base = e;
    if (inicio) { this.aplicar(false); this.trocarMaos(true); return; }
    if (this.momento) {
      if (!URGENTES.has(e)) { this.aplicar(false); return; }
      this.momento = null;
      this.op.aoMomento?.(null);
    }
    if (antes === 'cochilo' && e !== 'cochilo' && mov()) { this.reagir('susto'); return; }
    this.aplicar(true);
  }

  // junta o estado e o momento na configuração que o desenho usa
  aplicar(reagir) {
    const mo = this.momento;
    this.estado = mo ? mo.nome : this.base;
    this.cfg = mo ? { ...ESTADOS[this.base], ...MOMENTOS[mo.nome] } : ESTADOS[this.base];
    this.tEstado = 0;
    this.proxEvento = .35;
    if (reagir) this.reacaoDeEntrada();
  }

  // D8: cada troca de estado ganha uma reação curta, de menos de 1 s; D9: grande só no que é grande
  reacaoDeEntrada() {
    const m = mov(), e = this.estado;
    this.amasso.chute(1.2 * m);
    this.iniciarPiscada();
    if (e === 'erro' || e === 'socorro') this.chacoalho.chute(30 * m);
    if (e === 'ops') this.pulo.chute(-1.2 * m);
    if (e === 'feliz' || e === 'feito') this.pulo.chute(-3.5 * m);
    if (e === 'socorro') this.olhoPulo.chute(9 * m);
    if (e === 'esperando' || e === 'aqui' || e === 'pergunta') for (const o of this.orelhas) o.ergue.chute(4.5 * m);
    if (e === 'pergunta') this.roll.chute(1.6 * m);
    if (e === 'procurando') this.yaw.chute(2.5 * m);
    if (e === 'cansado') { this.pulo.chute(1.2 * m); for (const o of this.orelhas) o.rot.chute(o.s * 3 * m); }
  }

  // Começa um momento (MOMENTOS). Devolve false se não começou.
  reagir(nome) {
    if (!MOMENTOS[nome]) return false;
    // o 👋 da sessão nova é o mais fraco: não corta o susto, a saudação nem um carinho em andamento
    if (nome === 'oi' && this.momento) return false;
    const m = mov();
    this.momento = { nome, t: 0, dur: MOMENTOS[nome].dur };
    this.aplicar(false);
    this.iniciarPiscada();
    if (nome === 'susto') {
      this.pulo.chute(-4.5 * m);
      this.amasso.chute(-1.6 * m);
      for (const o of this.orelhas) o.ergue.chute(7 * m);
    }
    if (nome === 'carinho') this.amasso.chute(.8 * m);
    if (nome === 'oi') for (const o of this.orelhas) o.ergue.chute(5 * m);
    if (nome === 'tonto') this.chacoalho.chute(14 * m);
    if (nome === 'saudacao' && m) { this.pulo.v = 2.4; this.pulo.vel = 0; } // começa escondido embaixo e espia
    this.op.aoMomento?.(nome);
    return true;
  }

  // Um clique no gato. Três em 2 s são carinho; seis, cutucão (tonto), mas não no cochilo: carinho
  // em quem dorme vale, deixar tonto não. Devolve o momento que começou, ou null.
  cutucar() {
    const m = mov();
    this.amasso.chute(m ? 2.4 : 0);
    this.pulo.chute(-1.4 * m);
    for (const o of this.orelhas) { o.ergue.chute(3 * m); o.rot.chute(-o.s * 3 * m); }
    this.iniciarPiscada();
    const agora = this.op.relogio();
    this.cliques = this.cliques.filter(c => agora - c < 2);
    this.cliques.push(agora);
    if (URGENTES.has(this.base) || this.momento?.nome === 'tonto') return null;
    const n = this.cliques.length;
    if (n >= 6 && this.base !== 'cochilo') { this.cliques = []; this.reagir('tonto'); return 'tonto'; }
    if (n === 3) { this.reagir('carinho'); return 'carinho'; }
    return null;
  }

  // A patadinha na direção do cursor (lado -1 ou 1). Quem vigia o cursor é o criarVigiaDePatada.
  patada(lado) {
    if (!mov() || URGENTES.has(this.base) || this.base === 'cochilo' || this.momento || this.patadaT >= 0) return false;
    this.patadaLado = lado < 0 ? -1 : 1;
    this.patadaT = 0;
    for (const o of this.orelhas) o.ergue.chute(3);
    return true;
  }

  // A ilha tem dois gatos (pílula e aberta), e o escondido não roda o atualizar: o momento dele
  // parou no tempo. Ao aparecer, ele copia o momento e a patada do que estava na tela.
  herdarMomento(outro) {
    const mo = outro.momento;
    this.momento = mo ? { ...mo } : null;
    this.patadaT = outro.patadaT;
    this.patadaLado = outro.patadaLado;
    this.aplicar(false);
    this.tEstado = outro.tEstado;
  }

  gestoDe(s) {
    if (this.patadaT >= 0 && s === this.patadaLado) return 'patada';
    return this.cfg.gestos?.[s] ?? null;
  }

  trocarMaos(inicio = false) {
    const m = inicio ? 0 : mov();
    for (const s of [-1, 1]) {
      const mao = this.maos[s], novo = this.gestoDe(s);
      if (novo === mao.gesto) continue;
      if (novo) { mao.tam.chute(m ? -2 : 0); mao.ultimo = novo; }
      mao.gesto = novo;
    }
  }

  iniciarPiscada() { this.piscando = 0; }

  // ---------- comportamento ----------
  alvosOrelha(o) {
    const s = o.s;
    switch (this.cfg.orelhas) {
      case 'radar':   return { rot: 0, ergue: .05, giro: s < 0 ? .55 : -.55 };
      case 'helice':  return { rot: -s * .1, ergue: .1, giro: 2.6 };
      case 'alerta':  return { rot: -s * .38, ergue: .14, giro: 0 };
      case 'murchar': return s < 0 ? { rot: -.95, ergue: -.12, giro: 0 } : { rot: .32, ergue: -.04, giro: 0 };
      case 'murcharDuas': return { rot: s * .6, ergue: -.1, giro: 0 };
      case 'umaEmPe': return s > 0 ? { rot: -s * .4, ergue: .16, giro: 0 } : { rot: s * .15, ergue: 0, giro: 0 };
      case 'arrepiar': return { rot: s * .5, ergue: -.02, giro: 0 };
      // a escura inclina, a do selo fica em pé: cabeça de quem pergunta
      case 'curiosa': return s < 0 ? { rot: -.55, ergue: -.05, giro: 0 } : { rot: -.12, ergue: .14, giro: 0 };
      case 'relaxar': return { rot: s * .38, ergue: -.07, giro: 0 };
      // a escura cai de vez; a do selo cai só um pouco, para o selo continuar à vista
      case 'caidas':  return s < 0 ? { rot: -.55, ergue: -.14, giro: 0 } : { rot: .22, ergue: -.04, giro: 0 };
      case 'susto':   return { rot: -s * .12, ergue: .32, giro: 0 };
      case 'tonto':   return { rot: Math.sin(this.t * 9 + s) * .3, ergue: .04, giro: s * 1.4 };
    }
    return { rot: 0, ergue: 0, giro: 0 };
  }

  alvosBigode(b) {
    const { s, i } = b, t = this.t, m = mov();
    const base = [-0.2, 0.06, 0.32];
    switch (this.cfg.bigodes) {
      case 'queixo':
        if (s > 0) return { ang: .95 - base[i] * .3, dobra: .35, comp: .72, osc: Math.sin(t * TAU * 3 + i * .6) * .16 * m };
        break;
      case 'digitando':
        return { ang: .12, dobra: 0, comp: .9, osc: Math.sin(t * TAU * 6.5 + i * 2.1 + (s > 0 ? 0 : 1.7)) * .2 * m };
      case 'apontar':
        if (s > 0) return { ang: -0.04 - base[i], dobra: -.08, comp: 1.12, osc: i === 0 ? -Math.max(0, Math.sin(t * TAU * 4)) * .22 * m : 0 };
        return { ang: .22, dobra: 0, comp: .95, osc: Math.sin(t * 1.4 + i) * .03 * m };
      case 'comemorar':
        return { ang: -.5 - base[i] * .4, dobra: .28, comp: 1.08, osc: Math.sin(t * TAU * 3.5 + i * .8) * .12 * m };
      case 'murchar':
        return { ang: .55, dobra: .15, comp: .85, osc: Math.sin(t * TAU * 16 + i) * .025 * m };
    }
    return { ang: 0, dobra: 0, comp: 1, osc: Math.sin(t * 1.3 + i * 1.1 + s) * .04 * m };
  }

  atualizar(dt) {
    const m = mov();
    this.t += dt;
    this.tEstado += dt;

    // o momento acaba e devolve o estado (com a reação de entrada dele)
    if (this.momento && (this.momento.t += dt) >= this.momento.dur) {
      this.momento = null;
      this.aplicar(true);
      this.op.aoMomento?.(null);
    }
    if (this.patadaT >= 0 && (this.patadaT += dt) > DURACAO_PATADA) this.patadaT = -1;
    this.trocarMaos();
    this.afunda.alvo = this.cfg.afunda ?? 0;

    const t = this.t, e = this.estado;

    // para onde ele olha
    let gy = 0, gp = 0, gr = Math.sin(t * .5) * .02 * m;
    if (mascote.ponteiro.ativo) {
      const r = this.cv.getBoundingClientRect();
      const px = (mascote.ponteiro.x - (r.left + this.cx)) / this.R;
      const py = (mascote.ponteiro.y - (r.top + this.cy)) / this.R;
      gy = .42 * Math.tanh(px / 5);
      gp = -.3 * Math.tanh(py / 5);
    }
    if (e === 'pensando') { gy = .28; gp = .32; gr = -.1 + Math.sin(t * .9) * .03 * m; }
    if (e === 'trabalhando') {
      // lendo a linha de um lado ao outro; com menos movimento, olha parado para a "tela"
      const f = (t * .55) % 1;
      gy = m ? (f < .85 ? lerp(-.3, .3, f / .85) : lerp(.3, -.3, (f - .85) / .15)) : 0;
      gp = -.18; gr = 0;
    }
    if (e === 'esperando') {
      gr = Math.sin(t * 2.2) * .035 * m;
      if (m && this.tEstado % 3.2 > 2.3) { gy = .38; gp = -.05; }
    }
    if (e === 'feliz') { gy *= .3; gp = .08 + gp * .3; gr = 0; }
    if (e === 'erro') { gy *= .2; gp = -.08; gr = .07; }
    if (e === 'feito' || e === 'testes' || e === 'oi') { gy *= .4; gp = .06 + gp * .3; gr = e === 'testes' ? .06 : 0; }
    if (e === 'aqui') { gy = .3; gp = -.04; gr = Math.sin(t * 2.2) * .03 * m; }
    if (e === 'eita') { gy *= .15; gp = .02; gr = 0; }
    if (e === 'socorro') { gy = 0; gp = .05; gr = 0; }
    if (this.cfg.olhar) { [gy, gp] = this.cfg.olhar; gr = e === 'ops' ? .1 : -.05; }
    // procurando: os olhos varrem de um lado para o outro, sem pressa de achar
    if (e === 'procurando') { gy = Math.sin(t * TAU * .55) * .42 * m; gp = -.06; gr = Math.sin(t * TAU * .55) * .03 * m; }
    if (e === 'pergunta') { gy *= .3; gp = .06; gr = .16 + Math.sin(t * 1.6) * .03 * m; }
    if (e === 'maratona') { gy = -.05; gp = -.14; gr = 0; }
    if (e === 'cochilo') { gy = 0; gp = -.24; gr = .12; }
    if (e === 'cansado') { gy *= .2; gp = -.2; gr = -.06; }
    if (e === 'susto') { gy = 0; gp = .06; gr = 0; }
    if (e === 'carinho') { gy *= .2; gp = .1; gr = -.1; }
    if (e === 'tonto') { gy = Math.cos(t * 5) * .26 * m; gp = Math.sin(t * 5) * .16 * m; gr = Math.sin(t * 7) * .14 * m; }
    if (e === 'saudacao') { gy *= .4; gp = .06 + gp * .3; gr = .04; }
    if (!m) { gy *= .5; gp *= .5; }
    this.yaw.alvo = gy; this.pitch.alvo = gp; this.roll.alvo = gr;

    // respiração: no cochilo, lenta e funda
    const [freq, amp] = e === 'trabalhando' ? [1.1, .012] : e === 'cochilo' ? [.17, .04] : e === 'cansado' ? [.22, .03] : [.28, .022];
    this.resp = Math.sin(t * TAU * freq) * amp * (m ? 1 : .5);
    this.balanco = e === 'trabalhando' ? -Math.abs(Math.sin(t * TAU * 2)) * .03 * m : 0;

    // eventos de cada estado
    this.proxEvento -= dt;
    if (this.proxEvento <= 0) {
      switch (e) {
        case 'parado': {
          const o = this.orelhas[Math.random() < .5 ? 0 : 1];
          o.rot.chute((Math.random() < .5 ? -1 : 1) * 5 * m);
          o.ergue.chute(1.5 * m);
          this.proxEvento = 2 + Math.random() * 3.5;
          break;
        }
        case 'esperando':
          this.pulo.chute(-2 * m);
          for (const o of this.orelhas) o.ergue.chute(2 * m);
          this.proxEvento = 2.6;
          break;
        case 'feliz':
          this.pulo.chute(-3.2 * m);
          for (const o of this.orelhas) { o.ergue.chute(3.5 * m); o.rot.chute(-o.s * 4 * m); }
          this.proxEvento = 1.5;
          break;
        case 'erro':
          this.chacoalho.chute(22 * m);
          this.proxEvento = 3.2;
          break;
        case 'feito':
          this.pulo.chute(-2.6 * m);
          for (const o of this.orelhas) { o.ergue.chute(3.5 * m); o.rot.chute(-o.s * 4 * m); }
          this.proxEvento = 1.8;
          break;
        case 'oi':
          for (const o of this.orelhas) o.ergue.chute(2.5 * m);
          this.proxEvento = 1.6;
          break;
        case 'ops':
          this.pulo.chute(-1.2 * m);
          this.proxEvento = 2.5;
          break;
        case 'eita':
          this.chacoalho.chute(8 * m);
          this.proxEvento = .9;
          break;
        case 'socorro':
          this.olhoPulo.chute(9 * m);
          this.chacoalho.chute(16 * m);
          this.proxEvento = 1.5;
          break;
        case 'pergunta':
          for (const o of this.orelhas) if (o.s > 0) o.ergue.chute(2.5 * m);
          this.roll.chute(.8 * m);
          this.proxEvento = 2.8;
          break;
        case 'maratona': // um gole de vez em quando
          this.pulo.chute(-.9 * m);
          this.proxEvento = 4 + Math.random() * 2;
          break;
        case 'cansado': { // uma orelha tenta levantar e desiste
          const o = this.orelhas[Math.random() < .5 ? 0 : 1];
          o.ergue.chute(2 * m);
          this.proxEvento = 3 + Math.random() * 2;
          break;
        }
        case 'cochilo':
          this.proxEvento = 99;
          break;
        default:
          this.proxEvento = 1;
      }
    }

    // orelhas. A do selo não dá a volta (de costas, o selo some): no radar e na hélice, ela
    // balança de um lado para o outro e o giro fica com a escura
    for (const o of this.orelhas) {
      const a = this.alvosOrelha(o);
      if (a.giro && o.s > 0 && this.cfg.selo) {
        const rapido = Math.abs(a.giro) > 1;
        a.rot += Math.sin(t * TAU * (rapido ? 2.6 : .7)) * (rapido ? .14 : .32) * m;
        a.giro = 0;
      }
      o.rot.alvo = a.rot;
      o.ergue.alvo = a.ergue;
      if (a.giro && m) o.giro += a.giro * TAU * dt;
      else {
        const alvo = Math.round(o.giro / TAU) * TAU;
        o.giro += (alvo - o.giro) * Math.min(1, dt * 8);
      }
    }

    // bigodes (a pílula não os desenha) e mãos (a pílula só desenha a da patadinha)
    if (!this.op.pequeno) {
      for (const b of this.bigodes) {
        const a = this.alvosBigode(b);
        b.ang.alvo = a.ang; b.dobra.alvo = a.dobra; b.comp.alvo = a.comp; b.osc = a.osc;
      }
    }
    for (const s of [-1, 1]) {
      const mao = this.maos[s];
      const g = GESTOS[mao.gesto ?? mao.ultimo];
      mao.tam.alvo = mao.gesto ? 1 : 0;
      mao.wx.alvo = g.w[0]; mao.wy.alvo = g.w[1]; mao.ang.alvo = g.ang;
    }

    // os "z" do cochilo saem da orelha do selo e sobem
    if (e === 'cochilo' && m) {
      this.proxZ -= dt;
      if (this.proxZ <= 0) { this.zs.push({ vida: 0, dur: 2.6, lado: Math.random() - .5 }); this.proxZ = 1.3; }
    }
    this.zs = this.zs.filter(z => (z.vida += dt) < z.dur);

    // piscar
    if (this.piscando < 0) {
      this.proxPiscada -= dt;
      if (this.proxPiscada <= 0) {
        this.iniciarPiscada();
        this.proxPiscada = 2 + Math.random() * 4;
        if (Math.random() < .2) setTimeout(() => this.iniciarPiscada(), 260);
      }
    } else {
      this.piscando += dt;
      const p = this.piscando;
      this.piscar = p < .07 ? p / .07 : p < .18 ? 1 - (p - .07) / .11 : 0;
      if (p >= .18) { this.piscando = -1; this.piscar = 0; }
    }

    // brilhos do feliz
    if ((e === 'feliz' || e === 'feito' || e === 'testes') && m && !this.op.pequeno) {
      this.proxBrilho -= dt;
      if (this.proxBrilho <= 0) {
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.6;
        this.particulas.push({ x: Math.cos(a) * 1.4, y: Math.sin(a) * 1.25 - .1, vida: 0, dur: .9, tam: .07 + Math.random() * .06 });
        this.proxBrilho = .22;
      }
    }
    this.particulas = this.particulas.filter(p => (p.vida += dt) < p.dur);

    // molas, em passos curtos para não explodir
    const n = Math.ceil(dt / (1 / 240));
    for (let k = 0; k < n; k++) for (const mo of this.molas) mo.passo(dt / n);
  }

  // ---------- desenho ----------
  esfera(fy, fp, rx, ry) {
    const a = fy + this.yaw.v, b = fp + this.pitch.v;
    return { x: Math.sin(a) * Math.cos(b) * rx, y: -Math.sin(b) * ry, fx: Math.max(.15, Math.cos(a)), fp: Math.max(.15, Math.cos(b)) };
  }

  desenhar() {
    const c = this.ctx, R = this.R, cfg = this.cfg;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);

    const pulso = cfg.pulso && mov() ? .72 + .28 * Math.sin(this.t * 4) : 1;
    // o ronronar é uma vibração fina, quase só sentida
    const ronrona = this.estado === 'carinho' ? Math.sin(this.t * 95) * R * .014 * mov() : 0;
    const tremX = this.chacoalho.v * R * .06 + ronrona;
    const cx = this.cx, cy = this.cy;
    const y = cy + (this.pulo.v + this.balanco + this.afunda.v) * R;

    // halo da cor do estado: o gradiente fica na origem e o desenho anda até o gato (assim o mesmo
    // gradiente serve com o gato pulando)
    c.translate(cx, y);
    c.fillStyle = this.gradiente([0, 0, R * .4, 0, 0, R * (this.op.pequeno ? 1.6 : 2.1)],
      0, rgba(cfg.cor, cfg.brilho * pulso), 1, rgba(cfg.cor, 0));
    c.fillRect(-cx, -y, this.w, this.h);
    c.translate(-cx, -y);

    // sombra no chão
    if (!this.op.pequeno) {
      const alt = Math.max(0, -this.pulo.v);
      const sw = q4(R * .85 * (1 - alt * .7));
      c.save();
      c.translate(cx + tremX, cy + R * 1.55);
      c.scale(1, .2);
      c.fillStyle = this.gradiente([0, 0, 0, 0, 0, sw], 0, `rgba(0,0,0,${Math.round(.4 * (1 - alt) * 50) / 50})`, 1, 'rgba(0,0,0,0)');
      c.beginPath(); c.arc(0, 0, sw, 0, TAU); c.fill();
      c.restore();
    }

    c.save();
    c.translate(cx + tremX, y);
    c.rotate(this.roll.v + this.chacoalho.v * .04);

    const estica = Math.min(.12, Math.abs(this.pulo.vel) * .02);
    const sq = this.amasso.v;
    const rx = R * 1.07 * (1 + sq - this.resp * .5 - estica * .5);
    const ry = R * .95 * (1 - sq + this.resp + estica);
    // a luz e as sombras da cabeça usam o tamanho de repouso: assim cada gradiente é sempre o mesmo
    // (guardado), e o amasso de um pulo não se nota nelas
    const RX = R * 1.07, RY = R * .95;
    // dentro do recorte da cabeça, um retângulo basta para pintar a cabeça inteira
    const pintarCabeca = () => c.fillRect(-rx * 1.3, -ry * 1.3, rx * 2.6, ry * 2.6);

    for (const o of this.orelhas) this.desenharOrelha(o, rx, ry);

    // base com luz de cima à esquerda
    c.fillStyle = this.gradiente([-RX * .7, -RY * .9, RX * .7, RY * .95], 0, '#fffcf6', .55, '#f5ede2', 1, '#ddcfbd');
    tracarCabeca(c, rx, ry);
    c.fill();

    c.save();
    c.clip();

    // a mancha do frajola
    c.fillStyle = this.gradiente([-RX, -RY, RX * .25, RY * .35], 0, '#55525e', 1, '#1c1b21');
    this.tracarMancha(rx, ry);
    c.fill();

    // cor do estado subindo de baixo
    if (cfg.tinta) {
      c.fillStyle = this.gradiente([0, RY, 0, -RY * .2], 0, rgba(cfg.cor, cfg.tinta * (cfg.pulso ? pulso : 1)), 1, rgba(cfg.cor, 0));
      pintarCabeca();
    }

    // bochechas: o gradiente na origem, e o desenho anda com o olhar
    for (const s of [-1, 1]) {
      const q = this.esfera(s * .6, -.24, rx, ry);
      c.translate(q.x, q.y);
      c.fillStyle = this.gradiente([0, 0, 0, 0, 0, R * .2], 0, `rgba(255,135,160,${s < 0 ? .3 : .4})`, 1, 'rgba(255,135,160,0)');
      c.fillRect(-R * .25, -R * .25, R * .5, R * .5);
      c.translate(-q.x, -q.y);
    }

    // sombra nas bordas (dá o volume)
    c.fillStyle = this.gradiente([-RX * .15, -RY * .2, R * .45, 0, 0, R * 1.1],
      0, 'rgba(60,40,50,0)', .72, 'rgba(60,40,50,.05)', 1, 'rgba(45,28,40,.42)');
    pintarCabeca();

    // luz rebatida da cor do estado, embaixo
    c.fillStyle = this.gradiente([RX * .25, RY * 1.05, 0, RX * .25, RY * 1.05, R * .7],
      0, rgba(cfg.cor, .35 * (cfg.pulso ? pulso : 1)), 1, rgba(cfg.cor, 0));
    pintarCabeca();

    // brilho fixo: não gira com a cabeça
    c.fillStyle = this.gradiente([-RX * .3, -RY * .46, 0, -RX * .3, -RY * .46, R * .6], 0, 'rgba(255,255,255,.42)', 1, 'rgba(255,255,255,0)');
    pintarCabeca();
    c.save();
    c.translate(-rx * .38, -ry * .6);
    c.rotate(-.55);
    c.scale(1, .4);
    c.fillStyle = this.gradiente([0, 0, 0, 0, 0, R * .22], 0, 'rgba(255,255,255,.32)', 1, 'rgba(255,255,255,0)');
    c.beginPath(); c.arc(0, 0, R * .22, 0, TAU); c.fill();
    c.restore();

    // olhos (os que saltam da órbita são desenhados depois, fora do recorte)
    const saltando = cfg.olhos === 'saltando';
    if (!saltando) for (const s of [-1, 1]) this.desenharOlho(s, rx, ry);
    c.restore();

    // contorno (o recorte saiu com o restore; o caminho se traça de novo)
    c.lineWidth = Math.max(1, R * .03);
    c.strokeStyle = 'rgba(28,20,30,.5)';
    tracarCabeca(c, rx, ry);
    c.stroke();

    if (saltando) for (const s of [-1, 1]) this.desenharOlho(s, rx, ry);
    this.desenharNariz(rx, ry);
    this.desenharBigodes(rx, ry);
    if (cfg.caneca) this.desenharCaneca();
    this.desenharMaos();
    if (cfg.suor && !this.op.pequeno) this.desenharSuor(rx, ry);

    c.restore();

    // os "z" do cochilo, fora da cabeça (não giram com ela)
    for (const z of this.zs) {
      const k = z.vida / z.dur;
      c.save();
      c.globalAlpha = k < .15 ? k / .15 : k > .7 ? (1 - k) / .3 : 1;
      c.translate(cx + R * (.95 + k * .7 + Math.sin(k * 6 + z.lado * 4) * .12), y - R * (1.05 + k * (this.op.pequeno ? .55 : 1.1)));
      c.rotate(-.15 + z.lado * .3);
      desenharZ(c, R * (this.op.pequeno ? .13 : .08) * (.7 + k * .6));
      c.restore();
    }

    // brilhos
    c.save();
    c.fillStyle = '#ffd863';
    c.shadowColor = 'rgba(255,200,80,.9)';
    c.shadowBlur = R * .15;
    for (const p of this.particulas) {
      const k = p.vida / p.dur;
      const r = R * p.tam * Math.sin(k * Math.PI);
      estrela(c, cx + p.x * R, cy + (p.y - k * .25) * R, r);
    }
    c.restore();
  }

  // a mancha anda com o olhar; como a cabeça, vai direto no contexto, sem Path2D
  tracarMancha(rx, ry) {
    const c = this.ctx;
    const ox = this.yaw.v * rx * .55, oy = -this.pitch.v * ry * .35;
    const X = x => x * rx + ox, Y = y => y * ry + oy;
    c.beginPath();
    c.moveTo(X(.12), Y(-1.3));
    c.bezierCurveTo(X(.2), Y(-.75), X(.22), Y(-.32), X(-.02), Y(-.06));
    c.bezierCurveTo(X(-.28), Y(.2), X(-.72), Y(.26), X(-1.3), Y(.14));
    c.lineTo(X(-1.3), Y(-1.3));
    c.closePath();
  }

  desenharOrelha(o, rx, ry) {
    const c = this.ctx, R = this.R, s = o.s;
    const vib = this.cfg.orelhas === 'alerta' ? Math.sin(this.t * 38 + s) * .015 * mov()
              : this.cfg.orelhas === 'arrepiar' ? Math.sin(this.t * 55 + s) * .06 * mov() : 0;
    const ang = s * .78 + o.rot.v + vib;
    const bx = s * .78 * rx + this.yaw.v * R * .3;
    const by = -.74 * ry - this.pitch.v * R * .2;
    const lift = o.ergue.v * R;

    c.save();
    c.translate(bx + Math.sin(ang) * lift, by - Math.cos(ang) * lift);
    c.scale(this.op.orelha, this.op.orelha);
    c.rotate(ang);
    const gx = Math.cos(o.giro);
    c.scale(Math.abs(gx) < .05 ? .05 * Math.sign(gx || 1) : gx, 1);
    const frente = gx >= 0;
    const escura = s < 0;
    const selo = !escura && this.cfg.selo;
    c.lineJoin = 'round';

    // as formas da orelha só dependem do tamanho do gato: guardadas
    const forma = this.guardar('orelha', () => poliArredondado([[-.3 * R, .04 * R], [.3 * R, .04 * R], [0, -.66 * R]], .13 * R));
    c.fillStyle = escura
      ? this.gradiente([-.3 * R, -.66 * R, .3 * R, .05 * R], 0, frente ? '#57545f' : '#2a2830', 1, frente ? '#1c1b21' : '#131216')
      : this.gradiente([-.3 * R, -.66 * R, .3 * R, .05 * R], 0, frente ? '#fffbf4' : '#d6cab9', 1, frente ? '#e2d5c4' : '#b8ab9b');
    c.fill(forma);

    if (frente && selo) {
      // o selo (D7): o miolo vira uma placa da cor do estado, com o sinal sempre em pé. Na
      // pílula, a placa toma quase a orelha inteira: cada pixel conta
      const peq = this.op.pequeno;
      const placa = this.guardar('placa', () => (peq
        ? poliArredondado([[-.28 * R, .025 * R], [.28 * R, .025 * R], [0, -.63 * R]], .11 * R)
        : poliArredondado([[-.25 * R, 0], [.25 * R, 0], [0, -.58 * R]], .1 * R)));
      const cor = this.cfg.cor;
      c.fillStyle = this.gradiente([0, -.58 * R, 0, 0], 0, rgba(cor.map(v => Math.round(v + (255 - v) * .35)), 1), 1, rgba(cor, 1));
      c.fill(placa);
      c.lineWidth = Math.max(.8, .025 * R);
      c.strokeStyle = 'rgba(28,20,30,.45)';
      c.stroke(placa);
      c.save();
      c.translate(0, (peq ? -.18 : -.17) * R);
      c.rotate(-ang - this.roll.v - this.chacoalho.v * .04);
      c.fillStyle = c.strokeStyle = '#1d1720';
      desenharSelo(c, selo, (peq ? .155 : .13) * R, this.t, mov());
      c.restore();
    } else if (frente) {
      const dentro = this.guardar('miolo', () => poliArredondado([[-.16 * R, -.04 * R], [.16 * R, -.04 * R], [0, -.46 * R]], .07 * R));
      c.fillStyle = escura
        ? this.gradiente([0, -.42 * R, 0, -.04 * R], 0, '#93606f', 1, '#4a3540')
        : this.gradiente([0, -.42 * R, 0, -.04 * R], 0, '#ffc7d4', 1, '#ee96ad');
      c.fill(dentro);
      // brilho macio, recortado dentro da orelha
      c.save();
      c.clip(forma);
      c.fillStyle = this.gradiente([-.12 * R, -.36 * R, 0, -.12 * R, -.36 * R, .32 * R],
        0, escura ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.7)', 1, 'rgba(255,255,255,0)');
      c.fill(forma);
      c.restore();
    }
    c.lineWidth = Math.max(1, .03 * R);
    c.strokeStyle = 'rgba(28,20,30,.5)';
    c.stroke(forma);
    c.restore();
  }

  desenharOlho(s, rx, ry) {
    const c = this.ctx, R = this.R, tipo = this.cfg.olhos;
    const q = this.esfera(s * .4, .06, rx, ry);
    let w = .135 * R, h = .185 * R;
    if (tipo === 'pidao') { w *= 1.22; h *= 1.2; }
    if (tipo === 'esbugalhado') { w *= 1.42; h *= 1.42; }
    if (tipo === 'foco') h *= .55;
    if (tipo === 'deLado') h *= .62;
    if (tipo === 'meh') { h *= .5; w *= 1.05; }
    w *= q.fx; h *= q.fp;
    const claro = s < 0; // o olho dentro da mancha é claro, como no esboço

    c.save();
    c.translate(q.x, q.y);
    if (tipo === 'esbugalhado') c.translate(Math.sin(this.t * 47 + s) * R * .01 * mov(), 0);

    if (tipo === 'saltando') {
      // boing: o olho cresce, sai para fora e volta com mola
      const k = 1 + Math.max(-.3, this.olhoPulo.v) * .35;
      const ew = .2 * R * k * q.fx, eh = .25 * R * k;
      c.translate(s * this.olhoPulo.v * R * .02, -Math.max(0, this.olhoPulo.v) * R * .05);
      c.beginPath();
      c.ellipse(0, 0, ew, eh, 0, 0, TAU);
      c.fillStyle = this.gradiente([0, -eh, 0, eh], 0, claro ? '#fffaf0' : '#ffffff', 1, claro ? '#ecd3a5' : '#dcd6e0');
      c.fill();
      c.lineWidth = Math.max(1, R * .03);
      c.strokeStyle = CONTORNO;
      c.stroke();
      c.fillStyle = '#16111a';
      c.beginPath(); c.arc(0, eh * .1, ew * .32, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.95)';
      c.beginPath(); c.arc(-ew * .1, -eh * .05, ew * .1, 0, TAU); c.fill();
      c.restore();
      return;
    }

    if (tipo === 'espiral') {
      // tonto: olho redondo com uma espiral girando
      const r = .17 * R;
      c.scale(q.fx, q.fp);
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.fillStyle = claro ? '#fffaf0' : '#ffffff';
      c.fill();
      c.lineWidth = Math.max(.8, R * .022);
      c.strokeStyle = CONTORNO;
      c.stroke();
      c.rotate(this.t * 7 * mov() * s);
      c.beginPath();
      for (let k = 0; k <= 36; k++) {
        const a = k * .5, d = r * .85 * k / 36;
        if (k === 0) c.moveTo(0, 0); else c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      c.lineWidth = Math.max(.9, R * .032);
      c.lineCap = 'round';
      c.strokeStyle = '#241e28';
      c.stroke();
      c.restore();
      return;
    }

    if (tipo === 'dormindo') {
      // fechado, a curva para baixo (o contrário do feliz)
      c.beginPath();
      c.moveTo(-w * 1.15, -h * .05);
      c.quadraticCurveTo(0, h * .85, w * 1.15, -h * .05);
      c.lineCap = 'round';
      c.lineWidth = .07 * R;
      c.strokeStyle = claro ? '#fff3df' : '#241e28';
      c.stroke();
      c.restore();
      return;
    }

    if (tipo === 'cansado') {
      // meio fechado, com a pálpebra pesada reta em cima
      const hh = h * .95, corte = -hh * .05;
      c.save();
      c.beginPath();
      c.rect(-w * 1.5, corte, w * 3, hh * 2);
      c.clip();
      c.beginPath();
      c.ellipse(0, 0, w, hh, 0, 0, TAU);
      c.fillStyle = claro
        ? this.gradiente([0, corte, 0, hh], 0, '#fffaf0', 1, '#e9c88e')
        : this.gradiente([0, corte, 0, hh], 0, '#3d3443', 1, '#110d14');
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.beginPath(); c.arc(w * .25, hh * .45, w * .14, 0, TAU); c.fill();
      c.restore();
      c.beginPath();
      c.moveTo(-w * 1.2, corte + hh * .08);
      c.quadraticCurveTo(0, corte - hh * .12, w * 1.2, corte + hh * .08);
      c.lineCap = 'round';
      c.lineWidth = .06 * R;
      c.strokeStyle = claro ? '#fff3df' : '#241e28';
      c.stroke();
      c.restore();
      return;
    }

    if (tipo === 'feliz' || (tipo === 'piscadela' && !claro)) {
      c.beginPath();
      c.moveTo(-w * 1.1, h * .25);
      c.quadraticCurveTo(0, -h * 1.15, w * 1.1, h * .25);
      c.lineCap = 'round';
      c.lineWidth = .075 * R;
      c.strokeStyle = claro ? '#fff3df' : '#241e28';
      c.stroke();
      c.restore();
      return;
    }

    const aberto = 1 - this.piscar;
    const hh = h * Math.max(.08, aberto);
    c.beginPath();
    c.ellipse(0, 0, w, hh, 0, 0, TAU);
    c.fillStyle = claro
      ? this.gradiente([0, -hh, 0, hh], 0, '#fffaf0', 1, '#e9c88e')
      : this.gradiente([0, -hh, 0, hh], 0, '#3d3443', 1, '#110d14');
    c.fill();
    if (claro) { c.lineWidth = R * .02; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); }

    if (aberto > .4) {
      const grande = tipo === 'pidao' ? 1.35 : 1;
      c.fillStyle = 'rgba(255,255,255,.95)';
      c.beginPath(); c.ellipse(-w * .3, -hh * .4, w * .3 * grande, w * .3 * grande, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.beginPath(); c.arc(w * .32, hh * .4, w * .13 * grande, 0, TAU); c.fill();
      if (tipo === 'pidao') { c.beginPath(); c.arc(w * .05, hh * .6, w * .08, 0, TAU); c.fill(); }
    }
    c.restore();
  }

  desenharNariz(rx, ry) {
    const c = this.ctx, R = this.R;
    const q = this.esfera(0, -.17, rx, ry);
    c.save();
    c.translate(q.x, q.y);
    c.scale(q.fx, q.fp);
    const p = this.guardar('nariz', () => poliArredondado([[-.145 * R, -.085 * R], [.145 * R, -.085 * R], [0, .13 * R]], .055 * R));
    c.fillStyle = this.gradiente([0, -.09 * R, 0, .14 * R], 0, '#ffcad7', 1, '#e8718f');
    c.fill(p);
    c.lineWidth = Math.max(.8, .022 * R);
    c.strokeStyle = 'rgba(130,40,70,.5)';
    c.stroke(p);
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.ellipse(-.05 * R, -.045 * R, .05 * R, .022 * R, -.2, 0, TAU); c.fill();
    c.restore();
  }

  desenharBigodes(rx, ry) {
    if (this.op.pequeno) return;
    const c = this.ctx, R = this.R;
    const bases = [-0.2, 0.06, 0.32], comps = [.95, .92, .82];
    for (const b of this.bigodes) {
      const { s, i } = b;
      const q = this.esfera(s * (.2 + i * .035), -.2 - i * .075, rx, ry);
      const a = bases[i] + b.ang.v + b.osc;
      const L = R * comps[i] * b.comp.v;
      const ca = Math.cos(a), sa = Math.sin(a);
      let x1 = q.x + s * ca * L, y1 = q.y + sa * L;
      const mx = q.x + s * ca * L * .5, my = q.y + sa * L * .5;
      const curva = (.12 + b.dobra.v) * L;
      let kx = mx - s * sa * curva, ky = my + ca * curva;
      // com a mão de fora, os três bigodes viram o braço e terminam no punho
      const am = Math.max(0, Math.min(1, this.maos[s].tam.v));
      if (am > .001) {
        const p = this.punho(s);
        const tx = p.x, ty = p.y + (i - 1) * R * .022;
        x1 = lerp(x1, tx, am); y1 = lerp(y1, ty, am);
        kx = lerp(kx, (q.x + tx) / 2, am); ky = lerp(ky, (q.y + ty) / 2 + R * .08, am);
      }
      // contorno do bigode: grosso na raiz, fino na ponta
      const esq = [], dir = [], N = 12;
      for (let k = 0; k <= N; k++) {
        const u = k / N, v = 1 - u;
        const px = v * v * q.x + 2 * v * u * kx + u * u * x1;
        const py = v * v * q.y + 2 * v * u * ky + u * u * y1;
        const dx = 2 * v * (kx - q.x) + 2 * u * (x1 - kx);
        const dy = 2 * v * (ky - q.y) + 2 * u * (y1 - ky);
        const len = Math.hypot(dx, dy) || 1;
        const lw = R * lerp(.034, .011, u);
        esq.push([px - dy / len * lw, py + dx / len * lw]);
        dir.push([px + dy / len * lw, py - dx / len * lw]);
      }
      // o caminho vai direto no contexto, sem Path2D: o bigode muda a cada quadro e não se guarda
      // (o contorno das duas partes é desenhado antes do recheio das duas, como antes)
      const tracar = parte => {
        c.beginPath();
        if (parte === 'raiz') { c.arc(q.x, q.y, R * .034, 0, TAU); return; }
        c.moveTo(...esq[0]);
        for (const p of esq) c.lineTo(...p);
        for (let k = dir.length - 1; k >= 0; k--) c.lineTo(...dir[k]);
        c.closePath();
      };
      c.lineJoin = 'round';
      c.lineWidth = R * .028;
      c.strokeStyle = 'rgba(30,22,32,.72)';
      tracar('forma'); c.stroke();
      tracar('raiz'); c.stroke();
      c.fillStyle = '#f8f2e8';
      tracar('forma'); c.fill();
      tracar('raiz'); c.fill();
    }
  }

  punho(s) {
    const mao = this.maos[s], g = GESTOS[mao.gesto ?? mao.ultimo];
    const a = mov() ? g.anim(this.t, this) : {};
    return {
      x: s * (mao.wx.v + (a.dx || 0)) * this.R + this.yaw.v * this.R * .25,
      y: (mao.wy.v + (a.dy || 0)) * this.R,
      ang: mao.ang.v + (a.da || 0),
    };
  }

  desenharMaos() {
    const c = this.ctx, R = this.R;
    for (const s of [-1, 1]) {
      const mao = this.maos[s], tam = mao.tam.v;
      if (tam < .02) continue;
      const nome = mao.gesto ?? mao.ultimo;
      // na pílula, só a patadinha: os outros gestos não se leem em 34 px
      if (this.op.pequeno && nome !== 'patada') continue;
      const g = GESTOS[nome];
      const p = this.punho(s);
      const u = R * .19 * g.esc * (this.op.pequeno ? 1.35 : 1);
      c.save();
      c.translate(p.x, p.y);
      c.scale(s * tam, tam);
      c.rotate(p.ang);
      const recheio = this.gradiente([-1.6 * u, -3 * u, 1.6 * u, .4 * u], 0, '#fffdf8', 1, '#ddcfbd');
      desenharMao(c, g.mao, u, Math.max(R * .014, this.op.pequeno ? .6 : 0) / Math.max(.4, tam), recheio);
      c.restore();
    }
  }

  // a caneca de café da maratona, com vapor; na ilha, segura pelas luvinhas; na pílula, ao lado
  desenharCaneca() {
    const c = this.ctx, R = this.R, peq = this.op.pequeno, m = mov();
    const x = (peq ? 1.02 : 0) * R, y = (peq ? .55 : 1.02) * R;
    const w = (peq ? .55 : .66) * R, h = (peq ? .5 : .56) * R, topo = y - h / 2;
    // vapor: duas fitas que sobem ondulando e somem
    c.save();
    c.lineCap = 'round';
    c.lineWidth = Math.max(1, R * (peq ? .07 : .045));
    for (let i = 0; i < 2; i++) {
      const x0 = x + (i - .5) * w * .38;
      const alto = R * (peq ? .45 : .42);
      c.beginPath();
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const px = x0 + Math.sin(f * 5 + this.t * 3 * m + i * 2) * R * .05;
        const py = topo - R * .05 - f * alto;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.strokeStyle = this.gradiente([0, topo, 0, topo - alto], 0, 'rgba(255,255,255,.75)', 1, 'rgba(255,255,255,0)');
      c.stroke();
    }
    c.restore();
    const lw = Math.max(1, R * .03);
    // alça, do lado de fora
    c.beginPath();
    c.arc(x + w * .5, y, h * .26, -Math.PI / 2, Math.PI / 2);
    c.lineWidth = R * .07 + lw * 2;
    c.strokeStyle = CONTORNO;
    c.stroke();
    c.lineWidth = R * .07;
    c.strokeStyle = '#d9694a';
    c.stroke();
    // corpo
    c.beginPath();
    c.roundRect(x - w / 2, topo, w, h, R * .09);
    c.fillStyle = this.gradiente([x - w / 2, 0, x + w / 2, 0], 0, '#f39a72', 1, '#bf4f37');
    c.fill();
    c.lineWidth = lw;
    c.strokeStyle = CONTORNO;
    c.stroke();
    // o café
    c.beginPath();
    c.ellipse(x, topo + R * .02, w * .42, R * .045, 0, 0, TAU);
    c.fillStyle = '#4a2a1c';
    c.fill();
    // brilho
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.fillRect(x - w * .32, topo + h * .25, w * .1, h * .5);
  }

  desenharSuor(rx, ry) {
    const c = this.ctx, R = this.R;
    const k = (this.tEstado * .7) % 1;
    const r = R * .07;
    c.save();
    c.globalAlpha = k < .8 ? 1 : 1 - (k - .8) / .2;
    c.translate(rx * .8, -ry * .38 + k * ry * .35);
    c.beginPath();
    c.moveTo(0, -1.7 * r);
    c.bezierCurveTo(r * .9, -.4 * r, r, r * .9, 0, r);
    c.bezierCurveTo(-r, r * .9, -r * .9, -.4 * r, 0, -1.7 * r);
    c.fillStyle = this.gradiente([0, -1.7 * r, 0, r], 0, '#e2f5ff', 1, '#5eaeea');
    c.fill();
    c.lineWidth = Math.max(.8, R * .02);
    c.strokeStyle = 'rgba(20,60,110,.5)';
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.arc(-r * .3, 0, r * .25, 0, TAU); c.fill();
    c.restore();
  }
}
