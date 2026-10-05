# Spec 002 — A ilha conta a sessão

**Status:** rascunho (05/10), aguardando a sua aprovação. Começa depois da 001 (E4).
**Origem:** `ideias/coucou-instagram.md` (P3, P4, P5, P6, P7, P10 e P11) e `ideias/mascote.md`.
**Depende de:** E3 da 001, que é quando os campos reais dos hooks são vistos pela primeira vez.

---

## 1. Objetivo

Hoje a ilha diz **o que** o Claude está fazendo agora ("Rodando npm test"). A 002 faz a ilha
contar **a sessão**: o que já foi feito, quanto mudou e como terminou. E faz o gato reagir a
cada momento de um jeito que se lê até na pílula de 34 px.

**Uma frase de sucesso:** volto do café, olho a pílula e vejo pelo gato que a sessão terminou.
Passo o mouse e leio: *"korus · 7 passos · billing.ts +3 −1 · Corrigi o arredondamento, 48
testes passando."* Não preciso abrir o terminal para saber o que aconteceu.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Diff completo e nível de risco | São da 003, que trata do pedido de permissão |
| Botão "Abrir terminal" | No Windows não há como saber qual janela é a da sessão: o hook não traz PID nem janela. Fica em aberto até achar um caminho confiável |
| Guarda-roupa, acessórios, mascote solto na área de trabalho | Charme, não núcleo. Se um dia entrarem, desenhados por nós |
| Sons | Vêm com as configurações (005) |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | Passos | **Contar os `PreToolUse` desde o último `UserPromptSubmit`** e mostrar "7 passos", sem total | O Coucou mostra "3/4", mas o hook não diz quantos passos virão. Um total inventado mente |
| D2 | Passo concluído | Um passo conta como feito quando chega o próximo `PreToolUse` ou o `Stop`; o `PostToolUseFailure` marca ✗ | Assim não é preciso instalar o `PostToolUse`, que dispara a cada ferramenta e só confirmaria o que já se sabe |
| D3 | `+N −M` | Calculado **em JS** a partir do `tool_input` (`old_string`/`new_string` do Edit, `edits[]` do MultiEdit, linhas do `content` do Write), num módulo `src/diff.js` | É o mesmo módulo que a 003 usa para o diff completo. Aqui só se contam as linhas |
| D4 | Fim da sessão | Mostrar o começo de `last_assistant_message` do `Stop`: até 2 linhas, sem a marcação de Markdown | Os docs dizem que o `Stop` traz esse campo. Precisa ser conferido na E3 (V1) |
| D4b | O cartão do fim | Fica aberto **até um OK**, ou até o próximo evento daquela sessão. Sem "Abrir terminal" (ver §2) | É o P5: quem estava longe da tela volta e ainda encontra o resultado. Sumir sozinho depois de 1 s jogaria fora justamente o que essa pessoa queria ler |
| D5 | Privacidade | A mensagem final e os nomes de arquivo **só vivem na memória** da página, como na D9 da 001 | A mensagem final pode citar segredo, igual ao `tool_input` |
| D6 | Várias sessões | A ilha mostra **a sessão que mudou por último**, com "2 sessões" no canto; um clique troca | Você roda mais de uma sessão. Hoje a ilha mistura todas |
| D7 | Selo de estado | Um **sinal na orelha clara do gato**, onde hoje fica o miolo rosa: `…` pensando, `⋯` trabalhando, `!` esperando, `?` pergunta, ✓ pronto, ✗ erro | Dá para ler o estado na pílula, onde os gestos não cabem. Fica na orelha, e não num círculo no canto da cabeça como no Mochi (D12 da 001) |
| D8 | Reação de entrada | Cada troca de estado ganha uma reação **curta, de menos de 1 s**, com as molas que já existem: pronto pula, erro sacode, esperando estica as orelhas | Segue o "Curto" de `ideias/mascote.md`. Com "reduzir movimento" ligado, não há reação |
| D10 | Cursor perto da pílula | Ler a posição do cursor (`cursorPosition()` da API de janela do Tauri) a 15 qps, só com a ilha recolhida, só para a patadinha e o olhar | O recorte faz a janela não existir fora da ilha, e por isso ela não recebe `pointermove` de fora. Ler a posição não captura nada nem rouba clique |
| D11 | Linha do tempo | Clicar no cartão da sessão abre a **linha do tempo**: os últimos 10 passos com a hora (`14:30 ✓ npm test · 14:31 ✎ auth.ts · 14:32 ✓ Prontinho!`), na ilha grande da 003 (D1). Só na memória, como a D5 | É o "o que ele fez enquanto eu estava longe". Duas linhas no cartão (D1/D2) não contam uma sessão inteira |
| D9 | Escala de exagero | Reação grande só para o que é grande: a sessão falhar (`StopFailure`) ou um pedido de risco alto (003). Um `grep` sem resultado ganha a reação pequena | Como em `ideias/mascote.md`: se o olho saltar a cada `grep`, a piada morre no primeiro dia |

