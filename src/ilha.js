// A ilha: pílula recolhida ↔ ilha expandida, o gato e o ícone na bandeja.
// Tudo em JS pela API do Tauri; do Rust só vem o recorte da janela (D2).
'use strict';

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow, primaryMonitor, currentMonitor } = window.__TAURI__.window;
const { LogicalSize, PhysicalPosition } = window.__TAURI__.dpi;
const { TrayIcon } = window.__TAURI__.tray;
const { Menu, Submenu, MenuItem, PredefinedMenuItem } = window.__TAURI__.menu;
const { defaultWindowIcon } = window.__TAURI__.app;

const TAMANHO = { recolhida: [140, 34], expandida: [420, 110] };
const MARGEM_TOPO = 8;          // px lógicos entre a ilha e o topo da tela
const ESPERA_RECOLHER = 1000;   // ms depois de o mouse sair

const janela = getCurrentWindow();
const el = document.getElementById('ilha');
const $ = id => document.getElementById(id);

// ---------- janela na forma da ilha (D11) ----------
// A janela fica sempre do tamanho da ilha expandida, centralizada no topo, e o Rust a recorta
// na forma da ilha: fora do recorte o clique cai no app de trás. Mover e redimensionar a
// janela a cada hover fazia a pílula pular de lado e o WebView mostrar um quadro velho.
const RAIO = { recolhida: 17, expandida: 28 };
let esc = 1; // escala da janela (DPI), lida depois de posicioná-la

async function posicionarJanela() {
  const monitor = (await primaryMonitor()) ?? (await currentMonitor());
  const m = monitor.scaleFactor;
  const [largura, altura] = TAMANHO.expandida;
  const x = monitor.position.x + Math.round((monitor.size.width - largura * m) / 2);
  const y = monitor.position.y + Math.round(MARGEM_TOPO * m);
  await janela.setSize(new LogicalSize(largura, altura));
  await janela.setPosition(new PhysicalPosition(x, y));
  esc = await janela.scaleFactor();
}

function recortar(forma) {
  const [largura, altura] = TAMANHO[forma];
  const x = (TAMANHO.expandida[0] - largura) / 2; // a ilha é centrada na janela (ilha.css)
  const px = v => Math.round(v * esc);
  return invoke('recortar', { x: px(x), y: 0, largura: px(largura), altura: px(altura), raio: px(RAIO[forma]) });
}

// ---------- o gato ----------
const gatoPilula = new Gato($('gato-pilula'), { pequeno: true, raio: 12, cx: 22, cy: 19 });
const gatoIlha = new Gato($('gato-ilha'), { raio: 27, cx: 52, cy: 60 });
gatoPilula.ativo = true;
gatoIlha.ativo = false;

function definirEstado(e) {
  gatoPilula.mudarEstado(e);
  gatoIlha.mudarEstado(e);
  const t = TEXTOS.estados[e];
  $('texto-pilula').textContent = t.pilula;
  $('fala').textContent = t.fala;
}

$('titulo').textContent = TEXTOS.app;
$('subtitulo').textContent = TEXTOS.ilha.modoTeste;
$('dica').textContent = TEXTOS.ilha.dicaTeste;

el.addEventListener('pointermove', ev => {
  mascote.ponteiro.x = ev.clientX;
  mascote.ponteiro.y = ev.clientY;
  mascote.ponteiro.ativo = true;
});
el.addEventListener('pointerleave', () => { mascote.ponteiro.ativo = false; });
el.addEventListener('click', () => (expandida ? gatoIlha : gatoPilula).cutucar());

// ---------- expandir e recolher ----------
// Expandir: o recorte cresce primeiro (o que aparece é transparente), depois o CSS anima a ilha.
// Recolher: o CSS anima, e só no fim o recorte volta para a pílula.
let pronta = false; // só reage ao mouse depois do primeiro posicionamento e recorte
let expandida = false;
let timerRecolher = null;
let timerFim = null;

// o fim da transição do CSS, com uma folga; com "reduzir movimento" ela dura 1 ms, e o recorte
// grande não pode ficar pegando clique depois de a ilha já ter encolhido
function duracaoAnimacao() {
  return parseFloat(getComputedStyle(el).getPropertyValue('--duracao')) + 20;
}

