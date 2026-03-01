---
phase: 07-community-and-notifications
verified: 2026-02-28
status: pending_human_verification
score: 7/7 plans executed
---

# Phase 07: Community and Notifications — O que foi entregue e como testar

**Fase:** Comunidade e Notificacoes (Phase 07)
**Data:** 2026-02-28
**Build:** contracts + api + web compilam com sucesso

---

## O que foi entregue

### Backend (4 planos)

#### 07-01: Reviews e Ratings API
- **7 endpoints** em `/api/v1/reviews`: CRUD catalogo + vendedor
- **Rating aggregation** atomico via `$transaction` (recalcula averageRating/ratingCount no CatalogEntry)
- **Seller review gate**: so permite avaliar vendedor apos pedido COMPLETED
- **Prevencao de duplicata**: Prisma P2002 → ConflictError 409

#### 07-02: Comments e Favorites API
- **5 endpoints** em `/api/v1/comments`: criar, editar, deletar, listar com replies, toggle like
- **Nesting enforced**: rejeita reply de reply (maximo 1 nivel)
- **optionalAuthenticate** middleware: endpoints publicos com like-status para usuarios logados
- **3 endpoints** em `/api/v1/favorites`: toggle, listar, check
- **Toggle pattern**: uma unica rota POST /toggle para add/remove

#### 07-03: Sistema de Notificacoes API
- **7 endpoints** em `/api/v1/notifications`: listar, unread count, recent 5, mark read, mark all read, preferences CRUD
- **createNotification** fire-and-forget (nunca bloqueia operacoes)
- **Hooks integrados** em: auth (WELCOME), orders (ITEM_SOLD, ORDER_SHIPPED), payments (PAYMENT_CONFIRMED)
- **Preferences**: defaults criados automaticamente na primeira consulta

#### 07-04: Email Transacional (Resend SDK)
- **Resend SDK** abstraction em `shared/lib/resend.ts` com dev-mode fallback (console.log)
- **5 templates PT-BR** responsivos: welcome, payment-confirmed, order-shipped, item-sold, password-reset
- **Base layout** HTML com branding Comics Trunk (purple accent, footer)
- **Preference gate**: verifica preferencias antes de enviar (exceto welcome e password-reset)
- **Hooks**: auth (welcome + password-reset), payments (confirmed), orders (shipped + item-sold)

### Frontend (3 planos)

#### 07-05: Reviews e Comments UI
- **Star rating component** interativo (1-5 estrelas, 3 tamanhos, modo display/interactive)
- **Review section** no catalogo: formulario criar/editar/deletar + lista paginada com media
- **Comment thread** com replies nested, like toggle otimista, formulario inline
- **Seller review** form para pedidos completos, rating summary

#### 07-06: Favorites UI
- **FavoriteButton** (coracao vermelho/outline) com toggle otimista e redirect para login se nao autenticado
- **Integrado** em catalog-card.tsx (hover overlay) e catalog-detail.tsx (junto ao titulo)
- **Pagina /favorites**: grid de favoritos com botao remover e empty state
- **Navegacao**: "Favoritos" (Heart icon) no menu lateral

#### 07-07: Notifications UI
- **NotificationProvider** com polling 30s (somente autenticado)
- **Bell icon** no header com badge vermelho de contagem
- **Dropdown** (Popover): 5 notificacoes recentes, "Ver todas", "Marcar como lidas"
- **Pagina /notifications**: lista completa com filtro (Todas/Nao lidas), paginacao, mark-as-read por click
- **Pagina /notifications/preferences**: toggles por tipo agrupados (Pedidos, Social, Sistema), PASSWORD_RESET locked
- **Notification item**: icone por tipo, titulo, mensagem, tempo relativo, estado lido/nao-lido

---

## Como testar

### Pre-requisitos

```bash
pnpm --filter api db:seed
pnpm --filter api dev
pnpm --filter web dev
```

### Variaveis de ambiente opcionais (apps/api/.env)
```env
# Email (Resend) — sem configurar, emails vao para console
RESEND_API_KEY=re_xxxxxxx
RESEND_FROM_EMAIL=Comics Trunk <noreply@comicstrunk.com>
```

---

### Fluxos de teste

#### 1. Reviews de catalogo

1. Acesse `/pt-BR/catalog` e clique em um item
2. Role ate a secao "Avaliacoes"
3. **Sem login**: deve ver reviews existentes mas nao o formulario
4. **Com login**: formulario aparece com 5 estrelas + textarea
5. Selecione 4 estrelas, escreva "Otimo gibi!" → Enviar
6. Review aparece na lista, media atualiza
7. Clique "Editar" na sua review → altere texto → Salvar
8. Clique "Excluir" → confirmar → review removida, media recalcula

#### 2. Review de vendedor (pos-compra)

1. Apos completar um pedido (status COMPLETED)
2. No perfil do vendedor (`/seller/[id]`)
3. Secao de reviews deve mostrar formulario se voce comprou desse vendedor
4. Avaliar com estrelas + texto → aparece no perfil

