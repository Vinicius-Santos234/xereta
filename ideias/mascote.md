# O mascote — documento vivo

Ideias para o personagem do Xereta. Nada aqui é decisão: elas viram decisão no protótipo da E1
(`design/mascote.html`).

## O esboço (02/10) — `design/esboco.png`
Um **gato frajola**: cabeça redonda, uma mancha preta cobrindo o olho e a orelha esquerdos, a
outra orelha só no contorno, focinho rosa em triângulo, bigodes, sem boca. **As orelhas
flutuam**, soltas da cabeça.

**Por que funciona:** gato é o bicho xereta por excelência; frajola é bem brasileiro; a mancha
assimétrica torna o gato reconhecível em silhueta e não tem nada a ver com o Mochi do Coucou.

**Ajustes já combinados:** bigodes mais grossos. É um esboço para dar o rumo.

**Para resolver no protótipo:**
- O preto some na ilha escura: contorno claro, ilha grafite ou mancha cinza-escuro.
- Na pílula recolhida (~34 px), só cabem orelhas + olhos, e 2–3 bigodes ou nenhum.
- Orelha só no contorno pode parecer buraco em tamanho pequeno.

## Protótipo v1 (03/10) — `design/mascote.html`, aguardando sua aprovação
Pedido dele: *"leva bastante como inspiração a direção artística do mochi… perceba que o mochi
parece ter relevo, sombra, bordas… pra parecer que ele é um serzinho vivo"*. Do Mochi vieram as
**técnicas** de render (lidas em `windows/src/mochi/engine.ts` do Coucou); o personagem é o nosso.

- **Canvas 2D + molas em JS.** Resolve o "SVG ou Canvas" de baixo: Canvas, porque o volume
  são gradientes empilhados a cada quadro.
- **Volume em camadas:** base em diagonal (luz de cima à esquerda), cor do estado subindo de
  baixo, sombra nas bordas, luz rebatida embaixo, brilho fixo e halo da cor do estado atrás.
- **Vida:** olhos, nariz, bigodes e mancha andam sobre a esfera quando ele vira a cabeça, e o
  brilho fica parado; ele segue o mouse, pisca, respira, e cada parte solta tem a própria mola.
- **Cabeça** em superelipse, mais larga que alta e mais cheia embaixo: cara de bochecha, não de
  bola. A primeira versão era um círculo brilhante e parecia bola de bilhar.
- **O preto na ilha escura:** a mancha é grafite com brilho, não preto chapado, e o contorno
  escuro suave mais o halo do estado a separam do fundo. Na pílula, ela se lê.
- **Orelha clara** ganhou o miolo rosa, e com isso sumiu o risco de parecer buraco.
- **Pílula:** cabem orelhas, olhos, mancha e nariz, sem bigodes. O gato espia pela borda de baixo.
- **Bigodes** grossos na raiz e finos na ponta, creme com borda escura, para serem lidos no claro
  e no escuro. No "feliz" viram braços para cima; no "pensando", coçam o queixo.
- **Caras extras com gestos (03/10):** os três bigodes de um lado se juntam num braço e ganham
  uma luvinha (estilo desenho de borracha, desenhada em duas passadas para ter uma borda só).
  Prontas para usar depois: 👋 Oi! (SessionStart), 👍 Tá feito (Stop), 👌 Testes no verde
  (com piscadela), 👉 Ó, aqui! (apontando para os botões e tamborilando com a outra mão),
  ☝️ Você negou (olhando de lado, orelhas murchas), 🤷 Ops (erro pequeno, uma orelha cai),
  🙈 Eita (comando perigoso, orelhas arrepiadas) e 😱 Deu muito ruim (erro grave, olhos que
  saltam da órbita com mola). Na pílula, as mãos não aparecem.

## A ideia central: corpo de desenho animado, sem amarras
As partes **soltas** (orelhas flutuantes, bigodes, olhos) se mexem cada uma por conta própria,
de um jeito **exagerado e engraçado**, no estilo dos desenhos antigos de borracha (*rubber hose*).
Como as partes são soltas, nada precisa se deformar junto: cada uma é um objeto com a própria
mola.

### Orelhas flutuantes — o canal de emoção
Mexem bastante, de forma absurda. Gato de verdade já fala com as orelhas, então a base é real:
em pé (alerta), de lado (irritado), abaixadas (medo ou tristeza). Daí para o exagero:
- Girando como **hélice** ou **antena de radar** enquanto ele pensa ou trabalha
- **Pulando para fora da cabeça** e voltando com mola quando comemora
- Batendo uma na outra, se escondendo, se arrepiando

### Bigodes que viram mãos
Os bigodes fazem **gestos**:
- 👍 **Joinha** quando a tarefa termina
- 👌 **OK** quando os testes passam
- ☝️ **Dedo balançando** ("não, não") quando você nega um pedido
- 👉 **Apontando para os botões** quando está esperando a sua permissão
- **Tamborilando**, impaciente, se o pedido demora
- **Coçando o queixo** enquanto pensa
- **Digitando rápido** enquanto trabalha

### Olhos cartunescos
- **Esbugalhados** num erro
- **Saltando da órbita** com mola (boing!) nas situações grandes
- **Explodindo** de jeito cartunesco no extremo, e voltando
- Espiral (tonto), coração, olhar desconfiado de lado

## Mapa de estados (rascunho)