async function expandir() {
  clearTimeout(timerRecolher);
  if (!pronta || expandida) return;
  expandida = true;
  clearTimeout(timerFim);
  try {
    await recortar('expandida');
  } catch (err) {
    expandida = false; // sem recorte grande a ilha aberta sairia cortada: fica recolhida
    console.error('[xereta]', err);
    return;
  }
  if (!expandida) return; // o mouse já saiu enquanto o recorte crescia
  gatoIlha.ativo = true;
  el.classList.add('expandida');
  timerFim = setTimeout(() => { if (expandida) gatoPilula.ativo = false; }, duracaoAnimacao());
}

function recolher() {
  if (!expandida) return;
  expandida = false;
  gatoPilula.ativo = true;
  el.classList.remove('expandida');
  clearTimeout(timerFim);
  timerFim = setTimeout(() => {
    if (expandida) return;
    gatoIlha.ativo = false;
    recortar('recolhida').catch(err => console.error('[xereta]', err));
  }, duracaoAnimacao());
}

el.addEventListener('mouseenter', expandir);
el.addEventListener('mouseleave', () => {
  clearTimeout(timerRecolher);
  timerRecolher = setTimeout(recolher, ESPERA_RECOLHER);
});

// ---------- bandeja ----------
let pausada = false;

async function criarBandeja() {
  // no dev, recarregar a página não pode deixar dois ícones
  const antiga = await TrayIcon.getById('xereta');
  if (antiga) await antiga.close();

  const item = e => MenuItem.new({ id: `estado:${e}`, text: TEXTOS.estados[e].rotulo, action: () => definirEstado(e) });
  const chaves = Object.keys(ESTADOS);
  const principais = await Promise.all(chaves.filter(e => !ESTADOS[e].extra).map(item));
  const extras = await Promise.all(chaves.filter(e => ESTADOS[e].extra).map(item));

  const estadoTeste = await Submenu.new({
    text: TEXTOS.bandeja.estadoTeste,
    items: [
      ...principais,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await Submenu.new({ text: TEXTOS.bandeja.carasExtras, items: extras }),
    ],
  });

  const pausar = await MenuItem.new({
    id: 'pausar',
    text: TEXTOS.bandeja.pausar,
    action: async () => {
      pausada = !pausada;
      if (pausada) await janela.hide();
      else await janela.show();
      await pausar.setText(pausada ? TEXTOS.bandeja.mostrar : TEXTOS.bandeja.pausar);
    },
  });
  const sair = await MenuItem.new({ id: 'sair', text: TEXTOS.bandeja.sair, action: () => janela.destroy() });

  const menu = await Menu.new({
    items: [estadoTeste, await PredefinedMenuItem.new({ item: 'Separator' }), pausar, sair],
  });
  await TrayIcon.new({
    id: 'xereta',
    icon: await defaultWindowIcon(),
    tooltip: TEXTOS.bandeja.dica,
    menu,
    showMenuOnLeftClick: true,
  });
}

// ---------- laço de desenho ----------
// Recolhida, a ilha desenha a 30 quadros por segundo: ela fica aberta o dia todo.
let ultimo = performance.now();
let acumulado = 0;
function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(.05, (agora - ultimo) / 1000);
  ultimo = agora;
  if (pausada) return;
  acumulado += dt;
  if (!expandida && acumulado < 1 / 31) return;
  for (const g of [gatoPilula, gatoIlha]) {
    if (!g.ativo) continue;
    g.atualizar(acumulado);
    g.desenhar();
  }
  acumulado = 0;
}

// ---------- escala do Windows mudou com o app aberto ----------
// Posição, recorte e canvas dependem da escala: refaz os três.
janela.onScaleChanged(async () => {
  await posicionarJanela();
  await recortar(expandida ? 'expandida' : 'recolhida');
  for (const g of [gatoPilula, gatoIlha]) { g.redimensionar(); g.desenhar(); }
}).catch(err => console.error('[xereta]', err));

// ---------- início ----------
(async () => {
  definirEstado('parado');
  await posicionarJanela();
  await recortar('recolhida');
  pronta = true;
  // desenha a pílula já, sem esperar o laço: dois quadros a 144 Hz não bastam para o
  // primeiro desenho dele, que vai a 30 qps
  gatoPilula.atualizar(0);
  gatoPilula.desenhar();
  requestAnimationFrame(quadro);
  // só mostra depois do primeiro quadro desenhado, para não piscar fundo branco (V4)
  requestAnimationFrame(() => requestAnimationFrame(() => janela.show()));
  await criarBandeja();
})().catch(err => console.error('[xereta]', err));
