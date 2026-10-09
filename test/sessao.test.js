import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarSessoes, somaDosArquivos, textoSimples, estadoDoGato, PASSOS_DA_MARATONA } from '../src/sessao.js';

// eventos no formato comum, como o adaptador do Claude Code entrega
const base = { fonte: 'claude-code', sessao: 's1', projeto: 'vitrine' };
const ev = (tipo, extra = {}) => ({ ...base, tipo, resumo: tipo, ...extra });
const ferramenta = (id, resumo) => ev('ferramenta', { ferramenta: 'Bash', passoId: id, resumo });
const editou = (id, caminho, mais, menos) =>
  ev('concluiu', { ferramenta: 'Edit', passoId: id, edicao: { caminho, conta: { mais, menos } } });
const concluiu = id => ev('concluiu', { ferramenta: 'Bash', passoId: id });

const estados = s => s.passos.map(p => `${p.estado}:${p.resumo}`);

test('os passos contam desde o último prompt, e cada um fica ✓ com o resultado dele (D1, D2)', () => {
  const S = criarSessoes();
  S.receber(ev('pensando'));
  S.receber(ferramenta('a', 'Lendo frete.ts'));
  S.receber(ferramenta('b', 'Rodando npm test'));
  // chamadas em paralelo: começar o b não conclui o a
  assert.deepEqual(estados(S.obter(base)), ['atual:Lendo frete.ts', 'atual:Rodando npm test']);
  const s = S.receber(concluiu('a'));
  assert.equal(s.total, 2);
  assert.deepEqual(estados(s), ['ok:Lendo frete.ts', 'atual:Rodando npm test']);
  assert.equal(s.projeto, 'vitrine');

  S.receber(ev('pensando'));
  assert.equal(S.obter(base).total, 0, 'prompt novo zera');
  assert.deepEqual(S.obter(base).passos, []);
});

test('um id que não está entre os 10 guardados não mexe em outro passo (Codex, 07/10)', () => {
  const S = criarSessoes();
  for (let i = 0; i <= 10; i++) S.receber(ferramenta(`p${i}`, `passo ${i}`));
  const s = S.receber(editou('p0', 'C:\\vitrine\\a.ts', 7, 1));
  assert.equal(s.passos.at(-1).estado, 'atual', 'o p10 continua em curso');
  assert.equal(s.passos.at(-1).conta, null);
  assert.deepEqual(somaDosArquivos(s), { arquivos: 1, mais: 7, menos: 1 }, 'a soma do p0 conta, mesmo fora da tela');
});

test('um resultado atrasado do prompt anterior não mexe no prompt novo (Codex, 07/10)', () => {
  const S = criarSessoes();
  S.receber(ferramenta('velho', 'Rodando npm test'));
  S.receber(ev('pensando'));
  S.receber(ferramenta('novo', 'Lendo x'));
  S.receber(ev('erro', { ferramenta: 'Bash', passoId: 'velho' }));
  S.receber(editou('velho', 'C:\\vitrine\\a.ts', 3, 0));
  const s = S.obter(base);
  assert.deepEqual(estados(s), ['atual:Lendo x']);
  assert.deepEqual(somaDosArquivos(s), { arquivos: 0, mais: 0, menos: 0 });
});

test('algumFim vê o cartão do fim de uma sessão que não está na tela (o cochilo espera por ele; Codex, 09/10)', () => {
  const S = criarSessoes();
  S.receber(ev('fim'));
  S.receber(ev('pensando', { sessao: 's2' }));
  const b = S.obter({ ...base, sessao: 's2' }).chave;
  assert.equal(S.naTela(b), b, 'quem está na tela é a s2, escolhida por clique');
  assert.equal(S.algumFim(), true);
  S.dispensar(base);
  assert.equal(S.algumFim(), false);
});

test('o fim conclui todos os passos ainda em curso', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'A'));
  S.receber(ferramenta('b', 'B'));
  assert.deepEqual(estados(S.receber(ev('fim'))), ['ok:A', 'ok:B']);
});

test('a contagem segue além dos 10 passos guardados', () => {
  const S = criarSessoes();
  for (let i = 0; i < 14; i++) S.receber(ferramenta(`p${i}`, `passo ${i}`));
  const s = S.obter(base);
  assert.equal(s.total, 14);
  assert.equal(s.passos.length, 10);
  assert.equal(s.passos[0].resumo, 'passo 4');
});

