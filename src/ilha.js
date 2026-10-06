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
  erro: 'erro', fim: 'feliz', saida: 'parado', noTerminal: 'esperando', respondido: 'trabalhando',
  negado: 'negou', encerrado: 'parado',
};
let ultimoStatus = null; // o último evento que não é pedido, para voltar a ele quando os pedidos acabam

// Como um pedido sai da tela vira o status que fica no lugar dele, até o próximo evento da sessão.
const DEPOIS_DO_PEDIDO = {
  // sem decisão da ilha: a sessão está parada, esperando você no terminal
  noTerminal: e => ({ tipo: 'noTerminal', resumo: TEXTOS.eventos.noTerminal(e.resumo) }),
  // a sessão andou depois do pedido: você respondeu no terminal
  respondido: e => ({ tipo: 'respondido', resumo: TEXTOS.eventos.respondido(e.resumo) }),
  // a fonte fechou a conexão (Esc, ou o Claude Code saiu): não dá para dizer o que aconteceu
  encerrado: e => ({ tipo: 'encerrado', resumo: TEXTOS.eventos.encerrado(e.resumo) }),
  negado: e => ({ tipo: 'negado', resumo: TEXTOS.eventos.negado(e.pedido?.alvo ?? e.resumo) }),
  // permitido: a ferramenta vai rodar, e o resumo dela ("Rodando npm test") volta a valer
  permitido: e => ({ tipo: 'ferramenta', resumo: e.resumo }),
};

// O pedido que está na tela, e desde quando. Um clique só vale para o pedido que estava na tela
// quando o botão foi APERTADO, e só se ele já estava visível havia um instante: apertar no pedido A
// e soltar depois de o B tomar o lugar não aprova o B, e o segundo clique de um clique duplo
// (o Windows aceita até 500 ms entre os dois) também não.
const ESPERA_DECIDIR = 600; // ms
const naTela = { id: null, desde: 0 };
let gesto = null; // { id, valido } do botão apertado

function decidir(id, decisao) {
  // "No terminal" traz a janela do terminal para a frente antes de soltar o pedido, enquanto o
  // Rust ainda sabe de quem ele é. Não achar a janela não impede nada.
  const antes = decisao === 'terminal' ? invoke('trazer_janela_do_pedido', { id }).catch(() => false) : Promise.resolve();
  antes.then(() => Ponte.responder(id, decisao)).catch(err => console.error('[xereta]', err));
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

// o pedido na tela: "korus · quer rodar · Claude Code", o alvo e os botões
function mostrarPedido(evento, mais) {
  definirEstado('esperando');
  const { verbo, alvo } = evento.pedido ?? { verbo: '', alvo: evento.resumo };
  const fonte = TEXTOS.fontes[evento.fonte] ?? evento.fonte;
  escrever({
    titulo: evento.projeto ?? TEXTOS.app,
    subtitulo: [TEXTOS.ilha.quer(verbo), fonte, mais ? TEXTOS.ilha.maisPedidos(mais) : ''].filter(Boolean).join(' · '),
    pilula: evento.resumo,
  });
  $('alvo').textContent = alvo;
  $('alvo').title = alvo;
}

// O pedido aberto mais antigo manda na ilha; sem pedidos, vale o último status.
function aoMudarPonte({ evento, abertos, saiu }) {
  if (evento && evento.tipo !== 'permissao') ultimoStatus = evento;
  // O status que fica no lugar do pedido que saiu. Se a sessão já andou depois do pedido (até
  // terminou), o aviso chegou atrasado e não vale mais.
  const sessaoAndou = ultimoStatus?.sessao === saiu?.evento.sessao && ultimoStatus?.chegou > saiu?.evento.chegou;
  if (saiu && !sessaoAndou) ultimoStatus = { ...saiu.evento, ...DEPOIS_DO_PEDIDO[saiu.como](saiu.evento) };

  const primeiro = abertos[0]?.id ?? null;
  if (primeiro !== naTela.id) {
    naTela.id = primeiro;
    naTela.desde = performance.now();
    gesto = null; // um botão apertado no pedido anterior não vale para este
  }
  el.classList.toggle('pedindo', abertos.length > 0);
  if (abertos.length) {
    mostrarPedido(abertos[0].evento, abertos.length - 1);
    abrirParaOPedido();
    return;
  }
  if (ultimoStatus) mostrarEvento(ultimoStatus);
  else mostrarOciosa(); // título, subtítulo e alvo do pedido que acabou não podem ficar para trás
  if (!mouseDentro) agendarRecolher(); // a ilha só ficou aberta por causa do pedido
}

// os botões do pedido; o clique não chega ao gato (que seria cutucado)
for (const bt of document.querySelectorAll('.acoes button')) {
  bt.textContent = TEXTOS.ilha[{ permitir: 'permitir', negar: 'negar', terminal: 'noTerminal' }[bt.dataset.decisao]];
  bt.addEventListener('pointerdown', () => {
    gesto = { id: naTela.id, valido: naTela.id !== null && performance.now() - naTela.desde >= ESPERA_DECIDIR };
  });
  bt.addEventListener('click', ev => {
    ev.stopPropagation();
    const g = gesto;
    gesto = null;
    if (g?.valido && g.id === naTela.id) decidir(g.id, bt.dataset.decisao);
  });
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
  // com um pedido na tela a ilha não recolhe: os botões sumiriam (P1, emenda da E4)
  if (!expandida || Ponte.abertos.length) return;
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

let mouseDentro = false;
function agendarRecolher() {
  clearTimeout(timerRecolher);
  timerRecolher = setTimeout(recolher, ESPERA_RECOLHER);
}
// um pedido abre a ilha sozinho, sem o mouse (e sem roubar o foco: a janela não pega foco, D13)
function abrirParaOPedido() {
  if (!pausada) expandir();
}

el.addEventListener('mouseenter', () => { mouseDentro = true; expandir(); });
el.addEventListener('mouseleave', () => { mouseDentro = false; agendarRecolher(); });

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

  // Os pedidos se respondem só pelos botões da ilha (E4). A bandeja respondia até a E4, mas um
  // menu aberto pode mostrar um pedido que já trocou, e o clique iria para o pedido errado.

  const pausar = await MenuItem.new({
    id: 'pausar',
    text: TEXTOS.bandeja.pausar,
    action: async () => {
      pausada = !pausada;
      if (pausada) await janela.hide();
      else await janela.show();
      if (!pausada && Ponte.abertos.length) abrirParaOPedido(); // chegou um pedido durante a pausa
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
