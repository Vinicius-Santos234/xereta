# Spec 003 — Decidir com confiança

**Status:** rascunho (05/10), aguardando a sua aprovação. Começa depois da 001 (E4).
**Origem:** `ideias/diferenciais.md`, itens 2 (diff antes de aprovar), 3 (nível de risco) e
4 ("sempre permitir" com regra visível). É o coração do que diferencia o Xereta.
**Depende de:** E4 da 001 (permissão pela ilha) e do módulo `src/diff.js` da 002.

---

## 1. Objetivo

Na 001 você aprova pela ilha, mas aprova **no escuro**: vê `Editar billing.ts` e não vê o que
muda. A 003 dá à ilha o que é preciso para decidir bem:

1. **O diff no próprio pedido**, antes do Permitir.
2. **O risco do pedido**, com o motivo escrito.
3. **"Sempre permitir isto"**, mostrando exatamente a regra que vai ser gravada, com uma lista
   para ver e desfazer o que já foi gravado.

**Uma frase de sucesso:** o Claude pede para editar o `.env`. A ilha abre grande, vermelha, com o
gato arrepiado, o motivo ("mexe em arquivo de segredo") e as três linhas que mudam. Leio, nego, e
o Claude fica sabendo por quê.

**A diferença para o Coucou** (`ideias/coucou-instagram.md`): ele mostra o diff **depois** que
o Claude edita; o pedido dele mostra só o comando. O "Always" dele não mostra a regra que grava,
e não existe lista de regras. Nada parecido com o nível de risco apareceu.

---

## 2. Fora de escopo

| Fora | Por quê |
|---|---|
| Aprovar sozinho o que tem risco baixo | O risco só informa, nunca decide. Aprovar sem você ver é o pior defeito possível (D6 da 001) |
| Editar o comando antes de aprovar (`updatedInput`) | É possível, mas abre outra classe de erro. Fica para depois, se fizer falta |
| Diff de `NotebookEdit` | Mostra a célula como texto, sem diff linha a linha |
| Regras de negar ou de perguntar | Só "permitir" nesta spec, que é o que o botão grava |

---

## 3. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| D1 | Tamanho da ilha | Um terceiro tamanho, **"ilha grande"** (~600×380), só para pedidos com diff e perguntas (004). **A janela passa a ter o tamanho da ilha grande**, e o recorte continua cortando a forma (D11 da 001) | Mudar o tamanho da janela trouxe o engasgo de volta em 03/10. Uma janela maior parada custa memória: medir de novo (F1) |
| D2 | Diff do Edit e do MultiEdit | Feito **em JS** com `old_string`/`new_string`, mostrando 3 linhas de contexto quando dá | Não precisa ler o arquivo. O número da linha só aparece se o arquivo for lido (D3) |
| D3 | Diff do Write | **O Rust lê o arquivo atual** (comando `ler_texto`) e o JS compara com o `content`. Arquivo que não existe vira "arquivo novo", com todas as linhas como `+` | O Coucou trata todo Write como arquivo novo, e sobrescrever um arquivo inteiro é justamente onde o diff mais importa. Ler arquivo é Rust de plataforma, como o recorte (D2 da 001) |
| D4 | Limites do `ler_texto` | Só caminho absoluto, só arquivo comum (não pasta nem link), até 1 MB, só UTF-8. Fora disso, "diff indisponível", e o pedido segue normal | O caminho vem do `tool_input`, isto é, de fora. O token da 001 já protege a rota, e o limite protege a memória |
| D5 | Privacidade | O diff e o arquivo lido **só vivem na memória** da página, e somem quando o pedido acaba | Mesma regra da D9 da 001: o `.env` editado é exatamente o caso |
| D6 | Risco | **Regras em JS** (`src/risco.js`), cada uma com nível, motivo e exemplos de teste. Três níveis: **alto** (vermelho), **atenção** (âmbar com motivo) e **comum** | Fácil de ler, de testar e de estender. Um modelo de IA não entra: o risco precisa ser previsível |
| D7 | O risco não decide | O risco muda a cor, o texto, o gato e o botão "Sempre". **Nunca aprova nem nega nada sozinho** | É informação para você, não automação |
| D8 | "Sempre permitir" | Responder `allow` com `updatedPermissions` igual às **`permission_suggestions` que o próprio pedido traz**. A ilha mostra a regra em português antes do clique ("Sempre permitir `npm test` neste projeto") | É o que o Coucou faz (lido no código em 05/10): quem grava a regra é o próprio Claude Code, no lugar que ele escolhe. O Xereta não escreve no `settings.json` para isso |
| D9 | Sem "Sempre" no risco alto | O botão não aparece em pedido de risco alto, nem quando o pedido não traz sugestão | Uma regra permanente para `rm -rf` é o tipo de atalho que não pode existir num clique |
| D10 | Lista de regras | Uma tela ("Regras") que **lê** as regras `permissions.allow` do `~/.claude/settings.json` e do `.claude/settings.local.json` de cada projeto visto, marca as que foram criadas pelo Xereta e deixa **remover** uma por vez, com prévia, backup e a mesma recusa da D14 da 001 se o arquivo mudou | "Regra visível" só vale se der para desfazer. Remover passa pelo mesmo cuidado de instalar os hooks |

---

## 4. Como o pedido fica

```
┌──────────────────────────────────────────────────────────────┐
│ [gato arrepiado]  korus quer EDITAR  .env           RISCO ALTO │
│                   mexe em arquivo de segredo                   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 12  DATABASE_URL=postgres://…                            │ │
│ │ 13 -STRIPE_KEY=…                                         │ │
│ │ 13 +STRIPE_KEY=…                                         │ │
│ └──────────────────────────────────────────────────────────┘ │
│            [ Negar ]   [ Permitir ]   [ No terminal ]          │
└──────────────────────────────────────────────────────────────┘
```

