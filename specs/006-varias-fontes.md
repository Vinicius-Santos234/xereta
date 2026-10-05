# Spec 006 — Várias fontes

**Status:** rascunho (05/10), aguardando a sua aprovação. Pode começar logo depois da 001.
**Origem:** o pedido de 02/10 de ter várias fontes desde o começo (D10 da 001), o comando `xereta` (diferencial 14, de 05/10) e os diferenciais
1 (várias fontes) e 6 (central de avisos das suas automações).
**Depende de:** o formato comum de evento e os adaptadores da 001, que já existem.

---

## 1. Objetivo

A arquitetura da 001 nasceu pronta para outras fontes: a ponte não sabe de onde vem o evento, e
cada fonte é um adaptador em JS. A 006 usa isso. Primeiro para **os seus próprios scripts**, que é
o que nenhum concorrente faz por você; depois para Codex, Gemini CLI e Ollama.

**Uma frase de sucesso:** de manhã, o Faxineiro avisa na ilha "movi 3 arquivos para Documentos" e
o Agente de Notícias diz "briefing pronto". À tarde, uma sessão do Codex pede permissão e aparece
na mesma ilha, marcada como Codex.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Integrações de serviço (Stripe, GitHub, n8n, Vercel) | Continuam fora (§2 da 001). Um script seu que consulta o serviço e avisa pela rota de scripts cobre o caso, sem chave nenhuma dentro do Xereta. Se um dia uma fonte precisar de chave, ela vai para o **Gerenciador de Credenciais do Windows**, nunca para disco (regra da §2 da 001, P14) |
| Um mascote por fonte | O gato é um só. A fonte aparece no texto e na cor, não num bicho novo (D12 da 001) |
| Chat com modelos (Ollama, OpenAI) | É outro produto. Do Ollama, só o estado |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | Rota dos scripts | `POST /fontes/script/evento`, com o mesmo token, e um corpo simples: `{"origem":"faxineiro","titulo":"Movi 3 arquivos","texto":"para Documentos","tipo":"info"}`. O `tipo` pode ser `info`, `sucesso`, `atencao` ou `erro` | É a ponte da E2 sem mudar nada no Rust. Só entra o adaptador `adaptadores/script.js` |
| D2 | Como um script avisa (revisto em 05/10) | **Um comando `xereta`** no PATH do usuário: `npm run build && xereta "Build OK" --tipo sucesso`, com `--texto` e `--origem` opcionais (a origem padrão é o nome da pasta). Ele lê o token do `config.json`, manda o aviso com prazo de 2 s e **sempre sai com código 0**: com o Xereta fechado, falha calado e não quebra o `&&` de ninguém. Para quem não quer depender dele, `docs/avisar.md` mantém os trechos de 10 linhas em Python e PowerShell | Torna a ilha útil para qualquer tarefa do dia a dia, sem escrever código. É **o mesmo binário pequeno** do relé (D6) e da status line (D12 da 005), com subcomandos: `xereta "…"` (avisar), `xereta gancho` e `xereta status`. Um binário, três usos |
| D3 | Aviso não é pedido | A rota de scripts **só** aceita `evento`. Um script não pede permissão pela ilha | Pedir permissão é coisa de agente. Abrir essa porta para qualquer script é risco sem uso conhecido |
| D4 | Codex | Os hooks em `~/.codex/hooks.json`: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, Stop e SessionEnd. Permitir e Negar sim; **"Sempre", não** (o Codex recusa `updatedPermissions`) | É o que o Coucou instala (lido no código em 05/10). O Codex pede uma confirmação dos hooks uma vez, com `/hooks` |
| D5 | Gemini CLI | Os hooks em `~/.gemini/settings.json`: BeforeTool, AfterTool, BeforeAgent, AfterAgent, SessionStart e SessionEnd. **Só estado, sem permissão** | É o que o Coucou instala. O Gemini espera `{}` como resposta |
| D6 | Se o agente não tiver hook `http` | Um **relé pequeno em Rust** (o subcomando `xereta gancho` do binário da D2, no mesmo projeto), chamado como hook `command`, que repassa à ponte e devolve a resposta. **Só para as fontes que precisarem** | Quebra o "sem script no meio" da D3 da 001, mas só onde o agente não deixa outro caminho. O Claude Code continua no `http` direto. Decisão sua (V1) |
| D7 | Ollama | Consultar `http://127.0.0.1:11434/api/ps` a cada 5 s, **só se** a fonte estiver ligada. Mostra "modelo carregado" e "gerando" | O Ollama não manda hook: é um servidor de modelos, não um agente (item 1 de `ideias/diferenciais.md`) |
| D8 | Instalar | Cada fonte tem o próprio liga/desliga na janela da 005, com prévia, backup e recusa se o arquivo mudou (D14 da 001), arquivo por arquivo | O cuidado com o `settings.json` do Claude Code vale para o arquivo de qualquer agente |
| D9 | Identidade da fonte | Cada fonte tem nome e cor no cartão ("Codex" em verde, "Faxineiro" em cinza). O gato reage igual para todas | A pergunta "de quem é isto?" precisa de resposta antes do Permitir |

