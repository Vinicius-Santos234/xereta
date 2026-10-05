// Gravar o settings.json com segurança (D14): backup com data, troca atômica, recusa se o arquivo
// mudou desde a prévia e nenhum temporário largado (ele contém o token).
//
// Limite conhecido: entre a última conferência e a troca sobra uma janela de microssegundos. Se o
// Claude Code gravar o arquivo exatamente aí, a gravação dele se perde. Não há como fechar isso sem
// uma trava que o Claude Code também respeite, e ele mesmo grava o arquivo sem trava.
import { createHash } from 'node:crypto';
import { copyFileSync, constants, existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const sha256 = texto => createHash('sha256').update(texto).digest('hex');
export const lerOuNull = arquivo => (existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : null);

export class ArquivoMudou extends Error {
  constructor(sobrou) { super('arquivo-mudou'); this.sobrou = sobrou; }
}

const esperar = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// apaga com algumas tentativas (antivírus e indexador seguram arquivos novos por um instante);
// devolve o caminho se ele continuar lá
function apagar(caminho) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      rmSync(caminho, { force: true });
      if (!existsSync(caminho)) return null;
    } catch { /* tenta de novo */ }
    esperar(100);
  }
  return existsSync(caminho) ? caminho : null;
}

const ehTemporarioNosso = (arquivo, nome) =>
  nome.startsWith(`${basename(arquivo)}.xereta-`) && /\.xereta-\d+\.tmp$/.test(nome);

/** Apaga temporários que uma gravação anterior não conseguiu apagar. Devolve os que sobraram. */
export function limparTemporarios(arquivo) {
  const pasta = dirname(arquivo);
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter(nome => ehTemporarioNosso(arquivo, nome))
    .map(nome => apagar(join(pasta, nome))).filter(Boolean);
}

// backup com data; duas gravações no mesmo segundo ganham -2, -3… em vez de falhar
function fazerBackup(arquivo, carimbo) {
  const base = `${arquivo}.bak-${carimbo}`;
  for (let n = 1; ; n++) {
    const backup = n === 1 ? base : `${base}-${n}`;
    try {
      copyFileSync(arquivo, backup, constants.COPYFILE_EXCL);
      return backup;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

/**
 * Troca o conteúdo de `arquivo` por `textoNovo`, se ele ainda for o da prévia (`hashDaPrevia`).
 * Devolve { backup, sobrou }. Lança ArquivoMudou se o arquivo mudou; qualquer outro erro sai com
 * `.sobrou` (o temporário que não deu para apagar, ou null).
 * `antesDaTroca` só existe para os testes simularem outro processo gravando no meio.
 */
export function gravar({ arquivo, textoAntes, textoNovo, hashDaPrevia, carimbo, antesDaTroca = () => {} }) {
  const aindaIgual = () => sha256(lerOuNull(arquivo) ?? '') === hashDaPrevia;
  if (!aindaIgual()) throw new ArquivoMudou(null);
  const backup = textoAntes !== null ? fazerBackup(arquivo, carimbo) : null;

  // grava ao lado e troca de uma vez: uma interrupção no meio não deixa o arquivo pela metade
  const temporario = join(dirname(arquivo), `${basename(arquivo)}.xereta-${process.pid}.tmp`);
  let mudou = false;
  try {
    writeFileSync(temporario, textoNovo, { encoding: 'utf8', flag: 'wx' });
    antesDaTroca();
    mudou = !aindaIgual();
    if (!mudou) renameSync(temporario, arquivo);
  } catch (e) {
    e.sobrou = apagar(temporario);
    throw e;
  }
  const sobrou = apagar(temporario);
  if (mudou) throw new ArquivoMudou(sobrou);
  return { backup, sobrou };
}
