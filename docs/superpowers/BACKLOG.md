# Backlog — itens capturados de conversas

Lista de itens que Fernando levantou em sessões mas que ainda não viraram spec/plan formal. Um item aqui é uma **ideia/bug rastreado**, não tarefa imediata. Quando ganhar prioridade, vira spec via `brainstorming` ou plano via `writing-plans`.

> **Regra:** todo item que entrar aqui tem que ter (1) descrição em uma linha, (2) seção (bug/feature/UX), (3) data, (4) origem (sessão / link). Quando for resolvido, marcar `[done]` com link pro commit, OU mover pra "Resolvidos" no fim.

---

## 🐞 Bugs

- **2026-05-03** — `Filtro duplicados com defeito` em `/admin/duplicates` ou `/collection?duplicates=true` (escopo pendente — investigar qual). Origem: sessão noturna 2026-05-02.
- **2026-05-03** — `Erro ao suspender usuário` no admin. Reproduzir, capturar stack trace, fix. Origem: sessão noturna 2026-05-02.

## ✨ Features

- **2026-05-03** — **Validação para colocar gibi à venda**: usuário só pode marcar item como "à venda" se tiver dados bancários cadastrados. Verificar `seller`/`banking` modules. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — **Campo PIX nos dados bancários**: além de banco/agência/conta, aceitar chave PIX. Migration + UI + validação. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — **Scan-capa: adicionar mais campos editáveis**: ano de publicação, autor, mais detalhes que o usuário pode adicionar antes da busca por IA. **Extensão do spec [`2026-05-02-scan-capa-edit-before-search-design.md`](specs/2026-05-02-scan-capa-edit-before-search-design.md)** — incluir `year` e outros campos. Atualizar spec antes de implementar. Origem: sessão noturna 2026-05-02.

## 🎨 UX / pequenas correções

- **2026-05-03** — `Não mostrar "Criar conta" na home quando usuário está logado`. Esconder/condicional no header e CTA. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — `Botão Ofertas/Deals na home como "em breve"` — provavelmente já tem badge mas precisa desabilitar click. Verificar. Origem: sessão noturna 2026-05-02.

## 📧 Email / notificações

- **2026-05-03** — `Verificar envio de e-mails das notificações`: confirmar quais eventos disparam email, se a fila/Resend está OK em prod, se templates estão certos. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — `Instalar recebedor de e-mails local para testar` (Mailhog ou Mailpit + SMTP local). Atualizar `apps/api` para apontar pra ele em `NODE_ENV=development`. Origem: sessão noturna 2026-05-02.

## 🛠️ Operações / dados

- **2026-05-03** — `Desmarcar todos lidos de abril/2026 como não lidos` na coleção do Fernando. **PRECISA CONFIRMAÇÃO antes de executar** (operação destrutiva em dados de prod). Sugestão: gerar uma lista candidata via SQL (`SELECT ... FROM collection_items WHERE user_id=? AND is_read=true AND read_at BETWEEN '2026-04-01' AND '2026-04-30'`), apresentar pro Fernando, e só depois aplicar. Origem: sessão noturna 2026-05-02.

---

## ✅ Resolvidos

_(quando algo daqui virar PR/commit, mover pra cá com link)_