---

## 4. Etapas e critérios de aceite

### F1 — Os seus scripts
- `curl` com um aviso de cada `tipo`: a ilha mostra a origem, o título e o texto, com a cor do
  nível; o gato reage (ok = feliz, erro = erro pequeno).
- Um aviso sem token dá `401`, e um `tipo` desconhecido vira `info`.
- Pedido em `/fontes/script/pedido`: volta vazio na hora, como uma fonte que não sabe pedir.
- `xereta "Build OK" --tipo sucesso` mostra o aviso na ilha; com o Xereta fechado, o comando sai
  com código 0 em até 2 s, e `npm run build && xereta …` não quebra.
- O instalador põe o `xereta` no PATH do usuário (sem administrador), e desinstalar o tira.
- O Faxineiro e o Agente de Notícias avisam de verdade, pelo comando ou pelo trecho de `docs/avisar.md`.
  Com o Xereta fechado, eles continuam funcionando normalmente (o aviso falha calado).

### F2 — Codex
- Uma sessão real do Codex aparece como "Codex", com projeto e passos.
- Um pedido do Codex: Permitir e Negar funcionam, e o botão "Sempre" não aparece.
- Codex e Claude Code pedindo ao mesmo tempo: a fila é uma só, e cada resposta vai ao pedido certo.

### F3 — Gemini CLI
- Uma sessão real do Gemini aparece com o estado certo do começo ao fim.
- Com o Xereta fechado, o Gemini não fica mais lento (o mesmo critério de 50 ms da E3 da 001).

### F4 — Ollama
- Com o Ollama ligado e um modelo gerando, a ilha mostra "gerando · llama3". Com ele desligado,
  nada aparece e não há erro no log a cada 5 s.

---

## 5. Verificações pendentes

| # | Pergunta | Por que importa |
|---|---|---|
| V1 | O Codex e o Gemini CLI aceitam hook do tipo `http`, ou só `command`? | Decide se precisamos do relé (D6). Se os dois aceitarem `http`, a D6 cai |
| V2 | O JSON que o Codex e o Gemini mandam em cada hook: quais campos têm sessão, pasta e ferramenta? | Os adaptadores dependem disso |
| V3 | O formato da resposta de permissão do Codex | O Coucou usa o mesmo `hookSpecificOutput` do Claude Code; conferir na versão instalada |
| V4 | Codex e Gemini estão instalados nesta máquina, e em que versão? | Sem eles, a F2 e a F3 esperam |

---

## 6. Riscos

| Risco | Plano |
|---|---|
| Os formatos dos agentes mudarem com frequência (o Codex é novo nisso) | Só o adaptador muda. A versão testada fica anotada aqui, como na 001 |
| Um script seu mandar segredo no texto do aviso | O texto só vive na memória da página (D9 da 001). O `docs/avisar.md` avisa para não mandar |
| A rota de scripts virar spam (um script em laço) | A ilha mostra um aviso por vez, com "+N". Se precisar, um limite por origem |
