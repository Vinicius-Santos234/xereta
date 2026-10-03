// A ilha: pílula recolhida ↔ ilha expandida, o gato e o ícone na bandeja.
// Tudo em JS pela API do Tauri; o Rust não sabe nada disto (D2).
'use strict';

const { getCurrentWindow, primaryMonitor, currentMonitor } = window.__TAURI__.window;
const { LogicalSize, PhysicalPosition } = window.__TAURI__.dpi;
const { TrayIcon } = window.__TAURI__.tray;
const { Menu, Submenu, MenuItem, PredefinedMenuItem } = window.__TAURI__.menu;
const { defaultWindowIcon } = window.__TAURI__.app;

const TAMANHO = { recolhida: [140, 34], expandida: [420, 110] };
const MARGEM_TOPO = 8;          // px lógicos entre a ilha e o topo da tela
const ESPERA_RECOLHER = 1000;   // ms depois de o mouse sair
const DURACAO_ANIMACAO = 220;   // um pouco mais que a transição do CSS

const janela = getCurrentWindow();
const el = document.getElementById('ilha');
const $ = id => document.getElementById(id);

// ---------- janela do tamanho da ilha (D11) ----------
let monitor = null;
async function ajustarJanela([largura, altura]) {
  monitor ??= (await primaryMonitor()) ?? (await currentMonitor());
  const esc = monitor.scaleFactor;
  const x = monitor.position.x + Math.round((monitor.size.width - largura * esc) / 2);
  const y = monitor.position.y + Math.round(MARGEM_TOPO * esc);
  // as duas chamadas saem juntas para a ilha não aparecer um quadro fora do centro
  await Promise.all([
    janela.setPosition(new PhysicalPosition(x, y)),
    janela.setSize(new LogicalSize(largura, altura)),
  ]);
}

// ---------- o gato ----------
const gatoPilula = new Gato($('gato-pilula'), { pequeno: true, raio: 16, cx: 30, cy: 25 });
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
// Expandir: a janela cresce primeiro (é transparente), depois o CSS anima a ilha.
// Recolher: o CSS anima, e só no fim a janela encolhe de volta.
let expandida = false;
let timerRecolher = null;
let timerFim = null;

async function expandir() {
  clearTimeout(timerRecolher);
  if (expandida) return;
  expandida = true;
  clearTimeout(timerFim);
  await ajustarJanela(TAMANHO.expandida);
  if (!expandida) return; // o mouse já saiu enquanto a janela crescia
  gatoIlha.ativo = true;
  el.classList.add('expandida');
  timerFim = setTimeout(() => { if (expandida) gatoPilula.ativo = false; }, DURACAO_ANIMACAO);
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
    ajustarJanela(TAMANHO.recolhida);
  }, DURACAO_ANIMACAO);
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

// ---------- início ----------
(async () => {
  definirEstado('parado');
  await ajustarJanela(TAMANHO.recolhida);
  requestAnimationFrame(quadro);
  // só mostra depois do primeiro quadro desenhado, para não piscar fundo branco (V4)
  requestAnimationFrame(() => requestAnimationFrame(() => janela.show()));
  await criarBandeja();
})().catch(err => console.error('[xereta]', err));
