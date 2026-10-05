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

**Para onde foi cada ideia (05/10, specs em rascunho):**

| Ideia | Spec |
|---|---|
| 1. Várias fontes · 6. Central de avisos | 006 |
| 2. Diff antes de aprovar · 3. Nível de risco · 4. "Sempre permitir" com regra visível | 003 |
| 12. Modo foco | 005 |
| 11. Mascote que reflete a sessão | 002 (estados novos, cansado quando o limite acaba) e F5 da 005 (cansado perto do limite) |
| 5. Resumo e vault · 7. Voz · 8. Gesto · 9. Celular | Ainda sem spec |
| 10. Windows e português | Já é a 001 (D16) e o jeito de todas |

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

---

## Integrado ao seu jeito de trabalhar

### 5. Resumo da sessão e "registrar no vault" 🟡
No `Stop`, a ilha mostra quantos arquivos mudaram, se os testes passaram e quanto tempo
levou, com um botão que manda isso para o diário do Obsidian.

### 6. Central de avisos das suas automações 🟢
Uma rota genérica (`/fontes/script`) para qualquer script seu avisar a ilha: o Faxineiro
dizendo "movi 3 arquivos", o Agente de Notícias dizendo "briefing pronto".

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

## Identidade

### 10. Feito para Windows e em português 🟢
O Coucou é Linux e Mac, em francês e inglês. Windows primeiro e PT-BR é um nicho real.

### 11. Mascote que reflete a sessão 🟡
Cansado quando o contexto está quase cheio, preocupado perto do limite de uso.

### 12. Modo foco 🟢
Silencia tudo menos pedidos de permissão.

---

## Anotações das conversas
- 02/10 — Nome provisório *Xereta*, e várias fontes pedidas desde o começo (item 1).
