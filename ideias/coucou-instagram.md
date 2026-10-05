# O Coucou no Instagram — lido em 05/10

Tudo o que o criador (instagram.com/louis_rlee) mostrou do Coucou até 05/10, comparado com o
Xereta. É material de estudo: o que pegar, o que fazer parecido e o que fica de fora. Nada aqui é
decisão; o que for escolhido entra na spec.

**Fontes:** 8 reels sobre o Coucou (27/09 a 04/10), o carrossel fixado de 03/10 (8 slides de
*making of*), o destaque "Dev" dos stories e as notas de versão 0.1.1 a 0.1.7 no GitHub (uma delas
aparece num reel). Os outros 7 reels do perfil são de sites e não têm nada do Coucou.

---

## Contexto

- **Quem é:** francês, engenheiro de software há 3 anos, faz sites com 3D e WebGL. O Coucou
  nasceu como "um bonequinho no meu notch de olho no Claude Code".
- **Números:** o reel do Windows (30/09) tem **2 milhões de views e 86 mil curtidas**; o primeiro
  reel (27/09), 196 mil; o do Linux, 101 mil. O carrossel tem 4,7 mil curtidas e **2,4 mil
  comentários**, quase todos pedindo o link.
- **Ritmo:** **7 versões para Mac em 3 dias** (0.1.1 em 02/10 até 0.1.7 em 04/10). Em 04/10 o
  repositório tinha 30 issues e 95 PRs abertos.
- **Windows é cidadão de segunda.** O instalador segue suspenso (Defender), e quem quer precisa
  compilar (Rust + Node + Git, ~5 min). Vários recursos são "só no Mac" ou "só na build do GitHub":
  o botão Always, os atalhos globais da 0.1.7, o Mochi na área de trabalho, Codex e Antigravity.
- **Vem aí:** um story de 05/10 anuncia **"Coucou in iOS is coming"**, com widgets no iPhone
  mostrando o estado de Vercel, VS Code, Cal.com e Notion.

---

## O que aparece na tela

### Pílula recolhida (Windows)
Barra preta larga no topo, centralizada. O Mochi fica à esquerda e, à direita, uma grade 2×2 com
um mini-mascote colorido por integração. Num PC sem notch, a ilha "desliza para fora da borda de
cima" em vez de se esconder dentro dela.

### Ilha expandida
- **Cabeçalho:** abas com ícone (casa, chat, `+`), "3 running", engrenagem e som.
- **Cartão da sessão:** `● korus  Claude Code`, um **contador de passos** (`1/4`, `3/4`), o passo
  anterior com ✓ e o atual com `›`, e um botão `↗` para ir ao terminal. Os verbos saem traduzidos
  ("Lit", "Modifie", "Exécute · npm test").
- **Cada edição mostra `+24 −6`**, e um clique abre o diff na própria ilha (0.1.4).
- **À direita:** as outras fontes (Stripe, GitHub, n8n, Vercel, Codex, Cursor), cada uma com um
  mini-mascote da sua cor e um selo quando tem novidade.

### Pedido de permissão
Cartão com fundo âmbar, `korus needs permission` e o comando numa caixa monoespaçada.
- **Windows:** `Deny [N]` e `Allow [Y]`, com a tecla indicada no botão.
- **Mac:** `Deny`, `Allow` e `Always`.
- **O cartão não recolhe quando o mouse sai.** Ele fica até você responder, e reabrir a ilha mostra
  o pedido de novo (0.1.2). Se a ilha já estava aberta noutra aba, ele aparece e, depois da
  resposta, volta a aba onde você estava.

### Pergunta do Claude (`AskUserQuestion`, 0.1.3)
"Claude asks", a pergunta e as opções como botões. Dá para digitar a sua resposta, e "Reply in
terminal" devolve a pergunta ao terminal. Para ligar, é preciso reinstalar os hooks.

### Fim da sessão
Cartão verde, `Claude Code finished`, a **última mensagem do Claude** no lugar do último passo
("Migration applied — 14 tests passed") e os botões **Open terminal** e **OK**. Numa versão anterior
ele mostrava `Done · 48 tests passed` com as últimas linhas da saída do `npm test`.

### Diff na ilha
Uma edição abre a ilha grande: o arquivo com as linhas removidas em vermelho e as novas em verde, e
à esquerda um checklist da sessão (Read ✓ · Edit ◌ · Bash · Done).

