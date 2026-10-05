# Xereta

Um gato frajola que mora numa ilha no topo da tela, mostra ao vivo o que o Claude Code está
fazendo e deixa **aprovar ou negar pedidos de permissão sem voltar ao terminal**.

Você pede *"roda os testes e faz o push"*, vai para o navegador, e a pílula no alto da tela vai
contando: "Rodando npm test"… até ficar amarela com `git push origin main`. Você clica em
**Permitir** sem sair de onde está, e o gato comemora quando termina.

> **Em desenvolvimento.** O MVP está na metade: a ilha, o gato e a ponte com o Claude Code já
> rodam e estão testados; falta ligar os hooks numa sessão real (E3) e responder os pedidos pela
> ilha (E4). Por enquanto é só para Windows. *Xereta* é um nome provisório.

Feito no Brasil, em português desde a primeira linha. Inspirado no app
[Coucou](https://github.com/Louis-CFM/coucou), com código, nome, personagem e escolhas próprias.

---

## A promessa que não pode quebrar

O Xereta fechado, travado ou com defeito **nunca** atrapalha o Claude Code. Sem resposta da
ilha, tudo volta a ser como é hoje, com o pedido no terminal.

- **Nunca permite por tempo esgotado, nunca nega em silêncio.** Sem clique em 45 s, o pedido
  volta para o terminal.
- **Se o app está fechado,** a conexão é recusada na hora, e o Claude Code segue normal.
- **Status nunca atrasa o Claude Code:** a ponte responde em 2–5 ms.

---

## Como funciona

```
Claude Code ── hook http ──▶  ponte em Rust (127.0.0.1:47321, com token)
                               │  evento → responde na hora
                               │  pedido → segura a conexão até o clique (ou 45 s)
                               ▼
                         ilha em JS ── adaptador da fonte ── estado ── gato
                               │
                               └─ Permitir / Negar / No terminal ─▶ resposta do hook
```

- **Hooks `http` direto para o app,** sem script no meio: nenhum processo extra a cada evento.
- **O Rust é fino:** recebe o HTTP, confere o token e o tamanho, repassa à página e devolve a
  decisão. Ele não sabe o que é o Claude Code. Tudo o que é regra fica em JS.
- **Cada fonte é um adaptador** que traduz o que ela manda para um formato comum de evento.
  Hoje existe o do Claude Code (`src/adaptadores/claude-code.js`); Codex, Gemini e os seus
  próprios scripts entram como arquivos novos (spec 006).
- **A janela é recortada na forma da ilha,** então o clique fora dela cai no app de trás, e
  **ela nunca rouba o foco** de quem está digitando.

---

## O que já funciona

| Etapa | O quê | Medido |
|---|---|---|
| **E0** ✅ | Ambiente e instalador | Instalador NSIS de **1,33 MiB** |
| **E1** ✅ | A ilha (pílula ↔ expandida) e o gato em Canvas 2D com molas, 6 estados e 8 caras com gestos | **82 MB** de média parada (5 min); sem roubar foco nem clique |
| **E2** ✅ | A ponte HTTP em Rust, que lê o HTTP ela mesma | Status em **2–5 ms**; **22 testes**; revisada pelo Codex |
| **E3** | Instalador dos hooks e a primeira sessão real | Próxima |
| **E4** | Permitir, Negar e No terminal pela ilha | — |

Até a E4, um pedido aberto se responde pelo ícone na bandeja (*Pedido aberto (teste)*).

---

## Rodar em desenvolvimento

**Precisa de:** Windows 10 ou 11, com:
- [Rust](https://rustup.rs) estável (testado com 1.99, `stable-x86_64-pc-windows-msvc`);
- as **Build Tools do Visual Studio 2022** com "Desenvolvimento para desktop com C++" (só o
  compilador e o linker, sem a IDE);
- [Node.js](https://nodejs.org) 20 ou mais novo (testado com 24);
- o WebView2, que já vem no Windows 11.

```powershell
git clone <este repositório>
cd Xereta
npm install
npm run tauri dev      # abre a ilha; a primeira compilação leva uns 5 minutos
```

**Instalador:** `npm run tauri build` gera o NSIS e o MSI em
`src-tauri\target\release\bundle\`. Ele instala por usuário, sem pedir administrador.

**Testes da ponte:**

```powershell
cd src-tauri
cargo test
```

### Configuração

Na primeira vez, o app cria `%APPDATA%\app.xereta.ilha\config.json`:

```json
{ "porta": 47321, "token": "<64 caracteres hexadecimais>", "esperaPedidoSegundos": 45 }
```

O token tem 32 bytes do gerador do sistema. **Não mostre esse arquivo nem o seu
`settings.json` em prints:** com o token, outro programa da sua máquina conseguiria responder
pedidos no seu lugar. Uma porta ocupada aparece como erro na própria ilha, e o Xereta **não**
troca de porta sozinho, porque os hooks apontam para uma porta fixa.

### Testar a ponte sem o Claude Code

Com o app aberto (`npm run tauri dev`), mande um evento como se fosse um hook:

```powershell
$cfg = Get-Content "$env:APPDATA\app.xereta.ilha\config.json" | ConvertFrom-Json
$corpo = @{ hook_event_name = 'PreToolUse'; session_id = 'teste'; cwd = 'C:\projetos\korus'
            tool_name = 'Bash'; tool_input = @{ command = 'npm test' } } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$($cfg.porta)/fontes/claude-code/evento" `
  -Headers @{ Authorization = "Bearer $($cfg.token)" } -ContentType 'application/json' -Body $corpo
```

A ilha mostra "korus · Claude Code · Rodando npm test". Trocando `evento` por `pedido` e o
`hook_event_name` por `PermissionRequest`, a chamada fica esperando até você responder pela
bandeja.

| Rota | Resposta |
|---|---|
| `POST /fontes/<fonte>/evento` | `200` vazio na hora |
| `POST /fontes/<fonte>/pedido` | Aberta até a decisão; sem decisão em 45 s, `200` vazio |
| Sem token ou token errado | `401` |
| Corpo > 10 MB · sem `Content-Length` · outra rota · outro método | `413` · `411` · `404` · `405` |

---

## Segurança e privacidade

- Escuta **só em `127.0.0.1`**, e toda requisição precisa do token (conferido em tempo constante,
  antes de ler o corpo).
- **Nenhum caminho de erro ou de tempo esgotado devolve `allow`.** Há teste para isso.
- **O que as ferramentas recebem (`tool_input`) não vai para disco:** um `.env` editado ou um
  comando com token ficam só na memória da página. Hoje o Xereta não grava log nenhum; quando
  gravar, será só a hora, a fonte e o tipo do evento.
- Limites contra abuso: corpo de até 10 MB, cabeçalho de até 16 KB, requisição inteira em até
  10 s, até 64 conexões e 32 pedidos abertos.
- A interface roda com CSP restritiva e só com as permissões do Tauri que o código usa.

---

## Estrutura

```
src/                      a interface (JavaScript puro, sem framework)
  index.html, ilha.css, ilha.js    a ilha, a bandeja e o recorte da janela
  ponte.js                         recebe os avisos da ponte e guarda a fila de pedidos
  adaptadores/claude-code.js       hooks do Claude Code → formato comum (e a resposta)
  mascote/gato.js                  o gato: Canvas 2D, molas e volume em camadas
  textos/pt-BR.js                  todos os textos do app, num arquivo só
src-tauri/                o núcleo em Rust
  src/ponte.rs                     a ponte HTTP
  src/config.rs                    o config.json (token, porta, espera)
  src/lib.rs                       janela, recorte (SetWindowRgn) e instância única
design/mascote.html       protótipo do gato, com todos os estados lado a lado
specs/                    o que construir, etapa por etapa, com critérios de aceite
ideias/                   documentos vivos (diferenciais, mascote, concorrente)
```

---

## Para onde vai

| Spec | O que é | Estado |
|---|---|---|
| [001 — MVP](specs/001-mvp.md) | A ilha, o gato, o status ao vivo e a permissão pela ilha | **Aprovada**; E3 e E4 em aberto |
| [002 — A ilha conta a sessão](specs/002-sessao-na-ilha.md) | Passos, `+N −M`, a mensagem final, a linha do tempo, várias sessões, selo e a personalidade do gato (cochilo, caneca, ronronar, patadinha) | Rascunho |
| [003 — Decidir com confiança](specs/003-decidir-com-confianca.md) | **O diff no próprio pedido**, o nível de risco do comando e "sempre permitir" com a regra à vista | Rascunho |
| [004 — Responder ao Claude](specs/004-responder-ao-claude.md) | As perguntas de múltipla escolha respondidas pela ilha | Rascunho |
| [005 — Configurações e conforto](specs/005-configuracoes-e-conforto.md) | Janela de configurações, tela cheia, modo foco, modo apresentação, som, atalhos e uso do plano | Rascunho |
| [006 — Várias fontes](specs/006-varias-fontes.md) | O comando `xereta "Build OK"` para os seus scripts, Codex, Gemini CLI e Ollama | Rascunho |

| Documento vivo | O que é |
|---|---|
| [`ideias/diferenciais.md`](ideias/diferenciais.md) | O que pode fazer o Xereta valer mais que "um Coucou para Windows", e para qual spec foi cada ideia |
| [`ideias/mascote.md`](ideias/mascote.md) | O gato: a ideia, o protótipo e o mapa de estados |
| [`ideias/coucou-instagram.md`](ideias/coucou-instagram.md) | O que o criador do Coucou mostrou (05/10) e o que pegar dali |

---

## Stack

**[Tauri 2](https://tauri.app)** com **JavaScript puro** na interface e um núcleo fino em
**Rust**. É leve para um app que fica aberto o dia todo, tem permissões explícitas e não precisa
de framework para uma interface deste tamanho. O Rust cuida só do que o JS não alcança: a ponte
HTTP, o recorte da janela e a instância única.

---

## Licença

- **Código:** [MIT](LICENSE). Use, estude, modifique e redistribua.
- **Nome, gato, ícone e sons:** reservados ([`LICENSE-ASSETS.md`](LICENSE-ASSETS.md)). Um fork
  pode ser publicado, desde que com nome e personagem próprios.

O Xereta nasceu de um reel do [Coucou](https://github.com/Louis-CFM/coucou), de Louis Raillé. O
repositório dele foi material de estudo, e nenhum código foi copiado. O Mochi e o nome Coucou são
dele.
