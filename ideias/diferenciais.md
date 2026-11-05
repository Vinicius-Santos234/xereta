# Diferenciais do Xereta — documento vivo

O que pode fazer o Xereta valer mais que "um Coucou para Windows". Aqui nada está decidido:
uma ideia que for escolhida vira spec própria (002, 003...).

**Antes de escolher:** pesquisar quem mais já faz isso (ilhas, notificadores e painéis para o
Claude Code). Diferencial só é diferencial se os outros não fazem.

Legenda de custo: 🟢 pequeno · 🟡 médio · 🔴 grande

---

## O concorrente: o próprio Coucou (lido em 02/10)

github.com/louis-cfm/coucou. Criado em 27/09/2026; em 02/10 tinha **2,9 mil estrelas, 439
forks** e dezenas de PRs abertos. É muito ativo.

- **Já roda no Windows e no Linux, com Tauri 2** (Rust + TypeScript sem framework). No Mac é
  Swift nativo.
- **Já acompanha vários agentes:** Claude Code, Codex, Cursor, Gemini CLI e Antigravity. Aprovação
  pela ilha existe para Claude Code e Codex, e só o Claude Code tem o botão "Always". Qualquer
  ferramenta ganha a própria pílula com o campo `coucou_agent`.
- **Licença:** o **código é MIT**. **Nome, o mascote Mochi, ícone, sons e mídia são reservados**
  (`LICENSE-ASSETS.md`). Um fork pode ser publicado, desde que com nome, personagem e sons
  próprios.