---

## 4. O que a ilha mostra

**Pílula (recolhida):** o gato com o selo na orelha e o texto curto do estado ("Bora!",
"Posso?", "Prontinho!"). Com mais de uma sessão aberta, aparece um "2" pequeno.

**Ilha aberta, trabalhando:**
```
 [gato]  korus · Claude Code                         7 passos · 2 sessões
         ✓ Editando billing.ts   +3 −1
         › Rodando npm test
```

**Ilha aberta, no fim:**
```
 [gato feliz]  korus terminou · 9 passos · 2 arquivos (+12 −4)
               Corrigi o arredondamento do IVA, 48 testes passando…   [ OK ]
```

**Novos estados do gato** (somam-se aos 6 estados e às 8 caras):

| Estado | Quando | Como |
|---|---|---|
| Procurando | `Grep`, `Glob`, `WebSearch`, `WebFetch` | Orelhas em radar e olhos varrendo de um lado para o outro |
| Dormindo (cochilo) | N minutos sem evento nenhum (padrão: 10; ajustável de 10 a 15) | A cabeça deita **apoiada nas luvinhas**, olhos fechados, respiração lenta na mola, um "z" saindo da orelha. No próximo `UserPromptSubmit` ele **acorda num susto** (orelhas em pé, olhos arregalados, ~0,4 s) e só então entra em "pensando" |
| Maratona | 10 passos seguidos ou mais sem `Stop` | As luvinhas apoiam na borda da ilha segurando uma **caneca de café fumegante**. Sai no `Stop`, e não aparece quando ele está esperando você |
| Pergunta | Uma pergunta do Claude (004) | Uma orelha inclinada, olhos grandes, selo `?` |
| Tonto | Cutucado (abaixo) | Olhos em espiral, orelhas girando |
| Cansado | `StopFailure` com `error_type: "rate_limit"`: a sessão parou porque o limite de uso acabou | Orelhas caídas, olhos meio fechados, uma gota de suor. A ilha diz "Bati no limite de uso" | 

O "Cansado" aqui reage **quando o limite já acabou**, que é o que o hook informa. Mostrar o uso
**antes** de acabar (o gato ficando cansado perto do limite) precisa do dado da status line e está
na F5 da 005.

**Saudação ao abrir:** o gato espia pela borda e acena com a cara "oi" que já existe. Uma vez
por abertura do app.

**Carinho e cutucão (uma escada):** três cliques no gato em 2 s são **carinho**: ele fecha os
olhos, relaxa as orelhas e **ronrona** (uma vibração sutil por ~1 s, e o som da 005 se estiver
ligado). Se os cliques continuarem até seis em 2 s, vira **cutucão**: ele fica tonto por 3 s e
diz *"Ei! Para com isso… volto em 3 segundos."* Clicar não rouba o foco (D13 da 001 continua
valendo).

**Patadinha no cursor:** com a ilha recolhida, se o ponteiro passa **rápido** perto da pílula (a
até ~60 px), o gato dá uma patadinha com a luvinha, como quem tenta caçar. No máximo uma a cada
30 s, e nenhuma com "reduzir movimento". Hoje a ilha só vê o mouse dentro do recorte; para ver o
cursor passando **perto**, a pílula lê a posição do cursor no mesmo ritmo do desenho (15 qps), só
enquanto está recolhida (D10).

---

## 5. Etapas e critérios de aceite

