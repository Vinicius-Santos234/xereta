# Spec 005 — Configurações e conforto

**Status:** rascunho (05/10), aguardando a sua aprovação. Pode começar logo depois da 001; não
depende da 002, 003 nem 004.
**Origem:** os itens da v2 na §2 da 001 (iniciar com o Windows, tela cheia, atalhos), o risco
"fica por cima de vídeo e jogo", os diferenciais 11 (gato que reflete a sessão) e 12 (modo foco) e
`ideias/coucou-instagram.md` (P9, P12 e P13). Em 05/10 entraram o modo apresentação e os sons
novos (`ideias/diferenciais.md`, itens 15 e 16).

---

## 1. Objetivo

Até aqui o Xereta se ajusta editando arquivo (`config.json`) e se liga pelo terminal (`npm run
hooks`). A 005 dá a ele uma **janela de configurações** e o que falta para ficar aberto o dia todo
sem incomodar: sair da frente em tela cheia, ficar quieto quando você pede, abrir junto com o
Windows.

**Uma frase de sucesso:** instalo o Xereta num PC novo, abro, clico em **Ligar ao Claude Code**,
vejo a prévia e confirmo. Ponho um vídeo em tela cheia e a ilha some sozinha. À noite, ligo o
modo foco, e ela só aparece se o Claude pedir permissão.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Atalhos que valem o tempo todo (abrir a ilha, trocar de sessão) | Continua valendo a §2 da 001: um atalho sempre registrado sequestra o que você digita em outros apps. Só entram os atalhos de responder um pedido (D10) |
| Vários monitores | Continua fora. Entra como spec própria se fizer falta |
| Instalador assinado e publicação | É uma decisão sua, de outra spec, quando decidir abrir o projeto |
| Biblioteca de sons (o Coucou tem 28) | Três sons bastam (D11) |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | A janela | Uma segunda janela do Tauri, comum (com foco, barra de título e tamanho mudável), aberta pela bandeja em **Configurações…**. Fechar a janela não fecha o app | A ilha não pode roubar o foco (D13 da 001), mas uma janela de configurações precisa dele |
| D2 | Ligar ao Claude Code pela janela | O **mesmo módulo JS** do `npm run hooks` da E3, que roda tanto no Node quanto no app. O app grava pelo plugin `fs` do Tauri, com escopo **só** no `~/.claude/settings.json` e nos backups dele | Um único lugar sabe instalar. A prévia, o backup, a gravação atômica e a recusa da D14 da 001 (conferida de novo logo antes de gravar, emenda de 05/10 na E3) valem dos dois jeitos |
| D3 | Depois de ligar | A janela diz: **"Pronto. Abra uma sessão nova do Claude Code para o Xereta aparecer."** Os botões viram **Religar** e **Desligar** | É o mesmo aviso da E3 da 001. *(05/10: no Claude Code 2.1.289 os hooks recarregam sozinhos, inclusive nas sessões abertas; o aviso diz isso e fica com a sessão nova como plano B)* |
| D4 | Onde as preferências ficam | `%APPDATA%\app.xereta.ilha\preferencias.json`, separado do `config.json` | O `config.json` tem o token e a porta, que não se mexem por tela. Preferências se mexem o tempo todo |
| D5 | Tela cheia | O Rust pergunta ao Windows a cada 2 s com `SHQueryUserNotificationState`. Em **jogo, vídeo em tela cheia ou apresentação**, a ilha some. **Um pedido de permissão aparece mesmo assim**, mas só como pílula âmbar | É a API que o próprio Windows usa para não mostrar notificação por cima de jogo. Um pedido não pode ficar escondido, senão o Claude Code espera em vão |
| D6 | Modo foco | Liga e desliga pela bandeja e pela janela. Com ele ligado, **só pedidos e perguntas** abrem a ilha; o resto fica na pílula, sem animação | É o diferencial 12. O Pausar da bandeja continua existindo, e esconde tudo |
| D7 | Recolher e esconder | Recolher depois de **N s** com o mouse fora (padrão: 1 s, como hoje). A opção **"Esconder depois de N min sem nada acontecer"** vem desligada por padrão | São os dois ajustes que o Coucou oferece. Esconder vem desligado porque a pílula parada é justamente o "olhar de canto" do produto |
| D8 | Iniciar com o Windows | O plugin `autostart` do Tauri, com uma caixa de marcar na janela, desligada por padrão | Já estava na v2 da 001 |
| D9 | Movimento | "Reduzir movimento" segue o Windows (como já faz) e ganha uma opção para forçar ligado | Para quem quer o gato quieto sem mudar o Windows inteiro |
| D10 | Atalhos de resposta (P9) | **Desligados por padrão.** Ligados, eles são registrados (`RegisterHotKey`) **só enquanto um pedido está na tela** e soltos assim que ele é respondido. Sempre uma **combinação** (nunca uma letra sozinha) e **nunca com Ctrl+Alt**, que é o AltGr do ABNT2. A tecla aparece no botão (`Permitir · Ctrl+Shift+…`). **Pedido de risco alto (003) não aceita atalho:** só clique | É o meio-termo entre o risco da §2 da 001 e o que o Coucou faz (Y e N sozinhos). Fora de um pedido, o teclado fica intocado. A combinação exata sai da V3 |
| D11 | Som (P12; ajustado em 05/10) | **Três sons discretos feitos em código** (Web Audio, sem arquivo): um **miadinho suave** para pedido e pergunta, um **"plim"** para pronto e um **tom grave e curto** para erro. Mais o **ronronar** do carinho (002), baixinho. Liga e desliga por tipo, com volume, e **um clique na bandeja ("Som") silencia tudo**. Padrão: **só o miadinho de pedido e pergunta ligado**, a 50% | É o pedido que faz o Claude Code esperar, e quem está longe da tela precisa ouvir. Som feito em código é nosso, como o gato, e não pesa no instalador. Modo foco e tela cheia não calam o som de pedido |
| D12 | Uso do plano (P13) | Um comando de **status line** do Xereta (o subcomando `xereta status` do binário da D2 da 006, que esta spec traz junto se vier antes) que lê `rate_limits` do JSON da status line, repassa à ponte por `/fontes/claude-code/evento` e imprime uma linha curta (`5 h: 42% · semana: 18%`) | Os hooks não trazem o uso; a status line traz. Hoje o seu `settings.json` **não tem status line**, então não há nada para encadear. Se um dia tiver, o comando chama a anterior e devolve o que ela imprimir |
| D13 | O gato perto do limite | Acima de **80%** na janela de 5 h, o gato fica **cansado** (o estado da 002) e a pílula mostra o percentual. Acima de 95%, o selo fica âmbar | É o diferencial 11: o gato conta o que você não está olhando |
| D14 | Modo apresentação | Um liga/desliga na bandeja e na janela, que **também liga sozinho** quando o Windows está em modo de apresentação (a mesma consulta da D5). Com ele ligado: caminhos viram só o nome do arquivo, comandos viram só o programa ("Rodando git…"), a mensagem final da 002 e o diff da 003 ficam escondidos ("oculto no modo apresentação"), e trechos com cara de token (`sk-`, `ghp_`, `Bearer …`, sequências longas de hexadecimal ou base64) viram `•••`. Os botões continuam funcionando | Em reunião e em tela compartilhada, a ilha fica à vista de todo mundo. O pedido continua respondível, só que sem expor o que não precisa |
| D15 | Fora das capturas de tela | Uma opção a mais, **desligada por padrão**: `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`, que tira a ilha de gravações e compartilhamentos de tela (Teams, Meet, OBS) sem tirá-la da sua tela | Protege de verdade, e não só mascarando. Vem desligada porque também some das gravações que usamos para testar a animação quadro a quadro |

