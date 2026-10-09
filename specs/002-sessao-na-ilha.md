# Spec 002 — A ilha conta a sessão

**Status:** **aprovada em 07/10**, em andamento: **F1 e F2 concluídas em 07/10, F3 (o gato) concluída em 09/10**; a seguir, a linha do tempo (D11), presa à ilha grande da 003. Emenda de 07/10 na D3 (o `+N −M` vem do
`PostToolUse`).
**Origem:** `ideias/coucou-instagram.md` (P3, P4, P5, P6, P7, P10 e P11) e `ideias/mascote.md`.
**Depende de:** E3 da 001, que é quando os campos reais dos hooks são vistos pela primeira vez.

---

## 1. Objetivo

Hoje a ilha diz **o que** o Claude está fazendo agora ("Rodando npm test"). A 002 faz a ilha
contar **a sessão**: o que já foi feito, quanto mudou e como terminou. E faz o gato reagir a
cada momento de um jeito que se lê até na pílula de 34 px.

**Uma frase de sucesso:** volto do café, olho a pílula e vejo pelo gato que a sessão terminou.
Passo o mouse e leio: *"vitrine · 7 passos · frete.ts +3 −1 · Corrigi o cálculo do frete, 48
testes passando."* Não preciso abrir o terminal para saber o que aconteceu.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Diff completo e nível de risco | São da 003, que trata do pedido de permissão |
| Botão "Abrir terminal" no cartão do fim | O hook não traz PID nem janela. O "No terminal" da E4 acha a janela pelo dono da conexão do **pedido**, que fica aberta; a do `Stop` fecha na hora. Dá para a ponte anotar o dono na chegada do evento, mas fica para depois da F2 |
| Guarda-roupa, acessórios, mascote solto na área de trabalho | Charme, não núcleo. Se um dia entrarem, desenhados por nós |
| Sons | Vêm com as configurações (005) |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | Passos | **Contar os `PreToolUse` desde o último `UserPromptSubmit`** e mostrar "7 passos", sem total | O Coucou mostra "3/4", mas o hook não diz quantos passos virão. Um total inventado mente |
| D2 | Passo concluído | **Revista em 07/10:** um passo conta como feito quando chega o `PostToolUse` **dele** (pelo `tool_use_id`), ou no `Stop`; o `PostToolUseFailure` marca ✗, e um pedido negado pela ilha também. O próximo `PreToolUse` **não** conclui o anterior | Chamadas em paralelo começam juntas: a seguinte começar não quer dizer que a anterior terminou. **Limite:** um pedido negado **no terminal** ainda aparece como ✓ no `Stop`, porque o Claude Code não avisa quem respondeu |
| D3 | `+N −M` | **Emenda de 07/10, decisão sua:** vem do **`PostToolUse`** (o 8º hook; desde a noite de 07/10 em **todas as ferramentas**, ver a D12). O adaptador soma as linhas `+` e `-` do `structuredPatch` do `tool_response`; num Write de arquivo novo (`type: "create"`, patch vazio), todas as linhas do `content` são `+`. Formato desconhecido: sem conta | O plano antigo (contar pelo `tool_input` do `PreToolUse`) errava em três casos comuns: o `replace_all` (o hook não diz quantas vezes o trecho aparece), o Write por cima de um arquivo que já existe (contaria o arquivo inteiro) e a edição negada ou que falhou (contaria o que não aconteceu). O patch é o que o Claude Code de fato gravou. Custa uma chamada a mais por ferramenta, de 2 a 5 ms. O `src/diff.js` continua para a 003 |
| D4 | Fim da sessão | Mostrar o começo de `last_assistant_message` do `Stop`: até 2 linhas, sem a marcação de Markdown | Os docs dizem que o `Stop` traz esse campo. Precisa ser conferido na E3 (V1) |
| D4b | O cartão do fim | Fica aberto **até um OK**, ou até o próximo evento daquela sessão. Sem "Abrir terminal" (ver §2). **Decidido por você em 07/10:** "aberto" quer dizer **a ilha aberta**. O `Stop` abre a ilha sozinha, como um pedido, e ela não recolhe com o mouse fora até o OK | É o P5: quem estava longe da tela volta e ainda encontra o resultado. Sumir sozinho depois de 1 s jogaria fora justamente o que essa pessoa queria ler |
| D12 | O pedido respondido no terminal | **Nova em 07/10, decisão sua.** Um pedido sai da ilha sem decisão dela só quando chega o **resultado da ferramenta dele** (`PostToolUse`/`PostToolUseFailure` com o mesmo `tool_use_id`) ou quando **a sessão muda** (prompt novo, `Stop`, `StopFailure`, `SessionEnd`). O `PermissionRequest` não traz id: a ponte o liga ao `PreToolUse` com o mesmo nome e a mesma entrada (uma assinatura de tamanho + FNV-1a). Por isso o `PostToolUse` passa a valer para **todas** as ferramentas (matcher `*`) | A regra da E4 ("qualquer evento novo da sessão solta o pedido") quebrava com chamadas em paralelo: o `PreToolUse` da ferramenta irmã soltava o pedido anterior, que ficava só no terminal. Visto por você ao atualizar o vault (três leituras: a ilha mostrou a terceira enquanto o terminal pedia a primeira) e confirmado no transcript |
| D13 | As caras extras que nunca apareciam | **Nova em 09/10, decisão sua.** Cada cara ganha um gatilho do que já chega: **testes** (👌) num `Bash` que terminou bem e cujo comando é de teste (`npm test`, `cargo test`, `node --test`, `pytest`, `jest`, `vitest`, `go test`…); **aqui** (👉) quando um pedido está na tela há 10 s sem resposta; **socorro** (😱) no `StopFailure` que não é limite de uso (o erro comum fica para a ponte com problema); **oi** (👋) como momento, por cima do "pensando", no prompt de uma sessão que a ilha ainda não conhecia; **feito** (👍) no fim de uma sessão que editou arquivos, e o feliz no fim que só respondeu ou leu. A **eita** espera a 003 (o risco no pedido) | Você notou que a cara dos testes só aparecia pela bandeja. Das 8 caras extras da E1, só o ops e o negou tinham gatilho. O `SessionStart` não aceita hook `http` (E3 da 001), então o oi ficou sem o evento que era dele |
| D5 | Privacidade | A mensagem final e os nomes de arquivo **só vivem na memória** da página, como na D9 da 001 | A mensagem final pode citar segredo, igual ao `tool_input` |
| D6 | Várias sessões | A ilha mostra **a sessão que mudou por último**, com "2 sessões" no canto; um clique troca | Você roda mais de uma sessão. Hoje a ilha mistura todas |
| D7 | Selo de estado | Um **sinal na orelha clara do gato**, onde hoje fica o miolo rosa: `…` pensando, `⋯` trabalhando, `!` esperando, `?` pergunta, ✓ pronto, ✗ erro. **Emenda de 08/10, aprovada por você no protótipo:** mais a **lupa** (procurando), o **z** (cochilo) e a **bateria vazia** (cansado); o sinal fica numa placa da cor do estado; no radar e na hélice, a orelha do selo balança em vez de dar a volta | Dá para ler o estado na pílula, onde os gestos não cabem. Fica na orelha, e não num círculo no canto da cabeça como no Mochi (D12 da 001). A 100% de escala, quem separa os estados é a cor da placa (aprovado assim) |
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
 [gato]  vitrine · Claude Code                         7 passos · 2 sessões
         ✓ Editando frete.ts   +3 −1
         › Rodando npm test
