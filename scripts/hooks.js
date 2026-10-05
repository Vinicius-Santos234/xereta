// npm run hooks -- instalar | remover | estado   [--sim] [--confirmar <código>]
//
// Instala ou remove os hooks do Xereta no ~/.claude/settings.json (E3, D14 da 001): mostra o diff
// antes, só grava depois de confirmar, faz backup com data, grava de forma atômica e recusa gravar
// se o arquivo mudou desde a prévia. A lógica de mesclar fica em src/hooks/mesclar.js, sem I/O, e a
// gravação em scripts/gravar.js.
//
// XERETA_SETTINGS e XERETA_CONFIG trocam os caminhos (para testar numa cópia).
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { contar, diffLinhas, trechos } from '../src/diff.js';
import { FormatoInesperado, chavesCriadas, estado, instalar, remover } from '../src/hooks/mesclar.js';
import { carregar } from './classico.js';
import { ArquivoMudou, gravar, lerOuNull, limparTemporarios, sha256 } from './gravar.js';

const T = carregar(['src/textos/pt-BR.js'], ['TEXTOS']).TEXTOS.instalador;

const ARQ_SETTINGS = process.env.XERETA_SETTINGS ?? join(homedir(), '.claude', 'settings.json');
const ARQ_CONFIG = process.env.XERETA_CONFIG ?? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'app.xereta.ilha', 'config.json');
// quais chaves do settings.json o próprio Xereta criou, para remover devolver o arquivo igual
const ARQ_INSTALACAO = join(dirname(ARQ_CONFIG), 'instalacao.json');

const cor = process.stdout.isTTY
  ? { verde: s => `\x1b[32m${s}\x1b[0m`, vermelho: s => `\x1b[31m${s}\x1b[0m`, cinza: s => `\x1b[90m${s}\x1b[0m` }
  : { verde: s => s, vermelho: s => s, cinza: s => s };

function sair(mensagem, codigo = 1) {
  console.log(mensagem);
  process.exit(codigo);
}

function lerConfig() {
  const texto = lerOuNull(ARQ_CONFIG);
  if (texto === null) sair(T.semConfig(ARQ_CONFIG));
  let c;
  try { c = JSON.parse(texto); } catch { sair(T.configInvalida(ARQ_CONFIG)); }
  if (!Number.isInteger(c?.porta) || !/^[0-9a-f]{64}$/.test(String(c?.token))) sair(T.configInvalida(ARQ_CONFIG));
  return { porta: c.porta, token: c.token };
}

// a anotação é do Xereta, não do usuário: se estiver estragada, vale o palpite de mesclar.js
function lerAnotacoes() {
  try { return JSON.parse(lerOuNull(ARQ_INSTALACAO) ?? '{}') ?? {}; } catch { return {}; }
}
function anotar(criadas) {
  const anotacoes = lerAnotacoes();
  if (criadas) anotacoes[ARQ_SETTINGS] = criadas;
  else delete anotacoes[ARQ_SETTINGS];
  try { writeFileSync(ARQ_INSTALACAO, JSON.stringify(anotacoes, null, 2) + '\n', 'utf8'); } catch { /* sem anotação, vale o palpite */ }
}

function lerSettings() {
  const texto = lerOuNull(ARQ_SETTINGS);
  if (texto === null) return { texto: null, objeto: {} };
  try { return { texto, objeto: JSON.parse(texto) }; } catch (e) { sair(T.settingsInvalido(ARQ_SETTINGS, e.message)); }
}

// grava no mesmo formato do arquivo (recuo, CRLF ou LF, quebra de linha final): remover devolve o
// arquivo igual. Dentro do JSON não há quebra de linha crua, então trocar \n por \r\n é seguro.
function formatar(objeto, textoOriginal) {
  const recuo = textoOriginal?.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  const final = textoOriginal === null || /\n$/.test(textoOriginal) ? '\n' : '';
  const texto = JSON.stringify(objeto, null, recuo) + final;
  return textoOriginal?.includes('\r\n') ? texto.replace(/\n/g, '\r\n') : texto;
}