---

## 4. A janela

```
Xereta — Configurações
──────────────────────────────────────────────
● Claude Code      Ligado · 9 hooks · porta 47321
                   [ Religar… ]  [ Desligar… ]
──────────────────────────────────────────────
Comportamento      Recolher depois de [1] s
                   [ ] Esconder depois de [10] min sem nada acontecer
                   [x] Sair da frente em tela cheia
                   [ ] Modo foco: só pedidos e perguntas
                   [ ] Reduzir movimento sempre
──────────────────────────────────────────────
Privacidade        [ ] Modo apresentação (liga sozinho ao apresentar)
                   [ ] Esconder a ilha de gravações e compartilhamento de tela
──────────────────────────────────────────────
Som                [x] Pedidos e perguntas  [ ] Pronto  [ ] Erro  [ ] Ronronar
                   Volume [====|----] 50%
──────────────────────────────────────────────
Atalhos            [ ] Responder pedidos pelo teclado
                       Permitir: Ctrl+Shift+…   Negar: Ctrl+Shift+…
──────────────────────────────────────────────
Uso do plano       [ ] Mostrar o uso (liga a status line do Xereta)
                       5 h: 42% · semana: 18%
──────────────────────────────────────────────
Sistema            [ ] Abrir junto com o Windows
──────────────────────────────────────────────
Sobre              Xereta 0.x · token: trocar…
```

"Trocar token" faz o que o risco da 001 já previa (`--novo-token`): gera um token novo e religa os
hooks, com prévia.

---

## 5. Etapas e critérios de aceite

### F1 — A janela e o ligar
- Bandeja → **Configurações…** abre a janela. Abrir de novo só a traz para a frente, sem criar
  outra.
- O estado dos hooks está certo nos três casos: desligado, ligado e "ligado, mas com outro token"
  (por exemplo, depois de uma troca de token pelo terminal).
- **Ligar** mostra a prévia, faz backup e recusa se o arquivo mudou, com **os mesmos testes** da
  E3. Os 4 hooks do vault continuam idênticos.
- Depois de ligar aparece o aviso da D3. Desligar devolve o JSON igual ao de antes.