```

**Ilha aberta, no fim:**
```
 [gato feliz]  vitrine terminou · 9 passos · 2 arquivos (+12 −4)
               Corrigi o cálculo do frete, 48 testes passando…   [ OK ]
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
> **07/10 — F1 concluída** (sem a linha do tempo, que vem depois da F2). As correções da noite
> passaram no seu teste na mão (pedidos em paralelo no vault: os 13 decididos pela ilha, em ordem). O que entrou:
> - **8º hook:** `PostToolUse`, primeiro com matcher `Edit|MultiEdit|Write` e, à noite, `*` (D12) (`src/hooks/mesclar.js`). Quem já
>   tinha os 7 vê "diferente" no `npm run hooks -- estado` até rodar o `instalar` de novo.
>   **Defeito achado por você na prévia:** no `settings.json` real, os hooks do Xereta estavam com
>   `timeout` antes de `headers`, e o instalador os gerava na ordem contrária. A prévia mostrava os 7
>   como mudados, e o `estado` (que comparava o texto do JSON) chamaria de "diferente" um hook igual.
>   Agora o instalador grava na ordem do arquivo real e o `estado` ignora a ordem das chaves. A
>   prévia ficou só com o bloco novo (+13 −0).
> - **Adaptador:** o passo leva `ferramenta` e `passoId` (o `tool_use_id`); o `PostToolUse` vira o
>   tipo `concluiu` (nas edições, com o caminho e o `+N −M` do patch); o `PreToolUse` e o pedido levam
>   a assinatura que os liga (D12); o `Stop` leva a mensagem crua.
> - **`src/sessao.js`** (módulo ES, sem I/O, importado pela ilha com `import()`): os passos desde o
>   último prompt (10 guardados, com a hora, para a linha do tempo; a contagem segue), o ✓/✗ de cada
>   um, o `+N −M` somado por arquivo (o mesmo arquivo com outra caixa ou barra conta uma vez), o fim
>   e a mensagem sem Markdown (título e item de lista viram frase; bloco de código sai). Até 20
>   sessões; a que mudou há mais tempo sai primeiro.
> - **Ilha:** o cartão mostra o passo anterior e o atual (o status que não é passo, como "No
>   terminal: …", entra como a linha atual); o do fim mostra "vitrine terminou · 6 passos · 2
>   arquivos (+9 −3)", duas linhas da mensagem e o OK. Um pedido continua tomando a ilha inteira.
> - **Conferido com uma sessão simulada pela ponte** (fotos da tela a 125%): ✗ no `npm test` que
>   falhou, `+3 −1` e `+2 −2` no `frete.ts`, a soma do fim certa, o pedido âmbar por cima do
>   cartão e, depois de 15 s, "› No terminal: Rodando git push…" com resposta vazia. A sessão
>   real desta conversa também apareceu no cartão, com os passos certos. **Testes em JS: 44 → 66.**
> - **Teste na mão por você (07/10), sessão real em `Desktop\Teste`:** `replace_all`, arquivo
>   novo e Write por cima. A ilha disse **11 passos · 3 arquivos (+9 −3)**: os 11 `PreToolUse` do
>   transcript, e o `+N −M` igual ao `git diff --stat` (+4 −3) mais as 5 linhas do `frutas.txt`
>   novo, que o `git diff` não mostra por não estar no git (`git add -N` mostra). Fim, OK e pedido
>   no meio funcionaram.
> - **Comando `!` não é prompt:** depois de um `! git diff --stat`, o Claude respondeu sozinho
>   (visto no transcript: nada digitado entre a saída e a resposta). Sem `UserPromptSubmit`, a
>   contagem não zera, e o cartão do fim junta os passos do pedido anterior com a mensagem nova.
>   Fica assim: segue a D1.
> - **A linha do tempo fica para depois da F2:** ela precisa da ilha grande (F1 da 003), e trazer
>   a ilha grande agora mexe no recorte e na memória. Os passos já guardam a hora.
> - **Revisão do Codex (só leitura), 07/10: 4 achados, todos corrigidos.**
>   1. *(alta)* As regex do `textoSimples` cresciam de forma quase quadrática (64 mil caracteres
>      passavam de 1,5 s, na mesma volta que mostra os pedidos). Agora a entrada é cortada em 8.000
>      caracteres, os blocos são vistos linha a linha, e as regex de dentro da linha têm teto. Teste
>      com as dez entradas que travavam: 9 ms somadas.
>   2. *(média)* O resultado de outra ferramenta soltava um pedido aberto da mesma sessão. Era um
>      caso do defeito que você achou na mesma hora (D12), e a correção é a mesma.
>   3. *(média)* Um `passoId` desconhecido (fora dos 10 guardados, ou do prompt anterior) mexia no
>      último passo. Agora, com id, só o passo dele; um resultado atrasado do prompt anterior é
>      ignorado (`ids` do prompt, separado do histórico da tela).
>   4. *(média)* O cartão do fim recolhia com o mouse fora. Agora abre e fica aberto até o OK (D4b).
> - **Defeito achado por você na mesma noite (D12):** com três leituras pedidas em paralelo, a
>   ilha mostrou a terceira enquanto o terminal pedia a primeira. O transcript mostrou que o
>   `PreToolUse` de cada irmã soltava o pedido anterior. Teste novo (`test/ponte.test.js`, com um
>   Tauri de mentira) reproduz o cenário; contra a `ponte.js` anterior, 5 dos 6 casos falham. No app,
>   com a sessão simulada: os três esperando com "+2"; o resultado do primeiro solta só ele; os
>   outros dois voltam vazios no prazo.
> - **Pequenos, junto:** "Usando a skill codex:rescue" no lugar de "Usando Skill"; pedido de `Read`,
>   `Grep` e `Glob` diz "quer ler"/"quer procurar" com o arquivo ou a pasta. **Testes em JS: 81.**

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
> **07/10 — F2 concluída** (testada por você com duas sessões reais; V6 respondida). Três detalhes que a D6 não
> dizia, decididos por mim (fáceis de mudar):
> 1. **O cartão do fim esperando o OK ganha das outras sessões.** Se a A termina enquanto a B
>    trabalha, a ilha mostra o resultado da A (D4b), e o "2 sessões ›" leva à B. Depois do OK, volta
>    a valer a que mudou por último; se não há outra, a ilha fica quieta.
> 2. **A troca por clique vale enquanto a ilha está aberta.** Ao recolher, volta à automática.
> 3. **Sem evento nenhum por 1 hora, a sessão sai da conta** (volta no próximo evento), porque o
>    terminal fechado talvez não mande o `SessionEnd` (V6).
>
> O que entrou: `sessao.js` sabe quais sessões estão vivas, qual vai para a tela (`naTela`) e qual é
> a seguinte (`seguinte`), com 5 testes novos; a ilha guarda o último status **de cada sessão** (antes
> era um só, e uma sessão apagava a outra). Na pílula, um "3" pequeno; na ilha aberta, "3 sessões ›"
> ao lado dos passos, que some durante um pedido. **Conferido com sessões simuladas e cliques de
> verdade na tela:** a que mudou por último aparece; três cliques dão a volta (rdo → vitrine → esta
> conversa); o cartão do fim da vitrine fica na frente da rdo trabalhando e abre a ilha sozinho; o OK
> passa para a outra; o `SessionEnd` tira da conta (3 → 2). **Testes em JS: 86.**
>
> **Achado no caminho, do teste e não do app:** um cursor que **pula** para fora da ilha (o
> `SetCursorPos` do meu script) não gera a saída do mouse no WebView, e a ilha fica aberta. Saindo
> em passos, como a mão faz, ela recolhe e a escolha volta à automática.
>
> **Testado por você com duas sessões reais (07/10): funcionou.**
>
> **Revisão do Codex (só leitura), 07/10, da F2 e da ponte da D12: 8 achados, todos corrigidos.**
> 1. *(média)* Uma chamada idêntica, depois de um pedido já respondido (a ferramenta ainda rodando),
>    herdava o id dele, e o resultado da primeira soltava o pedido da segunda. Agora cada ferramenta
>    guarda que já ganhou o seu pedido (`comPedido`).
> 2. *(média)* A entrada reescrita (por outro hook) ou só com as chaves em outra ordem deixava o
>    pedido sem id até o prazo. A assinatura agora ordena as chaves, e, se nada casar, vale a única
>    ferramenta de mesmo nome em curso sem pedido; com mais de uma, fica sem id (como antes).
> 3. *(média)* Negar pela ilha com uma ferramenta irmã já em curso deixava o passo ✓ no fim. O ✗ agora
>    vale sempre; só o status mostrado respeita a ordem de chegada. Conferido na tela.
> 4. *(média)* O OK apertado num cartão podia dispensar o de outra sessão que tomasse o lugar antes de
>    soltar. Agora vale o cartão do momento do aperto, como nos botões do pedido.
> 5. *(média)* Passada 1 hora, um cartão do fim sem OK perdia a tela e a ilha recolhia. Agora um fim
>    pendente mantém a sessão viva até o OK (a 1 hora só vale depois dele).
> 6. *(baixa)* A assinatura (tamanho + FNV-1a de 32 bits) colidia: o Codex achou duas entradas de
>    `echo` com o mesmo resumo. Agora a comparação é do JSON inteiro (só na memória, só até a
>    ferramenta terminar).
> 7. *(baixa)* A lista de ferramentas em curso guardava sessões vazias para sempre. Agora as vazias
>    saem, e são no máximo 32 sessões.
> 8. *(baixa)* A conta de sessões não mudava sozinha quando uma passava de 1 hora. A ilha agora se
>    redesenha na hora certa e ao abrir.
>
> **Junto, o `AskUserQuestion`:** ao responder uma pergunta minha nesta conversa, a ilha a mostrou
> como pedido, você clicou em Permitir, e nada aconteceu. O transcript mostrou que o Claude Code
> ignorou o `allow` (nenhuma decisão de hook registrada) e esperou a escolha no terminal. Agora a
> pergunta volta na hora sem decisão, e a ilha mostra "Pergunta no terminal: …", sem botões (8 ms,
> conferido na tela). Responder pela ilha é a spec 004. **Testes em JS: 95**, com os novos da ponte
> falhando contra o código anterior (controle).

- Duas sessões reais ao mesmo tempo: a ilha mostra a que mudou por último, com "2 sessões", e um
  clique troca de sessão.
- Um `SessionEnd` tira a sessão da conta.
- Um pedido de permissão sempre ganha a tela, seja qual for a sessão (a fila da 001 continua igual).

### F3 — O gato
> **Concluída em 09/10:** teste na mão, revisão do Codex com as correções conferidas por você no app
> (a saudação segura os 2 s com esta sessão mandando eventos) e o commit. Depois da F3, a linha do
> tempo (D11), presa à ilha grande da 003.
>
> **09/10 — Teste na mão, primeira parte.** Cliques, patadinha, lupa e caneca conferidos por você.
> A saudação passava despercebida: na pílula só se via a espiada e o pulo das orelhas, e o aceno
> não cabe. **Decisão sua:** ao abrir o app, a ilha abre sozinha por 2 s e o gato dela saúda do
> começo (espia de baixo e acena); depois recolhe, salvo mouse em cima, pedido ou cartão do fim.
> Saudação nova e cochilo conferidos por você. **Decisão sua:** no cochilo, os 3 cliques continuam
> sendo carinho, mas os 6 não deixam o gato tonto (teste novo, que falha sem a correção).
>
> **09/10 — Revisão do Codex, só de leitura: 4 achados, nenhum grave, todos corrigidos.** Nada nas
> 11 regras, no `cursor.rs` nem na cache de gradientes.
> 1. **O gato cochilava com um cartão do fim fora da tela** (outra sessão escolhida por clique, mouse
>    em cima por 10 min) e dormia por cima dele quando ele voltava. O `cochilar()` olhava só a tela;
>    agora pergunta ao `sessao.js` (`algumFim()`, teste com controle).
> 2. **O mouse entrando enquanto o recorte crescia apagava a saudação:** o `expandir()` dele
>    terminava depois e o `herdarMomento` trocava a saudação por nada. Agora quem chama durante uma
>    expansão espera a mesma (e, se ela foi cancelada pelo mouse saindo, abre de novo depois).
> 3. **Um evento no meio da saudação a cortava em 1 s:** o recolher comum agora respeita o prazo
>    dela (`fimDaSaudacao`). Com esta sessão ligada à ilha, era o caso comum.
> 4. **Cliques de 10 s antes contavam no carinho:** o relógio dos cliques era o `this.t`, que para
>    no gato escondido. Agora é o tempo de verdade (`relogio`, de mentira nos testes; teste com
>    controle). **110 testes em JS.** O 2 e o 3 só se conferem no app.
>
> **09/10 — Depois do commit da F3: as caras extras que nunca apareciam (D13, decisão sua).** Você
> notou que a cara dos testes só aparecia pela bandeja. Das 8 extras da E1, só o ops e o negou tinham
> gatilho. Agora: 👌 testes (o adaptador marca o `Bash` de teste no `PostToolUse`), 👍 feito (fim
> com arquivos editados), 😱 socorro (`StopFailure` que não é limite), 👋 oi (momento de 1,5 s no
> prompt de uma sessão nova, por cima do "pensando") e 👉 aqui (pedido há 10 s na tela). A eita fica
> para a 003. **112 testes em JS**; os novos falham contra o código anterior. No app: 👌 num
> `npm test` desta sessão; oi, socorro e aqui com a sessão `sim-d13` simulada pela ponte (o pedido
> de mentira venceu o prazo e saiu sem resposta, sem `allow`); 👍 no fim desta sessão. **Você viu
> as cinco certas.** Revisão do Codex, só de leitura: 3 achados, corrigidos com controle. (1) A
> regex dos testes casava quem só fala de teste (`echo npm test`, `npm install jest`): agora o
> comando é cortado nos separadores e o teste tem de estar no começo de um pedaço. (2) O 👋 cortava
> o susto e a saudação: agora não corta momento nenhum. (3) Uma sessão que saía do Map (teto ou
> `SessionEnd` e retomada) ganhava o 👋 de novo: agora o `sessao.js` lembra as chaves já vistas
> (até 200). **113 testes em JS.**
>
> **08/10 (noite) — Ligada aos eventos; a memória resolvida.** O que entrou:
> - **Estados pelos eventos:** `estadoDoGato` no `sessao.js` (com testes). `Grep`/`Glob`/`WebSearch`/
>   `WebFetch` → procurando (o adaptador marca `procura`); 10 passos ou mais desde o prompt →
>   maratona; ferramenta que falhou → a reação pequena (`ops`, D9); a pergunta → pergunta;
>   `StopFailure` com `error_type: "rate_limit"` → cansado, com "vitrine parou no limite de uso" e
>   "Bati no limite de uso" (V2b segue aberta: o campo vem da documentação).
> - **Cochilo:** 10 minutos sem evento, nunca com pedido ou cartão do fim esperando; o hover não
>   acorda; o próximo evento acorda com o susto. **Saudação** uma vez ao abrir. **Cliques:** carinho
>   e tonto, com os textos dos momentos na pílula e na fala; o gato escondido herda o momento ao
>   aparecer (`herdarMomento`).
> - **O cursor (V4) pelo Rust, e não pelo JS.** A primeira versão lia o `cursorPosition()` a 15 qps e
>   custou **7,5 pontos de CPU** (13,1% → 5,6% ao desligar, mesma execução) e a serra de memória.
>   Agora `cursor.rs` lê o cursor numa linha de fundo e só manda o evento `cursor` quando ele está a
>   até 240 px lógicos da pílula; o `recortar` diz quando vigiar (`perto`). Cursor longe: 5,4%,
>   igual a sem leitura; parado perto: +1,6 ponto. A permissão `cursor-position` não é mais usada.
> - **Conferido no app** com sessão simulada e fotos pelo CDP: procurando, ops, maratona (caneca na
>   pílula), cansado no cartão do fim, cochilo, susto, carinho, tonto e a patadinha com o cursor
>   passando de verdade. **Testes: 106 em JS, 30 no Rust.**
> - **Memória: a serra voltou e foi resolvida (08/10, noite).** Parada, a release da F3 fazia serra
>   de ~85 a ~210 MB (médias de 110 a 149 MB), contra ~85 MB planos do commit anterior, medidos
>   alternados. Quem crescia era o **renderizador**, ~0,6 MB/s, em memória **nativa** (o heap do JS
>   ficava em 2 MB), e só quando o gato desenhava. Uma coleta pedida pela depuração
>   (`HeapProfiler.collectGarbage`) o derrubava de 39,6 para 22,4 MB na hora: não é vazamento, é
>   memória que só volta numa coleta completa, e o V8 a agenda pelo heap do JS, sem enxergar o
>   nativo. A build anterior escapava por sorte do agendamento (compilar 35 KB de JS também
>   "destravava" a F3). Duas mudanças:
>   1. **Gradientes e caminhos guardados** (`guardar`/`gradiente` no `gato.js`): a pílula criava 18
>      gradientes e 7 `Path2D` por quadro (375 por segundo; a ilha aberta, mais de 2.000). Agora os
>      gradientes saem de uma cache (pontos em 1/4 de px, alfa em 1/50) e a cabeça, a mancha e os
>      bigodes são traçados direto no contexto. Depois de esquentar, **zero** objetos novos em todos
>      os estados (teste novo, que falha com a cache desligada: 5.400 gradientes e 1.500 caminhos em
>      300 quadros). Sozinha, baixou a serra para 80–141 MB (média 111): não bastou.
>   2. **Uma coleta completa a cada 20 s** (`--js-flags=--expose-gc` no `tauri.conf.json`, e
>      `gc()` no laço da ilha; sem a flag, não faz nada). Com o heap de 2 MB, custa milissegundos.
>   **Resultado, alternado com o commit anterior (5 min cada):** F3 **74,9 e 74,5 MB**, planas (73–78),
>   contra 84,4 e 84,8 MB. CPU no ruído da máquina (6,6% contra 6,6% na mesma rodada).
>
> **08/10 — Protótipo aprovado por você:** *"ficou bom, pode aprovar"*. As cores na pílula a
> 100% ficam assim, a orelha do selo balança, e os três sinais novos entram na D7 (emenda acima).
>
> **08/10 — Protótipo pronto** (`design/mascote.html`). O motor é o mesmo
> da ilha (`src/mascote/gato.js`), então o que for aprovado já está pronto para ligar aos eventos.
> - **Selo:** o miolo da orelha clara vira uma placa da cor do estado, com o sinal desenhado em
>   traço e sempre em pé: `…` (os pontos acendem um por um), `⋯` (em onda), `!`, `?`, ✓, ✗, e três
>   que a D7 não listava: **lupa** (procurando), **z** (cochilo) e **bateria vazia** (cansado). No
>   radar e na hélice, a orelha do selo balança em vez de dar a volta (de costas, o selo some); quem
>   gira é a escura. Na pílula, as orelhas ficam 40% maiores e a placa toma quase a orelha toda.
> - **A 100% de escala** (a faixa do protótipo desenha pixel a pixel), quem separa os estados é
>   **a cor da placa**; o sinal ajuda no `!`, `?`, ✓ e ✗ e quase some no `…`. Por isso a pergunta
>   ficou magenta e o cansado cinza: em azul e lilás, se confundiam com procurando e pensando.
> - **Estados novos:** procurando, pergunta, maratona (a caneca entre as luvinhas; na pílula, ao
>   lado do gato), cochilo (a cabeça afunda nas luvinhas, "z" saindo da orelha) e cansado (pálpebra
>   pesada, orelha escura caída, gota de suor).
> - **Momentos**, por cima do estado e voltando sozinhos a ele: susto (0,45 s, em qualquer saída do
>   cochilo), carinho (3 cliques em 2 s), tonto (6 cliques, 3 s), saudação (espia de baixo e acena).
>   Um pedido corta o momento na hora; com pedido na tela, cliques não viram carinho nem tonto.
> - **Patadinha:** `criarVigiaDePatada` (cursor a mais de 900 px/s, a até 60 px da pílula e fora dela,
>   uma a cada 30 s); nunca com pedido, no cochilo ou com "reduzir movimento". Na pílula, só essa
>   luvinha aparece, com um golpe curto, porque o canvas acaba logo depois da bochecha.
> - **V4 respondida pelo código-fonte** (Tauri 2.12.1, tao 0.37.1): `cursorPosition()` chama
>   `GetCursorPos`, que dá a posição na tela inteira em pixels físicos, com o cursor fora da janela.
>   A permissão é `core:window:allow-cursor-position`. Conferir no app ao ligar a patadinha.

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
| V1 | O `Stop` traz `last_assistant_message` na versão instalada (hoje, 2.1.287)? | Na primeira sessão real da E3. **Respondida em 05/10 (2.1.289): traz** |
| V2 | Nomes dos campos: `old_string`/`new_string`/`replace_all` (Edit), `edits[]` (MultiEdit) e `content` (Write)? | Na E3. **Respondida em 05/10:** Edit e Write como o Coucou. Com a emenda da D3, quem conta é o `tool_response` (V5) |
| V5 | O que o `PostToolUse` traz de Edit e Write? | **Respondida em 07/10 (2.1.292), numa sessão real pelo plano com um hook que gravava o corpo:** `tool_use_id`, `duration_ms` e um `tool_response` com `structuredPatch` (trechos com `lines` começando por `+`, `-` ou espaço), `originalFile` (o arquivo inteiro de antes) e `userModified`. Edit: também `oldString`, `newString`, `replaceAll`; um `replace_all` que trocou 2 linhas veio com as 2. Write: `type` `"create"` (patch vazio, `originalFile: null`) ou `"update"` (patch real: `−1 +2` numa troca de linha mais uma linha nova). O MultiEdit não foi testado (o teste não pediu um); o adaptador lê o mesmo `structuredPatch` |
| V2b | O `StopFailure` traz `error_type: "rate_limit"` quando o limite acaba? | Na primeira vez que acontecer. Até lá, o teste é com `curl` |
| V4 | O `cursorPosition()` do Tauri 2 devolve a posição fora da janela no Windows, e qual permissão (`core:window:…`) ele pede? | D10, antes da patadinha. **Respondida em 08/10 pelo código-fonte:** devolve (via `GetCursorPos`, em pixels físicos da tela); a permissão é `core:window:allow-cursor-position`. Falta ver no app |
| V3 | O `PreToolUse` de subagentes (`Task`/`Agent`) chega com o mesmo `session_id`? | Na E3. Define se os passos de um subagente somam na sessão. **Respondida em 07/10: chega com o mesmo**; os passos do Codex como subagente apareceram no cartão desta conversa |
| V6 | Fechar a janela do terminal manda o `SessionEnd`? | **Respondida por você em 07/10: manda.** A contagem cai na hora. A 1 hora sem eventos fica só como rede para um encerramento que não avise |

---

## 7. Riscos

| Risco | Plano |
|---|---|
| A ilha aberta ficar cheia demais | Duas linhas de passo, e não mais. O resto fica para a 003 (diff), que tem espaço |
| A mensagem final ser longa ou ter Markdown | Duas linhas, sem marcação, cortadas com "…" |
| Os estados novos lembrarem o Mochi | Os gestos e o selo usam as partes que são nossas (orelhas flutuantes, bigodes), e você aprova no protótipo |