test('o +N −M vai para o passo certo pelo id, e o passo fica ✓', () => {
  const S = criarSessoes();
  S.receber(ferramenta('e1', 'Editando frete.ts'));
  const s = S.receber(editou('e1', 'C:\\vitrine\\frete.ts', 3, 1));
  assert.deepEqual(s.passos[0].conta, { mais: 3, menos: 1 });
  assert.equal(s.passos[0].estado, 'ok');
});

test('sem id, o +N −M vai para o último passo', () => {
  const S = criarSessoes();
  S.receber(ferramenta(undefined, 'Editando a.ts'));
  const s = S.receber(editou(undefined, 'a.ts', 1, 0));
  assert.deepEqual(s.passos[0].conta, { mais: 1, menos: 0 });
});

test('a soma conta cada arquivo uma vez, com o +N −M de todas as edições dele', () => {
  const S = criarSessoes();
  S.receber(ferramenta('1', 'x')); S.receber(editou('1', 'C:\\vitrine\\frete.ts', 3, 1));
  S.receber(ferramenta('2', 'x')); S.receber(editou('2', 'c:/VITRINE/frete.ts', 2, 2));
  S.receber(ferramenta('3', 'x')); S.receber(editou('3', 'C:\\vitrine\\novo.md', 7, 0));
  // uma edição sem conta (formato desconhecido) ainda conta o arquivo
  S.receber(ferramenta('4', 'x')); S.receber(ev('concluiu', { passoId: '4', edicao: { caminho: 'C:\\vitrine\\outro.ts', conta: null } }));
  assert.deepEqual(somaDosArquivos(S.obter(base)), { arquivos: 3, mais: 12, menos: 3 });
});

test('ferramenta que falhou fica ✗; o passo seguinte não a desmarca', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'Rodando npm test'));
  S.receber(ev('erro', { ferramenta: 'Bash', passoId: 'a' }));
  const s = S.receber(ferramenta('b', 'Editando x'));
  assert.deepEqual(estados(s), ['erro:Rodando npm test', 'atual:Editando x']);
  assert.equal(s.fim, null, 'erro de ferramenta não é o fim da sessão');
});

test('pedido negado pela ilha: ✗ no passo dele, pelo id', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'Rodando git push'));
  S.receber(ferramenta('b', 'Lendo x'));
  S.negado({ ...base, passoId: 'a' });
  assert.deepEqual(estados(S.obter(base)), ['negado:Rodando git push', 'atual:Lendo x']);
  // sem id (pedido que não achou a ferramenta): o último
  S.negado(base);
  assert.equal(S.obter(base).passos[1].estado, 'negado');
});

test('um pedido não vira passo', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'Rodando git push'));
  S.receber(ev('permissao', { ferramenta: 'Bash' }));
  assert.equal(S.obter(base).total, 1);
  assert.equal(S.receber(ev('permissao', { sessao: 'outra' })), null, 'nem abre sessão');
  assert.equal(S.quantas, 1);
});

test('o fim conclui o passo e guarda a mensagem sem Markdown; o próximo evento o tira (D4, D4b)', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'Rodando npm test'));
  const s = S.receber(ev('fim', { mensagem: 'Corrigi o **cálculo do frete**, `48` testes passando.' }));
  assert.deepEqual(s.fim, { mensagem: 'Corrigi o cálculo do frete, 48 testes passando.', falhou: false });
  assert.equal(s.passos[0].estado, 'ok');
  assert.equal(s.total, 1, 'o fim não zera a contagem: o cartão mostra os passos');

  S.receber(ferramenta('b', 'Rodando git status'));
  assert.equal(S.obter(base).fim, null);
});

test('fim sem mensagem, ou só com código, fica com mensagem null', () => {
  const S = criarSessoes();
  assert.equal(S.receber(ev('fim', { mensagem: null })).fim.mensagem, null);
  assert.equal(S.receber(ev('fim', { mensagem: '```\nnpm test\n```' })).fim.mensagem, null);
});

test('a sessão que parou com erro tem um fim que falhou', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'x'));
  const s = S.receber(ev('erro'));
  assert.deepEqual(s.fim, { mensagem: null, falhou: true, limite: false });
});

test('o OK dispensa o cartão do fim', () => {
  const S = criarSessoes();
  S.receber(ev('fim', { mensagem: 'Pronto.' }));
  S.dispensar(base);
  assert.equal(S.obter(base).fim, null);
  assert.doesNotThrow(() => S.dispensar({ fonte: 'x', sessao: 'nenhuma' }));
});