### Arrastar um arquivo
Ao arrastar sobre a ilha, aparece uma zona tracejada verde ("Drop your files here · PDF, Images,
Code, Docs") e **o mascote vira uma caixa** que "engole" o arquivo. Depois vêm a barra de progresso
e a aba de chat com o arquivo anexado.

### Chat
"Résume ma journée" responde "3 sessões do Claude Code terminadas, 2 pagamentos no Stripe e o
workflow do n8n caiu uma vez". O chat precisa de chave de API (Anthropic, OpenAI, Gemini) ou de um
modelo local (Ollama, LM Studio).

### Cutucar o mascote
Clicar nele várias vezes o deixa tonto: **"Too many hits at once. Give me a sec — back to work in
three seconds."**

### Bandeja e configurações
- **Bandeja (Windows):** Open Coucou · Settings… · Pause · Quit.
- **Configurações (Windows):** uma janela com seções.
  - *Claude Code:* o caminho do `settings.json`, o relé com uma bolinha verde de "ok" e
    **Install hooks…**. Esse botão mostra o diff ("isto é exatamente o que muda; seus hooks ficam
    intactos"), o caminho do backup e os botões **Back up and write** e Cancel. Depois vem
    **"Done. Previous settings saved as … Open a new Claude Code session to pick the hooks up."**
    e os botões viram **Reinstall hooks…** e **Uninstall hooks…**.
  - *Claude:* chave de API e modelo.
  - *Integrations:* "até 4 pílulas ao lado do Mochi; as chaves ficam no **Gerenciador de
    Credenciais do Windows**, nunca em disco".
- **Configurações (Mac), mais completas:** barra lateral com General, Active pills, Agents, Chat,
  Integrations e Shortcuts. No General: som ligado/desligado com volume, **"Close after 60 s
  inactive"**, **"Hide after 3 min without movement"**, atalho para mostrar a ilha e iniciar com o
  sistema.
- **Hook visto no diff:** `Notification` com `"type": "command"` e `"timeout": 10`.

### Instalador do Windows
NSIS por usuário (`AppData\Local\Coucou`), **sem pedir administrador**, com 4,02 MB e 12,7 MB
instalado. Na primeira vez, o Mochi desce do topo e acena.

---

## O mascote: como ele é feito (carrossel de 03/10)

- **11 estados:** idle, working, thinking, searching, approval, question, error, finished,
  ratelimit, sleeping e dizzy. Cada um tem uma reação curta:

  | Estado | Reação |
  |---|---|
  | finished | Gira uma vez em 950 ms e solta 5 faíscas |
  | error | Treme na horizontal |
  | approval | Pula na vertical |
  | dizzy | Gira duas vezes em 1,3 s |
  | question | Pisca |
  | ratelimit | Uma gota de suor |
  | os outros | Pisca |

  O laço roda a 120 Hz: transições, olhar, piscar e partículas. A cor muda com decaimento
  exponencial (`mix(col, alvo, 1 − 0,002^dt)`).
- **Um selo de estado no canto da cabeça,** em (−0,72R, −0,72R): `…` azul (trabalhando), `…` roxo
  (pensando), `!` âmbar (aprovação), `?` ciano (pergunta), ● vermelho (erro) e ● verde (pronto). É
  o que mantém o estado legível em tamanho pequeno.
- **Forma:** superelipse com n = 2,7 e 2×1,14R por 2×0,88R. Os slides mostram n = 2 como
  "redondo demais" e n = 4,5 como "quadrado demais". No upload, ele vira uma caixa. Os olhos andam
  "sobre uma esfera" (yaw ±0,37, pitch −0,12) e as bochechas coram.
- **Partículas:** estrelas ao terminar, corações no "love", uma galáxia de pontinhos na saudação e
  um anel de órbita.
- **20 expressões** (além dos estados: greeting, love, surprised, proud, wink, yawn, annoyed,
  upload, dancing) e **28 sons**.
- **Guarda-roupa (0.1.5):** gorro, gorro de Papai Noel, chapéu de festa, coroa, chapéu de bruxa,
  orelhas de coelho, laço, óculos escuros, óculos redondos, cachecol e abóbora, todos desenhados em
  código. Eles acompanham a cabeça em 3D, e o modo automático veste o Mochi conforme a estação.
- **Mochi na área de trabalho (0.1.6, Mac):** você o arrasta para fora do notch e ele fica na
  área de trabalho. Lá ele segue o cursor com os olhos, dança com a música e dorme quando nada
  acontece. Quando o Claude precisa de você, **ele voa de volta ao notch** com o pedido e depois
  volta ao lugar dele.

---

## Comparação com o Xereta

### Onde ele confirma o que já decidimos
- **Instalar hooks com diff, backup e confirmação** (D14): é o mesmo fluxo, inclusive o texto
  "seus hooks ficam intactos".
- **Cor por estado com halo e volume em camadas:** foi de onde tiramos a técnica, e o carrossel
  confirma a lista.
- **Logs sem comandos e só para o próprio usuário** (D9 e o token da D5).
- **Instalador por usuário, sem administrador:** o nosso NSIS do Tauri já é assim por padrão.
- **Pausar na bandeja:** está nos riscos da spec, e ele tem.

### O que pegar, com a etapa em que entra
Custo: 🟢 pequeno · 🟡 médio · 🔴 grande

| # | O quê | Etapa | Custo | Observação |
|---|---|---|---|---|
| P1 | **O pedido de permissão não recolhe com o mouse:** fica aberto até a resposta, e reabrir mostra o pedido | E4 | 🟢 | Hoje a ilha recolhe 1 s depois de o mouse sair (`ESPERA_RECOLHER`). Num pedido isso esconderia os botões |
| P2 | **"Abra uma sessão nova do Claude Code para pegar os hooks"** depois de instalar, e as opções Reinstalar/Remover | E3 | 🟢 | Os hooks só valem para sessões novas. Sem esse aviso, quem testa na sessão aberta acha que quebrou |
| P3 | **Contador de passos e os dois últimos passos** no cartão (✓ o anterior, `›` o atual) | E3 | 🟢 | Hoje a ilha mostra só o resumo atual |
| P4 | **`+N −M` em cada edição**, calculado de `old_string`/`new_string` | E3/E4 | 🟢 | É meio caminho do nosso diferencial 2 |
| P5 | **No fim, a última mensagem do Claude**, com Abrir terminal e OK | E3 | 🟢 | Conferir na E3 se o `Stop` traz a mensagem (`last_assistant_message`) ou se é preciso ler o `transcript_path` |
| P6 | **Selo de estado no gato,** para a pílula de 34 px, onde os gestos não cabem | E3 | 🟢 | Fazer do nosso jeito (D12): por exemplo, na ponta da orelha flutuante, e não um círculo no canto da cabeça |
| P7 | **Estados que faltam no gato:** procurando (Grep/Glob/WebSearch), pergunta, limite de uso, dormindo e tonto | E3+ | 🟡 | Temos 6 estados e 8 caras. "Dormindo" depois de N min parado combina com o piscar lento de gato |
| P8 | **Responder `AskUserQuestion` pela ilha**, com "Responder no terminal" | v2 | 🟡 | Antes de pôr na spec, ler no código dele qual hook e qual resposta ele usa |
| P9 | **Atalhos na ilha:** `[S]`/`[N]` (Sim/Não) nos botões, valendo só com um pedido aberto | v2 | 🟡 | Ele usa Y/N no Windows. O nosso risco (§2: sequestrar o que você digita, o AltGr do ABNT2) continua. Se entrar, só com um pedido na tela e com combinação, nunca a letra sozinha |
| P10 | **Cutucar o gato:** depois de vários cliques ele fica tonto e diz "Para com isso! Volto em 3 segundos" | v2 | 🟢 | Encanta e custa pouco. Na spec, easter eggs ficaram para depois |
| P11 | **Saudação ao abrir:** o gato espia pela borda e acena | E3 | 🟢 | A cara "oi" já existe |
| P12 | **Configurações:** recolher depois de N s, esconder depois de N min sem movimento, som com volume, iniciar com o Windows | v2 | 🟡 | O "esconder sem movimento" responde ao risco "fica por cima de vídeo em tela cheia" |
| P13 | **Uso do plano** (limites de 5 h e semanal) numa pílula, mais o gato cansado perto do limite | v2 | 🟡 | É o nosso diferencial 11. Ele diz que "a sua status line continua funcionando": conferir se ele lê os limites pelo JSON da status line |
| P14 | **Segredos no Gerenciador de Credenciais do Windows** | Quando houver chave | 🟢 | Já está na spec (§2: "cofre do sistema"). Ele confirma o caminho no Windows |

**Onde cada P foi parar (conferido em 05/10):**

| P | Spec | Onde |
|---|---|---|
| P1 | 001 | E4, emenda aprovada em 05/10 |
| P2 | 001 e 005 | E3 da 001 (o aviso, emenda aprovada) e D3 da 005 (Religar e Desligar na janela) |
| P3 | 002 | D1, D2 e F1 |
| P4 | 002 | D3 e F1 (o módulo `diff.js`, reusado pela 003) |
| P5 | 002 | D4, D4b e F1. Sem "Abrir terminal": no Windows não há como achar a janela da sessão (§2) |
| P6 | 002 | D7 e F3 (na orelha, não no canto da cabeça) |
| P7 | 002 | §4 e F3: procurando, dormindo, pergunta, tonto e cansado |
| P8 | 004 | Inteira |
| P9 | 005 | D10 e F4: desligados por padrão, só com pedido na tela, nunca com Ctrl+Alt, nunca no risco alto |
| P10 | 002 | §4 e F3 |
| P11 | 002 | §4 e F3 |
| P12 | 005 | D7 (recolher e esconder), D8 (iniciar com o Windows), D11 e F4 (som com volume) |
| P13 | 005 | D12, D13 e F5 (status line do Xereta, gato cansado acima de 80%) |
| P14 | 001 e 006 | Regra da §2 da 001; a §2 da 006 a repete. Nenhuma spec guarda chave hoje |

### Diferenciais: o que o Instagram mudou
- **2. Diff antes de aprovar → ficou mais estreito, mas continua.** Ele já mostra o diff de cada
  edição, ao vivo e com um clique (0.1.4). **O cartão de permissão, porém, mostra só o comando.**
  O nosso diferencial passa a ser exatamente isto: **o diff no próprio pedido, antes do
  Permitir**.
- **3. Nível de risco → continua sem concorrente.** Não apareceu nada parecido.
- **4. "Sempre permitir" com regra visível → continua.** O Always dele existe só no Mac e não
  mostra lista nenhuma.
- **5. Resumo da sessão e vault → ficou mais estreito.** Ele tem "Resume o meu dia", mas pelo chat
  e com chave de API. O nosso continua diferente porque sai dos próprios eventos, **sem chave**, e
  vai para o Obsidian.
- **9. Celular → agora tem concorrente anunciado.** O app de iOS vem com widgets de status. Não vi
  aprovação pelo celular.
- **10. Windows e português → mudou de figura, a nosso favor.** Ele roda no Windows, mas como
  segunda classe: sem instalador e sem vários recursos do Mac. **"Feito para Windows" voltou a ser
  diferencial**, na forma de "Windows de primeira, com instalador".
- **11. Mascote que reflete a sessão → parcial.** Ele tem o estado `ratelimit` com gota de suor e
  a pílula de uso do plano.
- **12. Modo foco → parcial.** Ele tem Pausar e Mudo (⌃⌥M).

### O que não vamos copiar
- **Guarda-roupa, Apple Music, dança, Mochi na área de trabalho:** é charme, mas é outro foco. Se um
  dia o gato ganhar acessórios, eles têm que ser nossos.
- **Integrações (Stripe, n8n, Vercel, GitHub), chat com chave, arrastar arquivo:** continuam fora
  (§2 da spec). Correr atrás disso é a "paridade" que a spec descarta.
- **Mascote branco de marshmallow, selo circular no canto e paleta idênticos:** isso é cara, não
  mecânica (D12).
- **Hook `command` com relé `.exe`:** o nosso hook `http` direto já está pronto e testado (E2).

---

## Se um dia o Xereta for publicado: o que funcionou na divulgação
- **"Comente COUCOU que eu mando o link na DM"** em todo post: 2,4 mil comentários no carrossel.
- **Reels curtos, sem narração, só com música,** mostrando um fluxo real e crível: "corrige o
  arredondamento do IVA e faz o push" → testes → pedido do `git push` → Allow → mascote feliz.
- **Tutorial de instalação por plataforma,** em 4 passos com barra de progresso e uma tela de
  resumo no fim. Um deles nasceu de um comentário ("Do it for Windows man 🔥").
- **Carrossel de *making of***: construção, expressões, design, máquina de estados, animação,
  implementação e novidades. É conteúdo de portfólio pronto.
- **A frase do vídeo de divulgação** (de um parceiro francês): "quando você trabalha, ele se
  esconde; quando precisa de você, ele te dá um oi". A nossa equivalente sai do D12: **o Xereta
  espia.**
