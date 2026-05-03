# Backlog — itens capturados de conversas

Lista de itens que Fernando levantou em sessões mas que ainda não viraram spec/plan formal. Um item aqui é uma **ideia/bug rastreado**, não tarefa imediata. Quando ganhar prioridade, vira spec via `brainstorming` ou plano via `writing-plans`.

> **Regra:** todo item que entrar aqui tem que ter (1) descrição em uma linha, (2) seção (bug/feature/UX), (3) data, (4) origem (sessão / link). Quando for resolvido, marcar `[done]` com link pro commit, OU mover pra "Resolvidos" no fim.

---

## 🐞 Bugs

- **2026-05-03** — ~~`Filtro duplicados com defeito` em `/collection?duplicates=true`~~ — **FIXADO em 2026-05-03**, branch `fix/duplicates-filter-url-persistence`, [PR commit](../../apps/web/src/app/[locale]/(collector)/collection/page.tsx). Causa raiz: `parseFiltersFromParams`/`filtersToParams` na página da coleção ignoravam o campo `duplicates`, então o checkbox era um botão fantasma. Fix: adicionar serialização/parse pra `duplicates=true`. Cobertura: regressão local + smoke prod com Playwright.
- **2026-05-03** — ~~`Erro ao suspender usuário` no admin~~ — **DIAGNOSTICADO em 2026-05-03**. NÃO é erro de runtime — API responde 200 OK. O bug é que a feature de suspensão é **semi-falsa**: o model `User` em [`schema.prisma`](../../apps/api/prisma/schema.prisma) NÃO tem coluna `suspended`. A função [`suspendUser`](../../apps/api/src/modules/admin/admin.service.ts) só (a) muda `role` pra USER e (b) cancela assinaturas ativas. Quando admin "suspende" um usuário que já é USER, é literalmente no-op no banco — nada bloqueia login do "suspenso". O response inclui `suspended: true` hardcoded, mas é mentira. **Fix de verdade requer:**
  1. Migration: `ALTER TABLE users ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT 0` + `suspended_at DATETIME NULL` + `suspension_reason TEXT NULL`.
  2. `suspendUser`/`unsuspendUser` setam o flag.
  3. Middleware de auth (`authenticate.ts`) bloqueia request quando `user.suspended === true` → 403.
  4. Auth/refresh routes: revogar todos refresh tokens do usuário suspenso.
  5. Admin UI: badge "Suspenso" no header da página do usuário, banner no detalhe. Botão "Suspender" some / "Remover suspensão" aparece quando suspenso.
  6. Login: bloquear usuário suspenso com mensagem dedicada.
  Escopo: ~3-4h de implementação + spec + plano. Aguarda priorização.

## ✨ Features

- **2026-05-03** — **Validação para colocar gibi à venda**: usuário só pode marcar item como "à venda" se tiver dados bancários cadastrados. Verificar `seller`/`banking` modules. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — **Campo PIX nos dados bancários**: além de banco/agência/conta, aceitar chave PIX. Migration + UI + validação. Origem: sessão noturna 2026-05-02.
- ~~**Scan-capa: adicionar mais campos editáveis (ano etc.)**~~ — **DESPRIORIZADO** em 2026-05-03 por Fernando ("esquece o scan, não precisa fazer"). Spec [`2026-05-02-scan-capa-edit-before-search-design.md`](specs/2026-05-02-scan-capa-edit-before-search-design.md) e plano [`2026-05-02-scan-capa-edit-before-search.md`](plans/2026-05-02-scan-capa-edit-before-search.md) ficam parados. Não retomar sem confirmação explícita.

## 🎨 UX / pequenas correções

- **2026-05-03** — ~~`Não mostrar "Criar conta" na home quando usuário está logado`~~ — **FIXADO em 2026-05-03**, branch `fix/homepage-cta-and-deals-coming-soon`. `<CtaSection/>` agora condicionado a `!isAuthenticated`.
- **2026-05-03** — ~~`Botão Ofertas/Deals na home como "em breve"`~~ — **FIXADO em 2026-05-03**, mesma branch. Botão "Ver Ofertas" do hero agora é `disabled` com badge "Em breve" inline.

## 📧 Email / notificações

- **2026-05-03** — `Verificar envio de e-mails das notificações`: confirmar quais eventos disparam email, se a fila/Resend está OK em prod, se templates estão certos. Origem: sessão noturna 2026-05-02.
- **2026-05-03** — `Instalar recebedor de e-mails local para testar` (Mailhog ou Mailpit + SMTP local). Atualizar `apps/api` para apontar pra ele em `NODE_ENV=development`. Origem: sessão noturna 2026-05-02.

## 🛠️ Operações / dados

- **2026-05-03** — **Operação admin: desmarcar como não lidos os itens marcados como lidos em abril/2026**. Esclarecido por Fernando 2026-05-03: a operação é **via admin** (Fernando agindo como admin sobre a própria coleção dele). Plano: (1) gerar via SQL a lista de candidatos `SELECT ci.id, ce.title, ci.read_at FROM collection_items ci JOIN catalog_entries ce ON ce.id = ci.catalog_entry_id WHERE ci.user_id = ? AND ci.is_read = 1 AND ci.read_at BETWEEN '2026-04-01' AND '2026-04-30 23:59:59' ORDER BY ci.read_at`, (2) apresentar a lista pro Fernando confirmar que reconhece, (3) só então `UPDATE collection_items SET is_read = 0, read_at = NULL WHERE id IN (...)`. **PRECISA CONFIRMAÇÃO da lista antes de executar** (destrutivo em dados de prod). Origem: sessão noturna 2026-05-02 + esclarecimento 2026-05-03.

---

## ✅ Resolvidos

_(quando algo daqui virar PR/commit, mover pra cá com link)_