test('sessões separadas por id e por fonte; o SessionEnd tira a sessão', () => {
  const S = criarSessoes();
  S.receber(ferramenta('a', 'x'));
  S.receber({ ...ferramenta('a', 'y'), sessao: 's2' });
  S.receber({ ...ferramenta('a', 'z'), fonte: 'codex' });
  assert.equal(S.quantas, 3);
  assert.equal(S.receber(ev('saida')), null);
  assert.equal(S.quantas, 2);
  assert.equal(S.obter(base), null);
});

test('no máximo 20 sessões: sai a que mudou há mais tempo', () => {
  const S = criarSessoes();
  for (let i = 0; i < 20; i++) S.receber({ ...ev('pensando'), sessao: `s${i}` });
  S.receber({ ...ev('pensando'), sessao: 's0' }); // a s0 mexeu agora: a mais velha passa a ser a s1
  S.receber({ ...ev('pensando'), sessao: 'nova' });
  assert.equal(S.quantas, 20);
  assert.ok(S.obter({ ...base, sessao: 's0' }));
  assert.equal(S.obter({ ...base, sessao: 's1' }), null);
});

// F2 — várias sessões
const de = sessao => ({ ...base, sessao });

test('F2: a ilha mostra a sessão que mudou por último', () => {
  const S = criarSessoes();
  S.receber({ ...ferramenta('a', 'A'), sessao: 's1' });
  S.receber({ ...ferramenta('b', 'B'), sessao: 's2' });
  assert.deepEqual(S.vivas().map(k => k.split('\u0000')[1]), ['s2', 's1']);
  assert.equal(S.naTela(), S.obter(de('s2')).chave);
  S.receber({ ...ferramenta('c', 'C'), sessao: 's1' });
  assert.equal(S.naTela(), S.obter(de('s1')).chave);
});

test('F2: o cartão do fim esperando o OK ganha da sessão que andou depois', () => {
  const S = criarSessoes();
  S.receber({ ...ev('fim', { mensagem: 'Pronto.' }), sessao: 's1' });
  S.receber({ ...ferramenta('b', 'B'), sessao: 's2' });
  assert.equal(S.naTela(), S.obter(de('s1')).chave);
  // o OK: a s1 fica quieta, e a s2 aparece
  S.dispensar(de('s1'));
  assert.equal(S.naTela(), S.obter(de('s2')).chave);
});

test('F2: depois do OK, sem outra sessão, a ilha fica quieta; o próximo evento a acorda', () => {
  const S = criarSessoes();
  S.receber(ev('fim'));
  S.dispensar(base);
  assert.equal(S.naTela(), null);
  assert.equal(S.vivas().length, 1, 'quieta, mas ainda conta como sessão aberta');
  S.receber(ev('pensando'));
  assert.equal(S.naTela(), S.obter(base).chave);
});

test('F2: a escolhida por clique vale enquanto está viva; "seguinte" dá a volta', () => {
  const S = criarSessoes();
  for (const s of ['s1', 's2', 's3']) S.receber({ ...ferramenta(s, s), sessao: s });
  const [k3, k2, k1] = S.vivas();
  assert.equal(S.seguinte(k3), k2);
  assert.equal(S.seguinte(k1), k3, 'dá a volta');
  assert.equal(S.naTela(k1), k1, 'a escolhida ganha da que mudou por último');
  S.receber({ ...ev('saida'), sessao: 's1' });
  assert.equal(S.naTela(k1), k3, 'a escolhida que saiu não vale mais');
  assert.equal(S.seguinte('nenhuma'), k3);
});

test('F2: sem evento por 1 hora, a sessão sai da conta; um evento a traz de volta', () => {
  let t = 0;
  const S = criarSessoes({ agora: () => t });
  S.receber({ ...ferramenta('a', 'A'), sessao: 's1' });
  t = 30 * 60 * 1000;
  S.receber({ ...ferramenta('b', 'B'), sessao: 's2' });
  t = 61 * 60 * 1000;
  assert.equal(S.vivas().length, 1, 'a s1 passou de 1 hora');
  assert.equal(S.naTela(), S.obter(de('s2')).chave);
  S.receber({ ...ferramenta('c', 'C'), sessao: 's1' });
  assert.equal(S.vivas().length, 2);
  assert.equal(S.seguinte(null), S.vivas()[0]);
});

