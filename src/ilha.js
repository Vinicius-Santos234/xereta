// A ilha: pílula recolhida ↔ ilha expandida, o gato, o ícone na bandeja e o que as fontes
// contam. Tudo em JS pela API do Tauri; do Rust vêm o recorte da janela e a ponte (D2).
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

function escrever({ titulo = TEXTOS.app, subtitulo = '', pilula, fala, dica = '' }) {
  $('titulo').textContent = titulo;
  $('subtitulo').textContent = subtitulo;
  if (pilula !== undefined) $('texto-pilula').textContent = pilula;
  if (fala !== undefined) $('fala').textContent = fala;
  $('dica').textContent = dica;
}

// a ilha sem nada para contar: o subtítulo vira "ouvindo na porta …" quando a ponte liga
let ociosa = { subtitulo: TEXTOS.ilha.modoTeste, dica: TEXTOS.ilha.dicaTeste };
function mostrarOciosa() {
  definirEstado('parado');
  escrever(ociosa);
}
escrever(ociosa);

// ---------- o que as fontes contam (E2) ----------
// Tipo do formato comum (§4) → cara do gato.
const ESTADO_DO_TIPO = {
  inicio: 'oi', pensando: 'pensando', ferramenta: 'trabalhando', permissao: 'esperando',
  erro: 'erro', fim: 'feliz', saida: 'parado', noTerminal: 'esperando',
};
let ultimoStatus = null; // o último evento que não é pedido, para voltar a ele quando os pedidos acabam

// O pedido que está na tela, e desde quando. Uma decisão só vale para ele, e só depois de ele
// estar visível por um instante: um clique duplo não pode aprovar o próximo pedido, que acabou
// de aparecer no lugar do anterior.
const ESPERA_DECIDIR = 400; // ms
const naTela = { id: null, desde: 0 };

function decidir(decisao) {
  if (naTela.id === null || performance.now() - naTela.desde < ESPERA_DECIDIR) return;
  Ponte.responder(naTela.id, decisao).catch(err => console.error('[xereta]', err));
}

function mostrarEvento(evento) {
  definirEstado(ESTADO_DO_TIPO[evento.tipo] ?? 'parado');
  escrever({
    titulo: evento.projeto ?? TEXTOS.app,
    subtitulo: TEXTOS.fontes[evento.fonte] ?? evento.fonte,
    pilula: evento.resumo,
    fala: evento.resumo,
  });
}

// O pedido aberto mais antigo manda na ilha; sem pedidos, vale o último status.
function aoMudarPonte({ evento, abertos, paraOTerminal }) {
  if (evento && evento.tipo !== 'permissao') ultimoStatus = evento;
  // um pedido que foi para o terminal não pode deixar a ilha dizendo "Escrevendo…": a sessão está
  // parada, esperando você lá. O próximo evento da sessão substitui este.
  // Se a sessão já andou depois do pedido (respondido no terminal, ou até terminou), o aviso de
  // terminal chegou atrasado e não vale mais.
  const sessaoAndou = ultimoStatus?.sessao === paraOTerminal?.sessao && ultimoStatus?.chegou > paraOTerminal?.chegou;
  if (paraOTerminal && !sessaoAndou) {
    ultimoStatus = { ...paraOTerminal, tipo: 'noTerminal', resumo: TEXTOS.eventos.noTerminal(paraOTerminal.resumo) };
  }
  atualizarBandeja(abertos);
  const primeiro = abertos[0]?.id ?? null;
  if (primeiro !== naTela.id) {
    naTela.id = primeiro;
    naTela.desde = performance.now();
  }
  if (abertos.length) {
    mostrarEvento(abertos[0].evento);
    const mais = abertos.length > 1 ? `  ${TEXTOS.ilha.maisPedidos(abertos.length - 1)}` : '';
    $('dica').textContent = TEXTOS.ilha.dicaPedido + mais;
  } else if (ultimoStatus) {
    mostrarEvento(ultimoStatus);
  } else {
    mostrarOciosa(); // título, subtítulo e dica do pedido que acabou não podem ficar para trás
  }
}

function mostrarErroPonte(erro) {
  const texto = (TEXTOS.errosPonte[erro?.codigo] ?? TEXTOS.errosPonte.falha)(erro?.porta);
  definirEstado('erro');
  escrever({ subtitulo: '', ...texto });
}

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
let menuPedido = null; // o submenu de responder o pedido (até a E4)

// sem pedido aberto, o submenu fica cinza: um clique nele não pode parecer que respondeu algo
function atualizarBandeja(abertos) {
  if (!menuPedido) return;
  const p = abertos[0];
  const texto = p ? TEXTOS.bandeja.pedidoAberto(p.evento.resumo) : TEXTOS.bandeja.semPedido;
  Promise.all([menuPedido.setText(texto), menuPedido.setEnabled(Boolean(p))])
    .catch(err => console.error('[xereta]', err));
}

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

  // até a E4 ter os botões na ilha, o pedido aberto se responde por aqui
  const responderTeste = decisao => MenuItem.new({
    id: `pedido:${decisao}`,
    text: TEXTOS.bandeja[decisao === 'terminal' ? 'noTerminal' : decisao],
    action: () => decidir(decisao),
  });
  const pedidoTeste = await Submenu.new({
    text: TEXTOS.bandeja.semPedido,
    enabled: false,
    items: await Promise.all(['permitir', 'negar', 'terminal'].map(responderTeste)),
  });
  menuPedido = pedidoTeste;
  atualizarBandeja(Ponte.abertos);

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
    items: [estadoTeste, pedidoTeste, await PredefinedMenuItem.new({ item: 'Separator' }), pausar, sair],
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
// Recolhida, a ilha desenha a 15 quadros por segundo: ela fica aberta o dia todo. A 30 qps, o
// WebView2 guardava a memória de cada desenho do canvas e só a devolvia de tempos em tempos
// (serra de ~80 a ~220 MB); a 15 qps ela fica plana. Expandida, vai no ritmo da tela, até 60
// qps: num monitor de 144 Hz, desenhar a cada quadro seria mais que o dobro do necessário.
const QPS_RECOLHIDA = 15;
const QPS_EXPANDIDA = 60;
let ultimo = performance.now();
let acumulado = 0;
function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(.05, (agora - ultimo) / 1000);
  ultimo = agora;
  if (pausada) return;
  acumulado += dt;
  if (acumulado < 1 / ((expandida ? QPS_EXPANDIDA : QPS_RECOLHIDA) + .5)) return;
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
  // primeiro desenho dele, que vai a 15 qps
  gatoPilula.atualizar(0);
  gatoPilula.desenhar();
  requestAnimationFrame(quadro);
  // só mostra depois do primeiro quadro desenhado, para não piscar fundo branco (V4)
  requestAnimationFrame(() => requestAnimationFrame(() => janela.show()));
  await criarBandeja();
  // por último: a ponte só liga quando a ilha já sabe mostrar o que chega
  try {
    const porta = await Ponte.ligar(aoMudarPonte);
    ociosa = { ...ociosa, subtitulo: TEXTOS.ilha.ouvindo(porta) };
    $('subtitulo').textContent = ociosa.subtitulo;
  } catch (err) {
    console.error('[xereta] ponte', err?.codigo, err?.detalhe ?? err);
    mostrarErroPonte(err);
  }
})().catch(err => console.error('[xereta]', err));