### F1 — O cartão da sessão
- A ilha aberta mostra o projeto, a fonte, a contagem de passos e os dois últimos passos (✓ ou ✗
  no anterior, `›` no atual).
- Edit, MultiEdit e Write mostram `+N −M` certo. Conferir contra o `git diff --stat` em 10
  edições reais, incluindo um `replace_all` e um arquivo novo.
- No `Stop`, a ilha mostra o começo da mensagem final. Se o campo não vier (V1), mostra "Prontinho!"
  como hoje.
- O cartão do fim continua na tela com o mouse fora e some com o OK ou com o próximo evento
  daquela sessão.
- Nada da mensagem final nem dos nomes de arquivo vai para o log. Conferir com `grep` no log
  depois de uma sessão.

- *(Ideia de 05/10)* Um clique no cartão abre a linha do tempo com os últimos 10 passos e a hora
  de cada um, e outro clique (ou o mouse saindo) a fecha. Usa a ilha grande da 003: se a 002 vier
  antes, a F1 da 003 vem junto.

### F2 — Várias sessões
- Duas sessões reais ao mesmo tempo: a ilha mostra a que mudou por último, com "2 sessões", e um
  clique troca de sessão.
- Um `SessionEnd` tira a sessão da conta.
- Um pedido de permissão sempre ganha a tela, seja qual for a sessão (a fila da 001 continua igual).

### F3 — O gato
- **Antes do código, o protótipo:** `design/mascote.html` ganha o selo na orelha, os 6 estados
  novos (procurando, cochilo, maratona, pergunta, tonto e cansado) e as reações (susto ao acordar,
  ronronar, patadinha), aprovados por você.
- Um `StopFailure` de `rate_limit` (simulado com `curl`, e real quando acontecer) põe o gato
  cansado com "Bati no limite de uso".
- O selo se lê na pílula de 34 px: numa captura de tela em 100% de escala, dá para dizer qual é o
  estado sem legenda.
- Cada troca de estado tem reação de menos de 1 s, e nenhuma com "reduzir movimento" ligado.
- O gato cochila (cabeça nas luvinhas) depois de 10 min sem evento, e um prompt novo o acorda
  num susto antes do "pensando".
- Dez passos seguidos sem `Stop` trazem a caneca de café, que some no `Stop` e nunca aparece com um
  pedido na tela.
- A saudação aparece uma vez ao abrir. Três cliques: ronrona. Seis: tonto. Nenhum clique rouba o
  foco.
- O cursor passando rápido perto da pílula provoca a patadinha, no máximo uma a cada 30 s. A
  leitura do cursor para quando a ilha abre, e a CPU parada não sobe mais que 0,5 ponto
  percentual de um núcleo.
- **Memória:** a média de 5 minutos parada continua abaixo de 100 MB (meta da 001).

---

## 6. Verificações pendentes

| # | Pergunta | Onde se responde |
|---|---|---|
| V1 | O `Stop` traz `last_assistant_message` na versão instalada (hoje, 2.1.287)? | Na primeira sessão real da E3 |
| V2 | Nomes dos campos: `old_string`/`new_string`/`replace_all` (Edit), `edits[]` (MultiEdit) e `content` (Write)? | Na E3. O código do Coucou usa esses nomes |
| V2b | O `StopFailure` traz `error_type: "rate_limit"` quando o limite acaba? | Na primeira vez que acontecer. Até lá, o teste é com `curl` |
| V4 | O `cursorPosition()` do Tauri 2 devolve a posição fora da janela no Windows, e qual permissão (`core:window:…`) ele pede? | D10, antes da patadinha |
| V3 | O `PreToolUse` de subagentes (`Task`/`Agent`) chega com o mesmo `session_id`? | Na E3. Define se os passos de um subagente somam na sessão |

---

## 7. Riscos

| Risco | Plano |
|---|---|
| A ilha aberta ficar cheia demais | Duas linhas de passo, e não mais. O resto fica para a 003 (diff), que tem espaço |
| A mensagem final ser longa ou ter Markdown | Duas linhas, sem marcação, cortadas com "…" |
| Os estados novos lembrarem o Mochi | Os gestos e o selo usam as partes que são nossas (orelhas flutuantes, bigodes), e você aprova no protótipo |