### F2 — Tela cheia, foco e esconder
- Um vídeo do YouTube em tela cheia, um jogo em tela cheia e o PowerPoint em apresentação: a ilha
  some nos três e volta ao sair.
- Um pedido durante um vídeo em tela cheia: aparece a pílula âmbar, e ela responde.
- Modo foco: uma sessão inteira passa sem a ilha abrir. Um pedido abre normal.
- "Esconder depois de N min": some no tempo certo e volta no próximo evento.

### F3 — Sistema
- "Abrir junto com o Windows" ligado: depois de reiniciar o PC, a ilha aparece sem nada aberto à
  mão. Desligado, não aparece.
- As preferências sobrevivem a fechar e abrir o app.
- **Memória:** a janela de configurações fechada não muda a média parada (meta da 001).

### F4 — Som e atalhos
- Os três sons tocam nos momentos certos, respeitam o volume e o liga/desliga por tipo. O som de
  pedido toca também em modo foco e em tela cheia.
- Atalhos ligados: com um pedido na tela, a combinação responde; **sem pedido, a mesma combinação
  chega ao app da frente** (conferido no Chrome, no VS Code e no terminal). Num teclado ABNT2, o
  AltGr continua escrevendo `/`, `?` e `°` com a ilha aberta.
- Um pedido de risco alto (003) ignora o atalho.
- Uma combinação que outro programa já usa: a janela avisa, e o atalho fica desligado.

- O "Som" da bandeja silencia e devolve todos os sons com um clique.

### F4b — Modo apresentação (ideia de 05/10)
- Ligado pela bandeja: um pedido de `Edit` em `C:\Users\…\korus\.env` mostra só `.env`, um Bash
  mostra só o programa, e a mensagem final e o diff aparecem como "oculto no modo apresentação".
  Permitir e Negar continuam funcionando.
- Um texto com `sk-…`, `ghp_…` ou um hexadecimal de 64 caracteres aparece como `•••` (com um teste
  por padrão de token).
- O PowerPoint em apresentação liga o modo sozinho, e ele desliga ao sair.
- "Esconder de gravações" ligado: a ilha não aparece numa gravação do OBS nem num compartilhamento
  do Teams ou do Meet, e continua na sua tela, clicável.

### F5 — Uso do plano
- Ligar mostra a prévia do `settings.json` (`statusLine` novo), com backup e a mesma recusa da D14
  da 001. Desligar devolve o JSON igual ao de antes.
- Numa sessão real, a pílula mostra os percentuais certos (conferidos com o `/usage` do Claude
  Code), e o terminal mostra a linha da D12.
- Com o Xereta fechado, a status line continua imprimindo a linha, sem atraso perceptível (o
  repasse à ponte tem prazo curto e falha calado).
- O gato fica cansado acima de 80% (simulado com `curl`).

---

## 6. Verificações pendentes

| # | Pergunta | Por que importa |
|---|---|---|
| V1 | O `SHQueryUserNotificationState` reconhece vídeo em tela cheia no navegador (que não é D3D exclusivo) como "ocupado"? | Se não reconhecer, a D5 precisa de um segundo critério: a janela da frente cobrir o monitor inteiro |
| V2 | O plugin `fs` do Tauri aceita escopo de um arquivo só, fora das pastas do app? | D2. Se não aceitar, a escrita vira um comando Rust pequeno, também com caminho fixo |
| V3 | Que combinação **não** colide com o Windows, o Chrome, o VS Code, a Xbox Game Bar e o ABNT2? | D10. Testar candidatas com `Win+Shift` e `Ctrl+Shift` antes de escolher a padrão |
| V4 | O JSON da status line traz `rate_limits` no seu plano e no Windows (`five_hour` e `seven_day`, com `used_percentage` e `resets_at`, como lê o Coucou)? | D12. Sem isso, a F5 não tem dado |
| V6 | O `WDA_EXCLUDEFROMCAPTURE` funciona com a janela transparente e recortada (`SetWindowRgn`) do Xereta? | D15. Exige Windows 10 2004 ou mais novo |
| V5 | Com que frequência o Claude Code chama a status line? | O custo de abrir um processo a cada chamada (D12) |

---

## 7. Riscos

| Risco | Plano |
|---|---|
| A tela cheia esconder um pedido | A D5 abre exceção para pedidos, e um teste da F2 cobre isso |
| Dois lugares (terminal e janela) instalarem os hooks de um jeito diferente | Um módulo só (D2), com os mesmos testes rodando no Node |
| A consulta a cada 2 s gastar CPU | É uma chamada barata do Windows. Medir a CPU parada antes e depois, como na E1 |
| A status line do Xereta ser "um script no meio" (D3 da 001) | É opcional e vem desligada. Os hooks continuam `http` direto; só a status line, que por natureza é um comando, passa pelo Xereta |
| Um atalho registrado escapar depois do pedido | O registro é solto em todo caminho de fim de pedido (resposta, tempo esgotado, recarga da página), e um teste confere cada um |
