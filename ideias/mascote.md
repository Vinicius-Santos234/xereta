# O mascote — documento vivo

Ideias para o personagem do Xereta. Nada aqui é decisão: elas viram decisão no protótipo da E1
(`design/mascote.html`).

## O esboço (02/10) — `mascote.png`
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
| Comando perigoso (diferencial 3) | Para trás, arrepiadas | Tapando os olhos | Esbugalhados |

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