test('F2: um cartão do fim pendente segura a tela e a conta, passe o tempo que passar (Codex, 07/10)', () => {
  let t = 0;
  const S = criarSessoes({ agora: () => t });
  S.receber({ ...ev('fim', { mensagem: 'Pronto.' }), sessao: 's1' });
  t = 3 * 60 * 60 * 1000; // 3 horas depois, outra sessão anda
  S.receber({ ...ferramenta('b', 'B'), sessao: 's2' });
  assert.equal(S.naTela(), S.obter(de('s1')).chave);
  assert.equal(S.vivas().length, 2);
  S.dispensar(de('s1'));
  assert.equal(S.vivas().length, 1, 'depois do OK, a 1 hora volta a valer');
});

test('F2: proximaExpiracao diz quando a conta muda sozinha', () => {
  let t = 0;
  const S = criarSessoes({ agora: () => t });
  assert.equal(S.proximaExpiracao(), null);
  S.receber({ ...ferramenta('a', 'A'), sessao: 's1' });
  t = 10 * 60 * 1000;
  S.receber({ ...ferramenta('b', 'B'), sessao: 's2' });
  assert.equal(S.proximaExpiracao(), 50 * 60 * 1000, 'a s1 vence primeiro');
  S.receber({ ...ev('fim'), sessao: 's1' });
  assert.equal(S.proximaExpiracao(), 60 * 60 * 1000, 'com o fim pendente, a s1 não vence');
});

test('cada passo guarda a hora (para a linha do tempo)', () => {
  const S = criarSessoes({ agora: () => 1234 });
  assert.equal(S.receber(ferramenta('a', 'x')).passos[0].hora, 1234);
});

test('textoSimples tira a marcação do Markdown', () => {
  const casos = [
    ['## Pronto\n\nCorrigi o **frete** em `frete.ts`.', 'Pronto. Corrigi o frete em frete.ts.'],
    ['# Feito! ##\nok', 'Feito! ok'],
    ['Mudei:\n- um\n- **dois**\n1. três;', 'Mudei: um. dois. três;'],
    ['Veja [a doc](https://x.dev) e *isto*.', 'Veja a doc e isto.'],
    ['Antes\n```js\nconst segredo = 1;\n```\nDepois', 'Antes Depois'],
    ['> citado\n\n---\n\n~~velho~~ novo', 'citado velho novo'],
    ['| a | b |\n|---|:-:|\n| 1 | 2 |', 'a · b · 1 · 2'],
    ['o last_assistant_message e snake_case ficam', 'o last_assistant_message e snake_case ficam'],
    ['2 * 3 * 4 continua', '2 * 3 * 4 continua'],
    ['', ''],
  ];
  for (const [md, esperado] of casos) assert.equal(textoSimples(md), esperado, md);
  assert.equal(textoSimples(null), '');
});

test('textoSimples é linear: entradas que faziam as regex voltarem atrás passam rápido (Codex, 07/10)', () => {
  const n = 64_000;
  const casos = {
    colchetes: '['.repeat(n),
    espacosEx: ' '.repeat(n) + 'x',
    tituloComEspacos: '#' + ' '.repeat(n) + 'x',
    linhasDeEspaco: (' '.repeat(50) + '\n').repeat(n / 50) + 'x',
    asteriscos: '**'.repeat(n / 2),
    italicoSemFim: 'a *' + 'b'.repeat(n),
    riscado: '~~'.repeat(n / 2),
    pipes: '| '.repeat(n / 2),
    tabela: ('|' + ' -'.repeat(40) + ' x\n').repeat(n / 80),
    crases: '`'.repeat(n),
  };
  for (const [nome, md] of Object.entries(casos)) {
    const t0 = performance.now();
    textoSimples(md);
    const ms = performance.now() - t0;
    assert.ok(ms < 100, `${nome}: ${ms.toFixed(1)} ms`);
  }
});

test('textoSimples corta mensagem longa com reticências', () => {
  const t = textoSimples('palavra '.repeat(100));
  assert.ok(t.length <= 280);
  assert.ok(t.endsWith('…'));
});