#### 3. Comentarios e replies

1. No detalhe de um item do catalogo, secao "Comentarios"
2. Escreva um comentario → aparece na lista
3. Clique "Responder" em um comentario → reply aparece indentado abaixo
4. Clique no coracao → like toggle (numero incrementa/decrementa)
5. Tente responder uma reply → deve ser bloqueado (maximo 1 nivel)

#### 4. Favoritos

1. No catalogo, passe o mouse sobre um card → botao coracao aparece no hover
2. Clique → coracao fica vermelho (preenchido), item adicionado aos favoritos
3. Clique novamente → coracao volta a outline, item removido
4. **Sem login**: clique no coracao → redireciona para login
5. No detalhe do item, coracao aparece ao lado do titulo
6. Menu lateral → "Favoritos" → pagina com grid dos itens favoritados
7. Clique "Remover" em um favorito → removido da lista

#### 5. Notificacoes (bell icon)

1. Login → icone de sino no header
2. Se houver notificacoes nao lidas, badge vermelho com contagem aparece
3. Clique no sino → dropdown com 5 notificacoes recentes
4. Clique em uma notificacao → marca como lida (cor muda)
5. Clique "Marcar todas como lidas" → badge desaparece
6. Clique "Ver todas" → pagina completa de notificacoes

#### 6. Pagina de notificacoes

1. Acesse `/pt-BR/notifications`
2. Lista completa com paginacao
3. Filtro: "Todas" / "Nao lidas"
4. Clique em uma notificacao → marca como lida
5. Botao "Marcar todas como lidas" no topo

#### 7. Preferencias de notificacao

1. Acesse `/pt-BR/notifications/preferences`
2. Toggles agrupados:
   - **Pedidos**: Pagamento confirmado, Pedido enviado, Item vendido
   - **Social**: Nova avaliacao, Novo comentario
   - **Sistema**: Assinatura (pagamento falhou, expirou) — "Redefinicao de senha" locked ON
3. Desabilite "Pedido enviado"
4. Faca um pedido e envie → notificacao NAO deve aparecer (email tambem nao)
5. Reabilite → notificacoes voltam ao normal

#### 8. Emails transacionais (com Resend configurado)

1. **Signup**: criar nova conta → email de boas-vindas
2. **Password reset**: solicitar reset → email com link
3. **Pagamento**: aprovar pagamento → email de confirmacao para comprador
4. **Envio**: adicionar tracking → email para comprador com codigo
5. **Venda**: criar pedido → email para vendedor

**Sem RESEND_API_KEY**: emails vao para console do API server (verificar logs)

#### 9. Gerar notificacoes para testar

```bash
# Criar pedido → gera ITEM_SOLD para vendedor
# Aprovar pagamento → gera PAYMENT_CONFIRMED para comprador
# Adicionar tracking → gera ORDER_SHIPPED para comprador
# Signup → gera WELCOME
```

---

### API Endpoints

```bash
# === Reviews ===
GET  http://localhost:3001/api/v1/reviews/catalog/:catalogEntryId
GET  http://localhost:3001/api/v1/reviews/catalog/:catalogEntryId/mine
POST http://localhost:3001/api/v1/reviews/catalog  Body: { catalogEntryId, rating, text }
PUT  http://localhost:3001/api/v1/reviews/:id      Body: { rating, text }
DELETE http://localhost:3001/api/v1/reviews/:id
POST http://localhost:3001/api/v1/reviews/seller  Body: { sellerId, orderId, rating, text }
GET  http://localhost:3001/api/v1/reviews/seller/:sellerId

# === Comments ===
GET  http://localhost:3001/api/v1/comments/catalog/:catalogEntryId
POST http://localhost:3001/api/v1/comments        Body: { catalogEntryId, content, parentId? }
PUT  http://localhost:3001/api/v1/comments/:id    Body: { content }
DELETE http://localhost:3001/api/v1/comments/:id
POST http://localhost:3001/api/v1/comments/:id/like

# === Favorites ===
POST http://localhost:3001/api/v1/favorites/toggle  Body: { catalogEntryId }
GET  http://localhost:3001/api/v1/favorites
GET  http://localhost:3001/api/v1/favorites/check/:catalogEntryId

# === Notifications ===
GET   http://localhost:3001/api/v1/notifications
GET   http://localhost:3001/api/v1/notifications/unread-count
GET   http://localhost:3001/api/v1/notifications/recent
PATCH http://localhost:3001/api/v1/notifications/:id/read
PATCH http://localhost:3001/api/v1/notifications/read-all
GET   http://localhost:3001/api/v1/notifications/preferences
PUT   http://localhost:3001/api/v1/notifications/preferences  Body: { PAYMENT_CONFIRMED: true, ORDER_SHIPPED: false, ... }
```

---

## Rotas novas
| Rota | Pagina |
|------|--------|
| `/favorites` | Lista de favoritos do usuario |
| `/notifications` | Pagina completa de notificacoes |
| `/notifications/preferences` | Preferencias de notificacao |
