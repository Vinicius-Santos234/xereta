# Spec 004 — Responder ao Claude pela ilha

**Status:** rascunho (05/10), aguardando a sua aprovação. Começa depois da 003, porque usa a
ilha grande dela.
**Origem:** `ideias/coucou-instagram.md` (P8). O Coucou faz isso desde a 0.1.3, e o mecanismo foi
lido no código dele em 05/10.

> **Visto em 07/10 (Claude Code 2.1.292):** o `AskUserQuestion` dispara um `PermissionRequest`.
> A ilha o mostrou como pedido, você clicou em Permitir, e o Claude Code ignorou o `allow` (nenhuma
> decisão de hook no transcript) e esperou a escolha no terminal. Desde então (F2 da 002), a ilha
> devolve a pergunta ao terminal na hora e só avisa "Pergunta no terminal: …". O que esta spec
> faz é responder de verdade, pelo `PreToolUse` com `updatedInput.answers`. A V1 ficou em parte
> respondida: `tool_input.questions[].question` existe (e `header`, `options`, `multiSelect`).

---

## 1. Objetivo

Quando o Claude Code pergunta algo de múltipla escolha (a ferramenta `AskUserQuestion`), a sessão
para e espera no terminal. A 004 leva a pergunta para a ilha: você escolhe a opção ali, ou escreve
a sua, sem voltar ao terminal.

**Uma frase de sucesso:** o Claude pergunta "Qual banco para o catálogo? Postgres, Meilisearch ou
Algolia". A ilha abre com o gato de orelha inclinada e as três opções. Clico em Postgres e a
sessão segue.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Responder perguntas do Codex ou do Gemini | Cada agente tem o próprio mecanismo. Entra na 006, se existir |
| Conversa livre com o Claude pela ilha (chat) | É outro produto (§2 da 001) |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | Como a pergunta chega | Um hook **`PreToolUse` com `matcher: "AskUserQuestion"`**, do tipo `http`, apontando para `/fontes/claude-code/pedido` | A pergunta não passa pelo `PermissionRequest`. É o caminho que o Coucou usa (Claude Code 2.1.85 ou mais novo; temos 2.1.287) |
| D2 | A resposta | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"questions":<as perguntas como vieram>,"answers":{"<pergunta>":"<rótulo>"}}}}`. Em múltipla escolha, o valor é uma lista de rótulos | É o formato que o Coucou monta, e o Claude Code aceita como se você tivesse respondido no terminal |
| D3 | Sem resposta | Corpo vazio, e a pergunta aparece no terminal como hoje. **"Responder no terminal"** faz o mesmo na hora | Mesma promessa da 001: sem resposta da ilha, nada muda (D6 da 001) |
| D4 | Espera | **90 s** (configurável), com o hook em **120 s** | Uma pergunta leva mais tempo para pensar do que um Permitir. A folga de 30 s segue a lógica da D7 da 001 |
| D5 | Várias perguntas | O `AskUserQuestion` traz de 1 a 4 perguntas. A ilha mostra **uma por vez**, com "1 de 3", e só responde depois da última | A resposta vai de uma vez para o Claude Code; responder pela metade não existe |
| D6 | "Outro" | Um campo de texto: o que for escrito vira a resposta daquela pergunta | O terminal deixa escrever uma resposta livre, e a ilha também |
| D7 | Foco | Escrever na ilha **pede o foco** só enquanto o campo de texto está ativo, e o devolve ao app anterior depois de enviar | A D13 da 001 (não roubar o foco) continua valendo para tudo o que não é digitar |
| D8 | O Rust não muda | A rota `/pedido` já segura a conexão aberta. Só o adaptador muda: traduz a pergunta e monta a resposta | Segue a D2 da 001: regra de negócio fica em JS |

---

## 4. Como fica

```
┌──────────────────────────────────────────────────────────────┐
│ [gato ?]  vitrine pergunta                                1 de 2 │
│           Qual banco para o catálogo de cursos?                │
│   ( Postgres full-text )  ( Meilisearch )  ( Algolia )         │
│   [ escrever outra resposta… ]                                 │
│                                   [ Responder no terminal ]    │
└──────────────────────────────────────────────────────────────┘
```

Se a pergunta tem descrição em cada opção, ela aparece embaixo do rótulo, em cinza. Em
múltipla escolha, as opções viram caixas de marcar e aparece um "Enviar".

---

## 5. Etapas e critérios de aceite

### F1 — Pergunta e resposta
- O instalador da E3 ganha o hook da D1, e `remover` o tira de novo (com os mesmos critérios de
  "remover devolve o JSON igual").
- Uma pergunta real com 3 opções: clicar numa delas faz a sessão seguir com aquela resposta, e o
  terminal **não** pergunta.
- "Responder no terminal" e 90 s sem resposta: a pergunta aparece no terminal.
- Duas perguntas numa chamada: a ilha mostra "1 de 2" e manda as duas respostas juntas.
- "Outro": o texto escrito chega ao Claude como resposta.

### F2 — Junto com o resto
- Uma pergunta e um pedido de permissão ao mesmo tempo (duas sessões): entram na mesma fila da
  001, um de cada vez.
- O app fechado: a pergunta aparece no terminal na hora (conexão recusada, como na 001).

---

## 6. Verificações pendentes

| # | Pergunta | Por que importa |
|---|---|---|
| V1 | O formato do `tool_input` do `AskUserQuestion` no Windows (`questions[].question`, `header`, `options[].label`/`description`, `multiSelect`) | A ilha monta a tela com esses campos |
| V2 | O `updatedInput` com `answers` funciona com o hook `http` do mesmo jeito que com o `command` do Coucou | É a base da spec inteira. Testar com `curl` primeiro, como na E2 |
| V3 | A resposta "Outro" é aceita como um texto qualquer no lugar de um rótulo? | D6 |