// nenhum token aparece inteiro no terminal, nem o atual nem um antigo que ainda esteja no arquivo:
// um print da prévia não pode vazá-los
const mascarar = texto => texto.replace(/[0-9a-f]{64}/gi, t => `${t.slice(0, 4)}…`);

function mostrarDiff(antes, depois) {
  const ops = diffLinhas(antes ?? '', depois);
  for (const trecho of trechos(ops, 3)) {
    console.log(cor.cinza(`@@ linha ${trecho[0].b ?? trecho[0].a} @@`));
    for (const o of trecho) {
      const linha = `${o.tipo} ${mascarar(o.texto)}`;
      console.log(o.tipo === '+' ? cor.verde(linha) : o.tipo === '-' ? cor.vermelho(linha) : linha);
    }
  }
  const { mais, menos } = contar(ops);
  console.log(cor.cinza(`+${mais} −${menos}`));
}

function carimbo(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function confirmar() {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await rl.question(T.perguntar);
  rl.close();
  return /^s(im)?$/i.test(resposta.trim());
}

async function principal() {
  const [acao, ...resto] = process.argv.slice(2);
  const sim = resto.includes('--sim');
  const iConfirmar = resto.indexOf('--confirmar');
  const codigoDado = iConfirmar >= 0 ? resto[iConfirmar + 1] : null;
  if (!['instalar', 'remover', 'estado'].includes(acao) || (iConfirmar >= 0 && !codigoDado)) sair(T.uso, 2);

  const config = lerConfig();
  const { texto, objeto } = lerSettings();

  const anotacao = lerAnotacoes()[ARQ_SETTINGS] ?? null;
  let novo, criadas;
  try {
    if (acao === 'estado') sair(T.estado[estado(objeto, config)], 0);
    if (acao === 'instalar') {
      novo = instalar(objeto, config, anotacao);
      criadas = chavesCriadas(objeto, anotacao);
    } else {
      novo = remover(objeto, anotacao).settings;
    }
  } catch (e) {
    if (e instanceof FormatoInesperado) sair(T.formatoInesperado(e.caminho));
    throw e;
  }

  // nada muda no conteúdo: não grava, nem que a formatação fosse sair diferente
  if (JSON.stringify(novo) === JSON.stringify(objeto)) {
    if (!sim && acao === 'instalar' && !anotacao) anotar(criadas); // instalado antes de existir a anotação
    if (!sim && acao === 'remover' && anotacao) anotar(null);
    sair(acao === 'instalar' ? T.jaInstalado : T.nadaARemover, 0);
  }

  const textoNovo = formatar(novo, texto);
  const hashDaPrevia = sha256(texto ?? '');
  const codigo = sha256(`${hashDaPrevia}\n${textoNovo}`).slice(0, 12);

  console.log(T.previa(acao));
  console.log(ARQ_SETTINGS);
  mostrarDiff(texto, textoNovo);
  console.log(T.codigo(codigo));

  if (sim) sair(T.sim(acao, codigo), 0);
  if (codigoDado !== null) {
    if (codigoDado !== codigo) sair(T.mudou);
  } else if (!(await confirmar())) {
    sair(T.cancelado, 1);
  }

  for (const velho of limparTemporarios(ARQ_SETTINGS)) console.log(T.sobrou(velho));
  try {
    const { backup, sobrou } = gravar({ arquivo: ARQ_SETTINGS, textoAntes: texto, textoNovo, hashDaPrevia, carimbo: carimbo() });
    if (backup) console.log(T.backup(backup));
    if (sobrou) console.log(T.sobrou(sobrou));
  } catch (e) {
    if (e.sobrou) console.log(T.sobrou(e.sobrou));
    if (e instanceof ArquivoMudou) sair(T.mudou);
    throw e;
  }
  anotar(acao === 'instalar' ? criadas : null);
  console.log(acao === 'instalar' ? T.instalado : T.removido);
}

await principal();