- **Em PR aberto, ainda não na `main`:** PT-BR (#80), Ollama (#74), tema claro/escuro (#146),
  responder `AskUserQuestion` (#132), Y/N (#106), Spotify.
- **Pedido em issue:** i18n, atalho global e estatísticas de sessão (#119); voz (#116); sessões
  em outra máquina da rede (#118); várias sessões ao mesmo tempo (#18).

**Como ele resolve o que a nossa spec decide:**

| Ponto | Coucou | Spec 001 do Xereta |
|---|---|---|
| Transporte | Hook `command` → relé `coucou-hook.exe` → *named pipe* `\\.\pipe\coucou-<SID>`, restrito ao usuário pelo próprio Windows | Hook `http` direto, sem relé, com token |
| Prazo para achar o app | 300 ms para conectar; status com até 2 s | Conexão recusada volta na hora; status com 2 s |
| Espera da permissão | 110 s (hook com 120 s) | 45 s (hook com 60 s) |
| "Always" | Responde `allow` simples; quem lembra é a ilha | Fora do MVP |
| Instalar hooks | Mostra o **diff** do `settings.json`, faz backup com data e só grava depois do clique. **Recusa gravar se o arquivo mudou desde a prévia** | Mescla + backup (D14), **sem prévia** |
| Log | Não guarda comandos | Não guarda `tool_input` (D9) |
| Instalador | **O Defender acusou o `.exe` sem assinatura como trojan** (falso positivo, issue #103). O download está suspenso | Assinatura fora do MVP |

## O que isso faz com as ideias abaixo
- ❌ **Deixaram de ser diferencial:** 1 (várias fontes, porque ele já tem), 10 (Windows, porque ele já tem;
  e PT-BR está num PR).
- ⚠️ **Ele já pediu ou está fazendo:** 7 (voz, #116), 11 e 12 (estatísticas, #119).
- ✅ **Não encontrei nada parecido no código, nas issues nem nos PRs:** 2 (**diff antes de
  aprovar**; ele mostra só `Write · caminho`), 3 (**nível de risco**), 5 (**vault**), 6
  (central das *suas* automações, só em parte: o `coucou_agent` já aceita qualquer ferramenta),
  8 (gesto) e 9 (celular, com algo próximo em #118).

**Revisto em 05/10, depois do Instagram do criador** (detalhes em `ideias/coucou-instagram.md`):
- **2 ficou mais estreito:** ele já mostra o diff de cada edição ao vivo, mas o pedido de
  permissão mostra só o comando. O diferencial é o diff **no pedido**, antes do Permitir.
- **5 ficou mais estreito:** ele tem "resume o meu dia" no chat, com chave de API. O nosso sai dos
  eventos, sem chave, e vai para o Obsidian.
- **9 ganhou concorrente:** um app de iOS com widgets de status foi anunciado em 05/10.
- **10 voltou a valer:** no Windows ele não tem instalador nem vários recursos do Mac.
- **11 e 12 estão em parte nele:** o estado `ratelimit`, a pílula de uso do plano, Pausar e Mudo.
- **3 e 4 seguem sem nada parecido.**

**Revisto em 05/11, relendo o repositório** (commit `7436363`, de 03/11; 6.982 estrelas e 1.149 forks):
- **2, 3 e 4 continuam:** no Windows, o pedido dele mostra só o comando ou o caminho
  (`windows/src/views/views.ts`), sem diff e sem risco. O "Always" saiu de lá até existir uma lista
  de regras.
- **7 e 9 deixaram de ser diferencial:** ele já fala (« OK Coucou ») e aprova pelo iPhone e pelo
  Android.
- **10 perdeu força de novo:** agora há instalador no Windows, ainda sem assinatura, atualização em
  um clique e português entre 16 idiomas.
- **15 ficou mais estreito:** um PR aberto (#580) detecta chamada e esconde a ilha. O nosso continua
  na tela e respondível, sem mostrar o que é sensível.
- **Ele cresceu para outro lado:** ditado, gravação de reuniões, e-mail, WhatsApp, chat pelo plano e
  carteira de cripto. Não dá para ganhar em número de funções.

**Para onde foi cada ideia (05/10, specs em rascunho):**

| Ideia | Spec |
|---|---|
| 1. Várias fontes · 6. Central de avisos · 14. O comando `xereta` | 006 |
| 13. Linha do tempo da sessão | 002 (D11) |
| 2. Diff antes de aprovar · 3. Nível de risco · 4. "Sempre permitir" com regra visível · 17. Selo `+N −M` no pedido | 003 |
| 12. Modo foco · 15. Modo apresentação · 16. Sons discretos | 005 |
| 11. Mascote que reflete a sessão | 002 (estados novos, cansado quando o limite acaba) e F5 da 005 (cansado perto do limite) |
| 5. Resumo e vault · 7. Voz · 8. Gesto · 9. Celular | Ainda sem spec |
| 10. Windows e português | Já é a 001 (D16) e o jeito de todas |
| 18 a 27. De olho no que acontece | Ainda sem spec, à espera da sua escolha |

---

## Já pedido por você

### 1. Várias fontes, não só o Claude Code 🟡
Codex, Gemini CLI, Ollama, e o que vier. A arquitetura do MVP já prepara isso (D10 da spec 001).
- **Codex e Gemini CLI** são agentes como o Claude Code. Falta conferir que ganchos cada um
  oferece: hooks, notificações ou só o log.
- **Ollama é de outra natureza:** é um servidor de modelos, não um agente que pede permissão.
  O que dá para mostrar é o estado dele ("modelo carregado", "gerando"), consultando a API
  local (`/api/ps`) em vez de receber hook.
- **O que diferencia:** uma ilha só para todos os agentes, com a fonte visível em cada pedido.

---

## Segurança e confiança (o coração do app)

### 2. Ver o diff antes de aprovar 🟡
O Coucou mostra só o comando. Para Edit e Write, a ilha mostraria **o que muda no arquivo**
antes do Permitir. Depende da V3.

### 3. Nível de risco do pedido 🟢
`git push --force`, `rm -rf`, `DROP TABLE`, `curl … | sh` e mexer em `.env` aparecem em
**vermelho**, com o motivo. Um `npm test` aparece neutro. São regras em JS, fáceis de
estender.

### 4. "Sempre permitir isto" com regra visível 🟡
Aprovar uma vez e virar regra, sem esconder nada: a lista de regras fica visível e editável,
como a tela de regras do Dashboard Financeiro.

### 15. Modo apresentação 🟢
*(05/10)* Em reunião ou tela compartilhada, a ilha esconde caminhos, comandos e o que parece
token, e continua respondível. Liga pela bandeja, e sozinho quando o Windows está apresentando.
Opção a mais: tirar a ilha das gravações de tela (`WDA_EXCLUDEFROMCAPTURE`). → **005** (D14, D15)

### 17. Selo `+N −M` no pedido 🟢
*(05/10)* O resumo do diff ao lado do nome do arquivo em todo pedido de Edit e Write, inclusive na
pílula âmbar. É o diff do item 2 lido de relance. → **003**

---

## Integrado ao seu jeito de trabalhar

### 5. Resumo da sessão e "registrar no vault" 🟡
No `Stop`, a ilha mostra quantos arquivos mudaram, se os testes passaram e quanto tempo
levou, com um botão que manda isso para o diário do Obsidian.

### 6. Central de avisos das suas automações 🟢
Uma rota genérica (`/fontes/script`) para qualquer script seu avisar a ilha: o Faxineiro
dizendo "movi 3 arquivos", o Agente de Notícias dizendo "briefing pronto".

### 13. Linha do tempo da sessão 🟢
*(05/10)* Clicar no cartão mostra os últimos passos com a hora (`14:30 ✓ npm test · 14:31 ✎
auth.ts · 14:32 ✓ Prontinho!`): o que o agente fez enquanto você estava longe. → **002** (D11)

### 14. O comando `xereta` 🟡
*(05/10)* `npm run build && xereta "Build OK" --tipo sucesso`: qualquer tarefa do dia a dia avisa
na ilha, sem escrever código. Nunca quebra o `&&`, mesmo com o Xereta fechado. É o mesmo binário
do relé de agentes e da status line. → **006** (D2)

### 7. Voz em português 🟢
"Terminei" e "preciso de você" falados com edge-tts, que você já usou na EV. Útil quando
você está longe da tela.

### 8. Aprovar por gesto 🔴
Joinha na webcam para aprovar, com MediaPipe, a mesma base dos projetos de gesto.
Ótimo para demo e portfólio. **Cuidado:** gesto aprovando `git push` é arriscado. Se entrar,
deve valer só para pedidos de risco baixo (item 3).

### 9. Aprovar pelo celular 🔴
Notificação no celular quando você está longe do PC, com Permitir e Negar. Exige pensar
autenticação com muito cuidado: é aprovar comandos de fora da máquina.

---

## De olho no que acontece

*(05/11)* **Nada aqui foi escolhido.** O rumo que veio junto também é proposta: o Coucou virou o
centro de tudo o que você usa, e o Xereta fica de olho no que acontece no seu PC e só te chama
quando precisa. A regra de escopo seria: **só entra o que dá para saber pela própria máquina, sem
chave, conta ou internet.**

Não achei nenhuma destas no Coucou (README, notas de versão, issues, PRs e código de 03/11), salvo
onde está indicado. Foi busca por palavras, então isso não prova que não exista. O custo é
estimativa.

**Do agente**

### 18. Comando parado 🟢
"`npm run dev` rodando há 12 min": um `PreToolUse` sem o `PostToolUse` depois de alguns minutos. A
ilha só dá o fato, porque um teste longo também é normal.

### 19. Agente em círculo 🟢
"`npm test` falhou 5 vezes seguidas", para você interromper antes de gastar o plano. O mais próximo
no Coucou é um PR aberto (#969), que faz o Mochi reagir a testes.

### 20. Mesmo arquivo em duas sessões 🟢
"Duas sessões editaram `frete.ts`." As edições de cada sessão já chegam pelo `PostToolUse`.

### 21. O que passou sem pedir 🟡
Edição fora da pasta do projeto ou em `.env`, mesmo com a ferramenta já liberada. Só avisa, não
bloqueia. É o item 3 para o que nunca vira pedido.

### 22. Trabalho sem commit 🟡
"3 arquivos sem commit" no cartão do fim, com um `git status` na pasta da sessão.

**Do PC de quem programa**

### 23. Servidores locais 🟡
"vitrine :5173 · api :3000 caiu", e quem está segurando uma porta ocupada. Docker pode vir depois.
Se a ilha ganhar módulos, é candidata a segundo módulo: força a decisão de quem fica com o espaço, e
música não nos diferencia (o Coucou já tem Spotify e um PR aberto, #1026, para qualquer player).

### 24. Comando longo terminou 🟡
"`cargo build` falhou depois de 2m14", sem digitar `&& xereta` (item 14). Mexe no perfil do
terminal, então segue a D14.

**Fora da programação**

### 25. Câmera e microfone 🟡
"Microfone ligado: Teams": um gato xereta avisando quem está xeretando você. Falta conferir se o
Windows informa isso de forma confiável. O PR aberto #580 do Coucou detecta chamada, mas para
esconder a ilha.

### 26. Download terminou 🟢
"`relatorio.pdf` pronto", com um clique para abrir.

### 27. PC em apuros 🟡
"`node.exe` com 98% de CPU há 5 min", disco quase cheio ou internet caída. No Mac, o Mochi já reage
a CPU, memória e bateria; no Windows não achei.

**Ordem sugerida:** a 003 (2, 3, 4 e 17) → 18, 19 e 20 → 24 e 26 → 23.

---

## Identidade

### 10. Feito para Windows e em português 🟢
O Coucou é Linux e Mac, em francês e inglês. Windows primeiro e PT-BR é um nicho real.

### 11. Mascote que reflete a sessão 🟡
Cansado quando o contexto está quase cheio, preocupado perto do limite de uso.

### 12. Modo foco 🟢
Silencia tudo menos pedidos de permissão.

### 16. Sons discretos 🟢
*(05/10)* Um miadinho suave para pedido, um "plim" para pronto, um tom grave para erro, e o
ronronar do carinho. Feitos em código, opcionais, e um clique na bandeja silencia tudo. → **005** (D11)

### A personalidade do gato
*(05/10)* Cochilo com susto ao acordar, olhar desconfiado no risco alto, caneca de café nas
maratonas, patadinha no cursor e ronronar no carinho. Detalhes, esforço e o que já dá para
prototipar estão em `ideias/mascote.md`. → **002** e **003**

---

## Anotações das conversas
- 02/10 — Nome provisório *Xereta*, e várias fontes pedidas desde o começo (item 1).
- 05/10 — Ideias trazidas por você: linha do tempo (13), comando `xereta` (14), modo
  apresentação (15), sons (16), selo `+N −M` (17) e a personalidade do gato (em `ideias/mascote.md`).
- 05/11 — Você propôs uma ilha geral, com o Xereta como a parte de dev. Depois da conversa, o escopo
  principal ficou no dev, diferente do Coucou e útil também fora da programação. A regra de escopo
  e as ideias 18 a 27 são sugestões minhas, à espera da sua escolha.