- Um Bash de risco mostra o comando inteiro, quebrado em linhas, e a pasta (`cwd`).
- Um pedido comum sem diff (um `npm test`) continua no tamanho normal da 001.
- Diff maior que a ilha: rola dentro da caixa, e o topo mostra "+40 −12 em 3 trechos".

**Regras de risco (primeira lista, para crescer):**

| Nível | Exemplos | Motivo mostrado |
|---|---|---|
| Alto | `rm -rf`, `Remove-Item -Recurse -Force`, `del /s`, `rd /s`, `format` | Apaga arquivos sem volta |
| Alto | `git push --force`/`-f`, `git reset --hard`, `git clean -fd`, `git branch -D` | Reescreve ou descarta histórico |
| Alto | `DROP TABLE`/`DATABASE`, `TRUNCATE`, `DELETE` sem `WHERE` | Apaga dados do banco |
| Alto | `curl … \| sh`, `iwr … \| iex`, `Invoke-Expression` com download | Roda código baixado da internet |
| Alto | Edit/Write em `.env*`, `*.pem`, `id_rsa*`, `credentials*`, `*.key` | Mexe em arquivo de segredo |
| Alto | `reg add HKLM`, `Set-ExecutionPolicy`, `bcdedit`, `netsh` | Muda configuração do sistema |
| Atenção | `git push`, `npm publish`, `vercel --prod`, `firebase deploy`, `supabase db push` | Publica para fora da máquina |
| Atenção | `npm install <pacote>`, `pip install`, `winget install` | Instala código de terceiros |
| Atenção | Edit/Write fora da pasta do projeto (`cwd`) | Mexe fora do projeto |
| Atenção | `~/.claude/settings.json` | Mexe na configuração do Claude Code (e nos hooks do Xereta) |

O gato acompanha: risco alto usa a cara "eita" (orelhas arrepiadas, mãos nos olhos), e atenção
usa o "esperando" com o motivo.

---

## 5. Etapas e critérios de aceite

### F1 — A ilha grande
- A ilha grande abre e fecha sem engasgo, conferido numa gravação a 60 qps como em 03/10.
- Fora do recorte, o clique cai no app de trás, também nos cantos da ilha grande.
- **Memória parada** (média de 5 min) continua abaixo de 100 MB com a janela maior. Se passar,
  a decisão volta para você antes de seguir.
- A ilha grande respeita o teto de 60 qps da ilha aberta (emenda de 05/10 na E3 da 001), também
  num monitor de 144 Hz, e o recorte grande fica certo a 125% e 150% de escala.

### F2 — O diff no pedido
- Edit, MultiEdit e Write de arquivo existente e de arquivo novo mostram o diff certo. Conferir
  contra o `git diff` depois de permitir, em 10 pedidos reais.
- Write num arquivo de 2 MB, num binário e num caminho inexistente: "diff indisponível" ou
  "arquivo novo", e o pedido continua respondível.
- Nada do diff nem do arquivo lido vai para o log.

### F3 — O risco
- `src/risco.js` com um teste para cada regra da tabela (o que deve casar **e** o que não deve:
  `rm -rf node_modules` é alto, `git push` é atenção, `npm test` é comum).
- O risco nunca muda a resposta: um teste confere que o JSON de Permitir é idêntico com e sem
  risco.
- Um pedido real de risco alto aparece vermelho, com motivo e o gato "eita".

### F4 — "Sempre permitir" e a lista de regras
- Num pedido comum que traz `permission_suggestions`, a ilha mostra a regra em português, e o
  clique em "Sempre" faz o Claude Code **não perguntar de novo** o mesmo comando (conferido numa
  segunda chamada real).
- O botão "Sempre" não aparece em risco alto nem sem sugestão.
- A tela de regras lista as regras dos dois arquivos, e remover uma mostra a prévia, faz backup,
  recusa se o arquivo mudou e, depois, o Claude Code volta a perguntar.

---

## 6. Verificações pendentes

| # | Pergunta | Por que importa |
|---|---|---|
| V1 | O formato exato das `permission_suggestions` (tipo, regra, destino) no Windows, na versão instalada | Mostrar a regra em português (D8) e saber em qual arquivo ela cai (D10) |
| V2 | A V3 da 001: os campos do `tool_input` de Edit, MultiEdit e Write no `PermissionRequest` | A F2 inteira depende disso. O código do Coucou usa `old_string`, `new_string` e `content` |
| V3 | Uma regra gravada por `updatedPermissions` vale na sessão aberta ou só na próxima? | O critério da F4 |
| V4 | Uma regra removida do arquivo deixa de valer na sessão aberta? | Para escrever na tela de regras o que acontece depois de remover |

---

## 7. Riscos

| Risco | Plano |
|---|---|
| Uma regra de risco errar e assustar à toa (falso alarme) | Cada regra tem teste do que **não** deve casar. Falso alarme em excesso entra como defeito |
| Uma regra deixar passar algo perigoso (falso "comum") | "Comum" não quer dizer seguro: o texto da ilha nunca diz "seguro", só não mostra alerta. E o risco nunca aprova (D7) |
| O `ler_texto` virar um jeito de ler qualquer arquivo | A rota exige o token, o comando só é chamado pelo JS durante um pedido aberto, e os limites da D4 valem |
| O formato das `permission_suggestions` mudar | Se não for reconhecido, o botão "Sempre" some. O resto funciona |
