# Xereta

Um mascote numa ilha no topo da tela que mostra ao vivo o que o Claude Code está fazendo e
deixa **aprovar ou negar pedidos de permissão sem voltar ao terminal**.

Inspirado no app Coucou (visto num reel em 02/10/2026), com nome, visual e escolhas próprias.
*Xereta* é um nome provisório.

## Estado
E0 concluída: esqueleto Tauri rodando e instalador de 1,33 MiB. Próxima etapa: E1 (a ilha e o mascote).

| Documento | O que é |
|---|---|
| `specs/001-mvp.md` | O MVP: ilha, mascote, status ao vivo e permissão pela ilha |
| `ideias/diferenciais.md` | Documento vivo: o que pode diferenciar o Xereta |

## Stack
Tauri 2 com JavaScript puro na interface e um núcleo fino em Rust. O Rust só faz a ponte
HTTP entre os hooks e a interface; o resto é JS.
