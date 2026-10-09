# Xereta

Uma ilha no topo da tela do Windows, com um gato frajola, que mostra ao vivo o que o Claude Code
está fazendo e deixa responder pedidos de permissão sem voltar ao terminal. Tauri 2, JavaScript
puro na interface e um núcleo fino em Rust. Ver `README.md` para a visão geral e `specs/` para o
que se constrói e por quê.

Este repositório costuma ser editado por uma sessão do Claude Code **que está ligada à própria
ilha**: cada ferramenta que você usa aqui aparece no gato. É o primeiro teste de tudo.

## Idioma

Código, comentários, nomes de variáveis, mensagens de commit e textos de interface **em português
brasileiro**. Nomes que vêm do Claude Code não se traduzem (`PreToolUse`, `tool_use_id`,
`structuredPatch`, hook).

**Todo texto que aparece na tela mora em `src/textos/pt-BR.js`** (D16 da 001). Nada de frase
solta em `ilha.js`: outro idioma é um arquivo irmão com as mesmas chaves.

## Glossário

| Termo | Significado |
|---|---|
| Ilha | A janela inteira: transparente, sempre 420×110, recortada na forma do que está visível |
| Pílula | A ilha recolhida, 140×34, com o gato e o texto curto |
| Recorte | A região da janela (`SetWindowRgn`, no Rust): fora dela, o clique cai no app de trás |
| Ponte | O servidor HTTP em Rust (`ponte.rs`) e o lado da página (`ponte.js`) |
| Fonte | Quem manda eventos. Hoje só `claude-code`; Codex, Gemini e scripts na spec 006 |
| Adaptador | Traduz o JSON de uma fonte para o formato comum (`src/adaptadores/`) |
| Evento · pedido | As duas rotas: o evento responde na hora; o pedido fica aberto até a decisão ou o prazo |
| Sessão · passo | Uma conversa do Claude Code (`session_id`) · uma ferramenta desde o último prompt |
| Cartão · cartão do fim | A ilha aberta contando a sessão · o resumo do `Stop`, que espera o OK |
| Assinatura | O nome e a entrada de uma ferramenta (JSON com as chaves em ordem), que liga o pedido ao `tool_use_id` |
| D7, V3, E4, F2 | Decisão, verificação, etapa (001) e fase (002 em diante), numeradas dentro de cada spec |

## Regras que não podem ser quebradas

1. **Nenhum caminho devolve `allow` sem clique.** Erro, prazo, conexão fechada, decisão que não
   se reconhece: a resposta é vazia, e o pedido segue no terminal. `resposta()` do adaptador só
   aceita `'permitir'` e `'negar'`. Caminho novo de pedido ganha teste disso.
2. **Status nunca atrasa o Claude Code.** A rota `/evento` responde `200` antes de a página olhar o
   corpo, e o hook tem `timeout` de 2 s. O que a página faz por evento é linear: regex sem teto
   numa mensagem grande já travou a ilha uma vez (`textoSimples`).
3. **O que as ferramentas recebem não vai para disco nem para o console.** `tool_input`, a
   mensagem final, o prompt e os nomes de arquivo ficam só na memória. `console.error` leva o nome
   do erro, nunca o corpo.
4. **O Rust é fino.** HTTP, token, tamanho, janela e recorte. Regra de negócio, e tudo o que sabe
   o que é o Claude Code, fica em JS, no adaptador.
5. **A janela não pega foco.** Nada de `setFocus`; quem digita em outro app continua digitando
   com o mouse em cima da ilha (D13 da 001).
6. **Configuração de outro programa só se grava por ação explícita** (D14): prévia, backup com
   data, gravação atômica e recusa se o arquivo mudou desde a prévia. O app nunca grava o
   `settings.json` sozinho.
7. **Um pedido só sai da ilha sem decisão pelo resultado da própria ferramenta** (o
   `PostToolUse`/`PostToolUseFailure` com o mesmo `tool_use_id`) **ou pela sessão mudando**
   (prompt novo, `Stop`, `StopFailure`, `SessionEnd`). "Chegou outro evento da sessão" não é
   sinal: com chamadas em paralelo, a ferramenta irmã chega antes (D12 da 002).
8. **Um clique vale para o que estava na tela quando o botão foi apertado**, e não quando foi
   solto. Nos pedidos, também só depois de 600 ms na tela. Vale para os botões do pedido e para o
   OK do cartão do fim.
