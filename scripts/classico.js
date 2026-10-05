// Carrega no Node os scripts clássicos da interface (textos, adaptadores), que no app são
// <script> comuns com variáveis globais. Usado pelo instalador dos hooks e pelos testes, sem mudar
// nada no app.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);

/**
 * Roda os arquivos (caminhos a partir da raiz do projeto) num mesmo contexto, na ordem, e devolve
 * as globais pedidas. `const` de nível de topo não vira propriedade do contexto, por isso cada nome
 * é lido com uma avaliação no próprio contexto.
 */
export function carregar(arquivos, nomes) {
  // as globais do navegador que os scripts usam (o contexto do vm nasce sem elas)
  const contexto = vm.createContext({ console, URL });
  for (const arquivo of arquivos) {
    const caminho = fileURLToPath(new URL(arquivo, raiz));
    vm.runInContext(readFileSync(caminho, 'utf8'), contexto, { filename: caminho });
  }
  return Object.fromEntries(nomes.map(nome => [nome, vm.runInContext(nome, contexto)]));
}