| Momento | Orelhas | Bigodes | Olhos |
|---|---|---|---|
| Parado | Tremidinhas de vez em quando | Em repouso | Piscar lento de gato |
| Pensando | Radar girando | Coçando o queixo | Olhando para cima |
| Trabalhando | Hélice | Digitando | Focados |
| Esperando você | Em pé, alerta | Apontando para os botões, tamborilando | Grandes, pidões |
| Terminou | Pulam para fora e voltam | 👍 | Fechados de alegria |
| Testes passaram | — | 👌 | — |
| Você negou | Murchas | ☝️ "não, não" | De lado |
| Erro pequeno | Uma orelha cai | — | Esbugalhados, rápido |
| Erro grande | Arrepiadas | — | Saltam da órbita |
| Comando perigoso (diferencial 3) | Coladas para trás, arrepiadas | Em guarda | **Tensos e desconfiados, olhando para o botão Permitir** *(mudou em 05/10)* |
| Você permitiu um comando perigoso | Coladas para trás | Tapando os olhos (a cara "eita") | Fechados |
| Cochilo *(05/10)* | Caídas, relaxadas | Luvinhas debaixo do queixo, como travesseiro | Fechados, respiração lenta |
| Acorda num susto *(05/10)* | Em pé de uma vez | Abertas | Arregalados (~0,4 s), depois "pensando" |
| Maratona *(05/10)* | Normais | Apoiadas na borda da ilha, segurando a caneca de café fumegante | Focados |
| Carinho *(05/10)* | Relaxadas | Em repouso | Fechados de gosto, ronronando (vibração sutil) |
| Patadinha *(05/10)* | Em pé, atentas | Uma luvinha dá um tapa rápido na direção do cursor | Seguindo o cursor |

## Ideias de 05/10: vida e personalidade

Trazidas por você em 05/10. Esforço: 🟢 pequeno · 🟡 médio · 🔴 grande.

| Ideia | Quando | Spec | Esforço | Por quê do esforço |
|---|---|---|---|---|
| **Cochilo e susto ao acordar** | 10–15 min sem evento; acorda no próximo prompt | 002 | 🟡 | Olhos fechados e orelhas caídas já existem; a pose das luvinhas debaixo do queixo é nova |
| **Desconfiado no risco alto** | Pedido de risco alto (regras da 003) | 003 | 🟢 | Junta peças que existem: os olhos "de lado" do "negou", a direção do olhar e as orelhas "arrepiar". Falta só mirar o botão |
| **Caneca de café nas maratonas** | 10 passos seguidos ou mais sem `Stop` | 002 | 🟡 | Um objeto novo (a caneca com vapor) e uma pose nova das duas mãos |
| **Patadinha no cursor** | Cursor passando rápido perto da pílula | 002 (D10) | 🟡 | O gesto é simples. O difícil é ver o cursor **fora** da ilha, que o recorte esconde; precisa ler a posição dele (V4 da 002) |
| **Ronronar no carinho** | 3 cliques em 2 s (6 viram tonto) | 002 | 🟢 | Olhos fechados de gosto e uma vibração na mola. O som é da 005 |

**O cuidado de sempre vale aqui:** tudo curto, a caneca e a patadinha nunca durante um pedido,
patadinha no máximo uma a cada 30 s, e nada disso com "reduzir movimento".

### O que já dá para prototipar em `design/mascote.html`

**As cinco**, sem depender de hook, de rede ou da ilha, porque o protótipo já tem o mouse, os
cliques e os botões de estado:

| Ideia | Como simular no protótipo |
|---|---|
| Cochilo e susto | Um botão "cochilar" e outro "chegou prompt" (sem esperar 10 min) |
| Desconfiado no risco alto | Um botão "Permitir" falso no cartão, para o olhar ter onde mirar |
| Caneca de café | Um botão "maratona" |
| Patadinha | O mouse passando rápido perto do gato **dentro da página**. No app, a mesma reação vai precisar da leitura do cursor (V4 da 002) |
| Ronronar | Os cliques no gato que o protótipo já aceita: 3 ronrona, 6 fica tonto |

Só a **patadinha** depende de algo de fora para funcionar no app (a posição do cursor fora da
janela), e só o **som** do ronronar espera a 005. O resto é desenho e mola, dentro do `gato.js`.

## Cuidados para o absurdo não cansar
- **Escala de exagero.** `PostToolUseFailure` acontece o tempo todo (um `grep` sem resultado
  já conta). Erro rotineiro ganha reação pequena, e o olho saltando fica para o que é grande de
  verdade: a sessão falhar, ou um pedido perigoso. Se o olho explodir a cada `grep`, a piada
  morre no primeiro dia.
- **Curto.** Reações de menos de 1 s. A ilha fica no canto do olho de quem está trabalhando.
- **Gesto precisa de espaço.** Um joinha com bigode não se lê em 34 px. Os gestos acontecem com
  a ilha expandida, ou ela cresce por um instante para mostrar.
- **Modo calmo.** Respeitar o "reduzir movimento" do Windows e oferecer um modo foco
  (diferencial 12) para quem quer a ilha quieta.

## Como animar (para decidir na E1)
Molas (*spring physics*) dão de graça os princípios clássicos que esse estilo pede: antecipação,
exagero, e passar do ponto antes de assentar. Candidatos: **SVG com partes separadas + molas em
JS**, que é mais fácil de prototipar e inspecionar, ou **Canvas 2D** (o caminho do Coucou), que
tem mais controle por quadro. O protótipo decide.