test('o estado do gato (F3): procurando, maratona, a reação pequena e o fim', () => {
  const S = criarSessoes();
  const s = S.receber(ev('pensando'));
  assert.equal(estadoDoGato(ev('pensando'), s), 'pensando');
  S.receber(ferramenta('a', 'Rodando npm test'));
  assert.equal(estadoDoGato(ferramenta('a'), s), 'trabalhando');
  assert.equal(estadoDoGato(ev('ferramenta', { ferramenta: 'Grep', procura: true }), s), 'procurando');
  // D9: uma ferramenta que falhou é a reação pequena; a sessão que falhou é a grande
  assert.equal(estadoDoGato(ev('erro', { ferramenta: 'Grep', passoId: 'a' }), s), 'ops');
  assert.equal(estadoDoGato(ev('pergunta'), s), 'pergunta');
  assert.equal(estadoDoGato(ev('permissao'), s), 'esperando');

  // a partir de 10 passos sem Stop, a caneca, procurando ou não; pedido e pergunta não
  for (let i = 1; i < PASSOS_DA_MARATONA; i++) S.receber(ferramenta(`m${i}`, 'x'));
  assert.equal(s.total, PASSOS_DA_MARATONA);
  assert.equal(estadoDoGato(ferramenta('m9'), s), 'maratona');
  assert.equal(estadoDoGato(ev('ferramenta', { procura: true }), s), 'maratona');
  assert.equal(estadoDoGato(ev('permissao'), s), 'esperando');
  assert.equal(estadoDoGato(ev('pergunta'), s), 'pergunta');
  // o prompt novo zera a conta
  S.receber(ev('pensando'));
  assert.equal(estadoDoGato(ferramenta('n'), S.receber(ferramenta('n', 'y'))), 'trabalhando');

  // o fim manda: feliz, socorro (D13) ou cansado
  assert.equal(estadoDoGato(ev('fim'), S.receber(ev('fim', { mensagem: 'ok' }))), 'feliz');
  assert.equal(estadoDoGato(ev('erro'), S.receber(ev('erro'))), 'socorro');
  const limite = S.receber(ev('erro', { motivo: 'limite' }));
  assert.equal(limite.fim.limite, true);
  assert.equal(estadoDoGato(ev('erro'), limite), 'cansado');
  // sem sessão (o sessao.js da ilha não carregou), pelo tipo
  assert.equal(estadoDoGato(ev('ferramenta', { procura: true })), 'procurando');
  assert.equal(estadoDoGato({ tipo: 'desconhecido' }), 'parado');
});

test('as caras extras da D13: testes, feito, socorro e a sessão nova (09/10)', () => {
  const S = criarSessoes();
  assert.equal(S.receber(ev('pensando')).primeiro, true, 'a ilha ainda não conhecia esta sessão');
  assert.equal(S.receber(ferramenta('t', 'Rodando npm test')).primeiro, false);

  // o teste que terminou bem é o 👌, mesmo na maratona; outro Bash, não
  const teste = ev('concluiu', { ferramenta: 'Bash', passoId: 't', teste: true });
  assert.equal(estadoDoGato(teste, S.receber(teste)), 'testes');
  assert.equal(estadoDoGato(concluiu('t'), S.obter(base)), 'trabalhando');
  for (let i = 0; i < PASSOS_DA_MARATONA; i++) S.receber(ferramenta(`m${i}`, 'x'));
  assert.equal(estadoDoGato(teste, S.obter(base)), 'testes');

  // o fim de quem editou arquivos é o 👍; o de quem só leu ou respondeu, o feliz
  S.receber(ferramenta('e', 'Editando a.ts'));
  S.receber(editou('e', 'C:\\vitrine\\a.ts', 2, 1));
  assert.equal(estadoDoGato(ev('fim'), S.receber(ev('fim'))), 'feito');
  S.receber(ev('pensando'));
  assert.equal(estadoDoGato(ev('fim'), S.receber(ev('fim'))), 'feliz');

  // conhecida continua conhecida: depois de sair pelo teto de sessões ou do SessionEnd (Codex, 09/10)
  for (let i = 0; i < 25; i++) S.receber(ev('pensando', { sessao: `outra${i}` }));
  assert.equal(S.receber(ev('pensando')).primeiro, false, 'a s1 saiu pelo teto e voltou');
  S.receber(ev('saida'));
  assert.equal(S.receber(ev('pensando')).primeiro, false, 'a s1 foi retomada depois do SessionEnd');

  // sem a sessão (o sessao.js da ilha não carregou), a sessão que parou com erro também é o 😱
  assert.equal(estadoDoGato(ev('erro')), 'socorro');
  assert.equal(estadoDoGato(ev('erro', { ferramenta: 'Bash' })), 'ops');
});