9. **Texto na tela entra por `textContent`**, nunca por `innerHTML`: o que aparece vem de comandos
   e arquivos de quem usa.
10. **Plano, não API** (D17). As sessões de teste com `claude -p` rodam com
    `env -u ANTHROPIC_API_KEY`, porque a chave no ambiente passa na frente do plano. O app em si não
    fala com nenhuma API.
11. **Memória parada abaixo de 100 MB**, como média de 5 minutos em release. A pílula desenha a
    15 qps (a 30, o WebView2 fazia a memória subir em serra) e a ilha aberta até 60. Mudança que
    mexe em desenho ou no tamanho da janela mede de novo, **alternando com o commit anterior** (de
    uma execução para outra a serra vem e vai). O desenho não cria gradiente nem `Path2D` por
    quadro (usa `guardar`/`gradiente`; há teste): cada um segura memória nativa que só volta numa
    coleta completa, e por isso a ilha pede uma a cada 20 s (`--expose-gc`).

## O formato dos hooks se confere, não se supõe

O resumo da documentação já inventou nome de campo. Antes de depender de um campo, grave o corpo
de verdade: um `--settings` só com um hook `command` que salva o stdin, e uma sessão `claude -p`
curta (pelo plano, regra 10). O que foi visto fica anotado na spec, com a versão do Claude Code.
Para reconstruir o que aconteceu numa sessão, o transcript em
`~/.claude/projects/<pasta>/<sessão>.jsonl` registra cada decisão de hook
(`hook_permission_decision`, com o `toolUseID`).

## Windows e o shell daqui

- **Barra invertida:** `\\` vira `\` no caminho até o shell. Código ou JSON com barras se escreve
  pelas ferramentas de arquivo, não por heredoc com `python` ou `sed`.
- **PowerShell não diferencia maiúsculas:** um parâmetro `$Saida` e uma variável `$saida` são a
  mesma coisa.
- **`curl` engana na porta fechada:** leva 2 s para desistir no Windows, e o Claude Code (Node)
  recebe `ECONNREFUSED` na hora. Meça com Node.
- **Testar hover por script:** um cursor que **pula** para fora da ilha (`SetCursorPos`) não gera
  `mouseleave` no WebView. Ande com ele em passos, como a mão faz.
- **Ver o JS novo:** reinicie o `npm run tauri dev`, em vez de confiar que a página recarregou.

## Testes

- `npm test`: `node --test`, sem dependência nova. A interface usa scripts clássicos (globais);
  `scripts/classico.js` os carrega com `node:vm` e aceita globais de mentira (o
  `window.__TAURI__` da ponte). O que vem do `vm` tem outro protótipo: copie (`[...x]`, `{ ...x }`)
  antes do `deepEqual`.
- `cargo test` dentro de `src-tauri`.
- **Teste de correção tem controle:** rode-o também contra o código anterior
  (`git show HEAD:arquivo`). Ele precisa falhar lá, senão não prova nada.
- O que só se vê na tela (recorte, hover, animação) se confere no app rodando, com uma sessão
  simulada pela ponte e foto da tela. As fotos recortam a ilha; a tela de quem testa não vai
  para o repositório.

## Documentação

| O quê | Onde | Regra |
|---|---|---|
| O que construir e por quê | `specs/NNN-assunto.md` | Decisões numeradas, etapas com critérios de aceite, verificações pendentes. Uma spec começa em rascunho e só vale depois de aprovada pelo Vinicius |
| O que aconteceu numa etapa | Dentro da própria etapa, num bloco `> **DD/MM — …**` | O que foi medido, o que a revisão achou e o que mudou. Decisão nova vira emenda numerada, com a data |
| Ideias, estudo, mascote | `ideias/` | Documentos vivos |
| Como o sistema funciona hoje | `README.md` | Sem a história de como chegou lá |

Comentário no código diz o porquê e a armadilha, em poucas linhas. A história vai na mensagem do
commit.

## Fluxo de uma etapa

Spec aprovada → código com testes → conferido no app → **teste na mão do Vinicius** → revisão do
Codex, só de leitura → correções, com controle → commit. O commit tem título no formato
`002 F2 concluída: …`, corpo em tópicos e a linha `Co-Authored-By`.

## Antes de dar por pronto

```powershell
npm test
cd src-tauri; cargo test
```
