# Fluxo de Marketplace — Compra e Venda de Gibis

Documento gerado em 2026-04-26. Mapeia o ciclo completo de vida de uma transação P2P
(vendedor → comprador → admin → finalização) no Comics Trunk e identifica gaps para
correção.

---

## 1. Visão geral

Fluxo end-to-end:

```
┌─────────┐  list   ┌────────────┐  buy    ┌────────┐  pay    ┌─────────┐
│ Seller  ├────────►│ Marketplace├────────►│ Buyer  ├────────►│  PIX    │
└─────────┘         └────────────┘         └────┬───┘         └────┬────┘
                                                │                  │
                                                │                  ▼
                                                │            ┌──────────┐
                                                │            │  Admin   │
                                                │            │  Approve │
                                                │            └────┬─────┘
                                                │                 │
                                                ▼                 ▼
                                         ┌────────────┐    ┌────────────┐
                                         │  Order:    │    │  Order:    │
                                         │  PENDING   ├───►│  PAID      │
                                         └────────────┘    └─────┬──────┘
                                                                 │
                                       ┌─────────────────────────┘
                                       ▼
                              ┌──────────────────┐
                              │ Seller: ship +   │
                              │ tracking code    │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Buyer: confirm   │
                              │ delivery → done  │
                              └──────────────────┘
```

---

## 2. Estados (máquina de estados)

### Order.status

```
PENDING ──┬─► PAID ──► PROCESSING ──► SHIPPED ──► DELIVERED ──► COMPLETED
          │                                                        │
          └─► CANCELLED                                             └─► DISPUTED
```

### OrderItem.status (granular por vendedor)

```
PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED
       └─► CANCELLED  └─► REFUNDED  └─► DISPUTED
```

### Payment.providerStatus

`pending` → `approved` (manual via admin OU webhook MP) → ou `rejected`

### CollectionItem (marketplace flag)

`isForSale=false` (padrão) ⇄ `isForSale=true` (listado, com `salePrice`)

> Nota: ao vender, o `CollectionItem` **não é deletado** — fica no histórico do
> vendedor. O `OrderItem.collectionItemId` referencia o item original.

---

## 3. Etapas detalhadas

### 3.1 Vendedor lista item

| Item | Detalhe |
|---|---|
| Endpoint | `PATCH /api/v1/collection/:id/sale` |
| Schema | `markForSaleSchema` em `@comicstrunk/contracts` |
| Implementação | [collection.service.ts:389-426](apps/api/src/modules/collection/collection.service.ts#L389-L426) |
| Frontend | `/pt-BR/seller/collection` ou `/pt-BR/collection` |
| Pré-requisito | Item deve existir em `CollectionItem` do usuário |
| Campos | `isForSale: boolean`, `salePrice: number` (obrigatório se `isForSale=true`) |
| Comissão | Calculada e exibida ao vendedor (não persistida no item) |

**Snippet relevante:**

```typescript
const commission = data.isForSale && data.salePrice
  ? Number((data.salePrice * COMMISSION_RATE).toFixed(2))
  : null;
```

⚠️ `COMMISSION_RATE` está hardcoded em `0.1` — gap #5.

### 3.2 Comprador adiciona ao carrinho

| Item | Detalhe |
|---|---|
| Endpoint | `POST /api/v1/cart` body `{ collectionItemId }` |
| TTL | 30 minutos (`CartItem.expiresAt`) |
| Frontend | Sidebar/sheet via `CartPage` ou `/pt-BR/cart` |

### 3.3 Comprador cria pedido (checkout)

| Item | Detalhe |
|---|---|
| Endpoint | `POST /api/v1/orders` body `{ shippingAddressId }` |
| Implementação | [orders.service.ts:84-273](apps/api/src/modules/orders/orders.service.ts#L84-L273) |
| Frontend | `/pt-BR/checkout` |
| Efeitos | (1) Cria `Order(PENDING)` com `orderNumber: CT-{seq}`. (2) Cria N `OrderItem(PENDING)` com snapshots imutáveis: `priceSnapshot`, `commissionRateSnapshot`, `commissionAmountSnapshot`, `sellerNetSnapshot`. (3) Limpa `cartItems`. (4) Notifica vendedor (`ITEM_SOLD`). (5) `shippingAddressSnapshot` é JSON. |

**Snapshot da comissão** (por item, de cada vendedor):

```typescript
commissionRate = CommissionConfig.findFirst({ where: { planType, isActive } })?.rate
              ?? DEFAULT_RATES[planType]   // FREE: 0.10, BASIC: 0.08
commissionAmount = round(price * commissionRate)
sellerNet        = round(price - commissionAmount)
```

### 3.4 Comprador inicia pagamento PIX

| Item | Detalhe |
|---|---|
| Endpoint | `POST /api/v1/payments/initiate` body `{ orderId }` |
| Implementação | [payments.service.ts:16-150](apps/api/src/modules/payments/payments.service.ts#L16-L150) |
| Frontend | `/pt-BR/checkout/payment?orderId={id}` |
| Provider | PIX local via `pix-utils` (sem intermediário) — Mercado Pago como fallback opcional |
| Resultado | `Payment` com `pixQrCode`, `pixCopyPaste`, `pixExpiresAt` (≤ 30min, alinhado ao TTL do carrinho) |

### 3.5 Admin aprova pagamento manualmente

| Item | Detalhe |
|---|---|
| Endpoint | `POST /api/v1/payments/admin/approve` body `{ orderId }` |
| Permissão | role `ADMIN` |
| Implementação | [payments.service.ts:345-396](apps/api/src/modules/payments/payments.service.ts#L345-L396) |
| Frontend | `/pt-BR/admin/payments` |
| Efeitos | (1) Cria/atualiza `Payment(approved, paidAt=now)`. (2) `Order: PENDING → PAID`. (3) Todos `OrderItem: PENDING → PAID`. (4) Notifica comprador (`PAYMENT_CONFIRMED`). (5) Email transacional. |

**Endpoint complementar de listagem:**

```
GET /api/v1/payments/admin/pending    → Order[] com status=PENDING
POST /api/v1/payments/admin/reject    → cancela order + items (gap #2: sem notificação)
```

### 3.6 Vendedor envia o item

| Item | Detalhe |
|---|---|
| Etapa 1 | `PATCH /api/v1/orders/items/:id/status` body `{ status: 'PROCESSING' }` |
| Etapa 2 | `PATCH /api/v1/shipping/tracking/:orderItemId` body `{ trackingCode, carrier }` |
| Frontend | `/pt-BR/seller/orders/{id}` |
| Resultado | `OrderItem.status: PROCESSING → SHIPPED`, `shippedAt=now` |
| Notificação | Comprador recebe push/email com tracking |

### 3.7 Comprador confirma recebimento

| Item | Detalhe |
|---|---|
| Endpoint | `PATCH /api/v1/orders/items/:id/status` body `{ status: 'DELIVERED' }` ou `{ status: 'COMPLETED' }` |
| Frontend | `/pt-BR/orders/{id}` |
| Validação | Apenas o `buyerId` da Order pode marcar como `DELIVERED`/`COMPLETED` |
| Janela disputa | **Não há janela** (gap #4) — comprador pode abrir disputa indefinidamente após `DELIVERED` |

### 3.8 Disputa (opcional)

| Item | Detalhe |
|---|---|
| Endpoint | `POST /api/v1/disputes` body `{ orderItemId, reason, description }` |
| Razões | `NOT_RECEIVED`, `DIFFERENT_FROM_LISTING`, `DAMAGED_IN_TRANSIT`, `NOT_SHIPPED_ON_TIME` |
| Status | `OPEN → IN_MEDIATION → RESOLVED_REFUND/PARTIAL_REFUND/NO_REFUND` |
| Mediação admin | `/pt-BR/admin/disputes` |

---

## 4. Modelos do banco (resumo)

| Model | Campos-chave | Notas |
|---|---|---|
| `User` | `id`, `email`, `role` (`USER\|SUBSCRIBER\|ADMIN`) | Role default `USER` |
| `BankAccount` | `userId`, `bankName`, `branchNumber`, `accountNumber`, `cpf`, `holderName`, `accountType`, `isPrimary` | Necessário **apenas para receber payout** (gap #3: não validado no `markForSale`) |
| `CollectionItem` | `userId`, `catalogEntryId`, `condition`, `isForSale`, `salePrice`, `photoUrls` | Vendedor adiciona aqui antes de listar |
| `CartItem` | `userId`, `collectionItemId`, `expiresAt` | TTL 30min |
| `ShippingAddress` | endereço completo do comprador | snapshot vai pra `Order.shippingAddressSnapshot` |
| `Order` | `orderNumber CT-*`, `buyerId`, `status`, `totalAmount`, `shippingAddressSnapshot:json` | sem `shippingCost`, sem `shippingMethod` (gap #2) |
| `OrderItem` | `orderId`, `collectionItemId`, `sellerId`, `priceSnapshot`, `commissionRateSnapshot`, `commissionAmountSnapshot`, `sellerNetSnapshot`, `status`, `trackingCode`, `carrier` | Snapshots **imutáveis** após criação |
| `Payment` | `orderId`, `method=PIX`, `providerPaymentId`, `providerStatus`, `pixQrCode`, `pixCopyPaste`, `pixExpiresAt`, `paidAt` | `providerPaymentId` formato `admin-approved-{orderId}` quando manual |
| `CommissionConfig` | `planType`, `rate` | Source of truth para comissão (gap #5: `markForSale` ignora isso) |
| `Dispute` | `orderItemId`, `reason`, `status`, `resolution` | Sem janela de tempo (gap #4) |

---

## 5. Páginas frontend principais

| Persona | Página | Caminho |
|---|---|---|
| Vendedor | Dados bancários | `/pt-BR/seller/banking` |
| Vendedor | Pedidos recebidos | `/pt-BR/seller/orders` |
| Vendedor | Coleção / marcar à venda | `/pt-BR/collection` |
| Comprador | Marketplace | `/pt-BR/marketplace` |
| Comprador | Detalhe item | `/pt-BR/marketplace/[id]` |
| Comprador | Carrinho | `/pt-BR/cart` |
| Comprador | Checkout | `/pt-BR/checkout` |
| Comprador | Pagamento PIX | `/pt-BR/checkout/payment?orderId=...` |
| Comprador | Meus pedidos | `/pt-BR/orders` |
| Comprador | Detalhe pedido | `/pt-BR/orders/[id]` |
| Admin | Aprovar pagamentos | `/pt-BR/admin/payments` |
| Admin | Disputas | `/pt-BR/admin/disputes` |

---

## 6. Gaps identificados

Tabela ordenada por prioridade sugerida (risco × esforço).

| # | Gap | Severidade | Esforço estimado | Localização |
|---|---|---|---|---|
| 1 | ~~`markForSale` aceita listar sem `BankAccount` cadastrada~~ ✅ **FECHADO 2026-04-26** | ~~Alta~~ | ✅ feito | Validação adicionada em [collection.service.ts:400-407](apps/api/src/modules/collection/collection.service.ts#L400-L407). Mensagem: "Cadastre uma conta bancária antes de listar". Validado em prod. |
| 2 | ~~`adminRejectPayment` não notifica comprador~~ ✅ **FECHADO 2026-04-26** | ~~Média~~ | ✅ feito | Tipo `PAYMENT_REJECTED` adicionado ao enum + notificação enviada em [payments.service.ts:435-446](apps/api/src/modules/payments/payments.service.ts#L435-L446). |
| 3 | ~~Comissão hardcoded `COMMISSION_RATE = 0.1`~~ ✅ **FECHADO 2026-04-26** | ~~Média~~ | ✅ feito | `markForSale` agora usa `previewCommission(price, userId)` que respeita `CommissionConfig` por plano. |
| 4 | ~~`DELIVERED` nunca vira `COMPLETED` automaticamente~~ ✅ **FECHADO 2026-04-26** | ~~Média~~ | ✅ feito | Cron `0 7 * * *` em [shared/cron/index.ts](apps/api/src/shared/cron/index.ts) auto-completa items entregues há 7+ dias sem disputa, libera collectionItem, notifica buyer (`ORDER_AUTO_COMPLETED`) e finaliza Order quando todos items estão done. |
| 5 | ~~Sem janela de disputa pós-`DELIVERED`~~ ✅ **JÁ EXISTIA** + aviso 24h | ~~Média~~ | ✅ feito | Janela de 7 dias já estava em [disputes.service.ts:131-152](apps/api/src/modules/disputes/disputes.service.ts#L131-L152). Adicionado cron `30 7 * * *` que avisa o comprador 24h antes do fechamento (`DISPUTE_WINDOW_CLOSING`). |
| 6 | ~~Webhook MP sem retry~~ ✅ **FECHADO 2026-04-26** | ~~Média~~ | ✅ feito | Schema `WebhookEvent` ganhou `attempts`, `lastError`, `lastAttemptAt`. `processWebhookEvent` registra falhas sem marcar `processedAt`. Cron `*/10 * * * *` chama `retryPendingWebhooks(5)` que reprocessa eventos pendentes (max 5 tentativas, batch de 50). |
| 7 | ~~Sem payout~~ ✅ **FECHADO 2026-04-26 (versão A: manual via admin)** | ~~Crítica~~ | ✅ feito | Schema `SellerBalance` + `SellerBalanceEntry` + `PayoutRequest` (4 status: REQUESTED/APPROVED/PAID/REJECTED). Crédito automático de `sellerNetSnapshot` quando OrderItem vira COMPLETED (idempotente, hookado em [orders.service.ts:500-513](apps/api/src/modules/orders/orders.service.ts#L500-L513) e cron de auto-complete). Endpoints `/api/v1/payouts/{balance, request, me}` + `/admin/{list, approve, paid, reject}`. Notificações `PAYOUT_*`. Backend completo, frontend pendente. |
| 8 | ~~Sem cálculo de frete~~ ✅ **FECHADO 2026-04-26 (versão A: frete fixo)** | ~~Alta~~ | ✅ feito | Campo `CollectionItem.shippingCost` opcional + `Order.shippingTotal` somando todos os fretes. `markForSale` aceita `shippingCost` no schema. `createOrder` soma frete ao `totalAmount`. Comissão calculada apenas sobre o preço (não sobre frete). Frontend mínimo no Resumo do Pedido pendente. |
| 9 | ~~Sem verificação de seller~~ ✅ **JÁ EXISTIA** | ~~Baixa~~ | ✅ feito | `validateAndStripCpf` em [banking.service.ts](apps/api/src/modules/banking/banking.service.ts) usa `cpf-cnpj-validator`. Combinado com gap #1 (banking obrigatório pra listar), garante CPF válido e dados bancários antes de qualquer venda. |
| 10 | **Buyer não consegue confirmar entrega sozinho** — state machine exige `SHIPPED → DELIVERED → COMPLETED`, mas service permite buyer marcar apenas `COMPLETED` ou `DISPUTED`; resultado: buyer chama `COMPLETED` em estado `SHIPPED`, state machine bloqueia. Atualmente é o seller que precisa marcar `DELIVERED` (sem fazer sentido, ele não sabe se chegou). | **Crítica** | 2h | [orders.service.ts:447-453](apps/api/src/modules/orders/orders.service.ts#L447-L453) — adicionar `DELIVERED` à lista `buyerAllowed` |
| 11 | ~~`/pt-BR/cart` quebra com client-side exception~~ ✅ **FECHADO 2026-04-26** | ~~Crítica~~ | ✅ feito | Causa: `cart.service.ts` retornava shape Prisma raw (`collectionItem.catalogEntry`, `collectionItem.user`); frontend lia `collectionItem.title` e `collectionItem.seller.name` (`seller` undefined → TypeError). Fix: helper `normalizeCartItem` achata o shape + converte Decimals. Validado em run `2026-04-26-21-28-24`. |
| 12 | ~~`/pt-BR/checkout` quebra com mesmo erro~~ ✅ **FECHADO 2026-04-26** | ~~Crítica~~ | ✅ feito | Mesma causa do #11 (consome cart). Fix do #11 resolveu este também. |
| 13 | ~~`R$ NaN` em admin/payments e detalhe do pedido~~ ✅ **FECHADO 2026-04-26** | ~~Alta~~ | ✅ feito | Causa: Prisma Decimal serializa como objeto `{d, e, s}`; `Intl.NumberFormat.format` em objeto = NaN. Fix backend (`Number()` em `resolveOrderCovers`, `normalizePayment`/`normalizeOrderTotal` em `payments.service.ts`, `getPaymentStatus` normalizado) + fix frontend (remoção de `payment.amount / 100` em `payment-status-section.tsx` e `pix-payment-page.tsx` — eram divisões legacy assumindo centavos). |

### 6.1 Detalhamento dos gaps prioritários

**Gap #1 — Validar BankAccount antes de listar**

Hoje qualquer usuário pode marcar `isForSale=true` sem ter conta bancária. Quando a venda for finalizada, não há onde pagar. Correção: na rota `PATCH /collection/:id/sale`, se `data.isForSale === true` e `salePrice > 0`, validar que `BankAccount.findFirst({ where: { userId, isPrimary: true } })` retorna um registro. Senão, lançar `BadRequestError('Cadastre uma conta bancária antes de listar itens à venda')`.

**Gap #4 — Auto-completar `DELIVERED → COMPLETED`**

Adicionar cron diário que faz:

```typescript
prisma.orderItem.updateMany({
  where: {
    status: 'DELIVERED',
    deliveredAt: { lt: subDays(new Date(), 7) },
    disputes: { none: { status: { in: ['OPEN', 'IN_MEDIATION'] } } },
  },
  data: { status: 'COMPLETED' },
});
```

Necessário também avaliar se todos `OrderItems` estão `COMPLETED` para finalizar o `Order`.

**Gap #7 — Payout automático**

Modelo novo `SellerBalance` com saldo virtual + extrato (`SellerBalanceEntry`). Quando `OrderItem` vira `COMPLETED` e disputa-window expira (7d), creditar `sellerNetSnapshot` no saldo. Vendedor solicita saque (`POST /payouts`) que dispara PIX out via Mercado Pago Transfer ou banco parceiro. Histórico em `/pt-BR/seller/payouts`.

**Gap #8 — Cálculo de frete**

Integração com Melhor Envio (cobre Correios/Jadlog/Total). No checkout, passar CEP origem (vendedor) e destino (comprador), receber lista de modalidades, persistir escolha em `Order.shippingCost` e `Order.shippingMethodLabel`. Adicionar campos no schema.

---

## 7. Cenários de teste cobertos

Suíte e2e existente em `packages/e2e/tests/`:

| Cenário | Arquivo | Cobertura |
|---|---|---|
| Marketplace browse | [marketplace/browse.spec.ts](packages/e2e/tests/marketplace/browse.spec.ts) | Lista de itens, filtros |
| Carrinho | [cart/management.spec.ts](packages/e2e/tests/cart/management.spec.ts) | Add/remove, TTL |
| Checkout flow | [checkout/flow.spec.ts](packages/e2e/tests/checkout/flow.spec.ts) | Endereço, criação de Order |
| Pagamento PIX | [payments/pix-flow.spec.ts](packages/e2e/tests/payments/pix-flow.spec.ts) | QR code, copy-paste, admin approval |
| Pedidos comprador | [orders/buyer.spec.ts](packages/e2e/tests/orders/buyer.spec.ts) | Listagem, cancelamento, tracking |
| Pedidos vendedor | [orders/seller.spec.ts](packages/e2e/tests/orders/seller.spec.ts) | Tracking, finanças |
| Banking vendedor | [seller/banking.spec.ts](packages/e2e/tests/seller/banking.spec.ts) | CRUD conta bancária |
| Disputas | [disputes/](packages/e2e/tests/disputes/) | Lifecycle completo |
| Admin pagamentos | [admin/payments.spec.ts](packages/e2e/tests/admin/payments.spec.ts) | Dashboard de aprovação |

### 7.1 Cenários FALTANTES (criados neste trabalho)

- `marketplace/full-flow.spec.ts` — **único teste end-to-end** que faz o ciclo completo
  com screenshots em cada etapa.
- `marketplace/gaps/*` — testes de regressão para cada gap conforme forem fechados.

---

## 8. Como rodar o teste end-to-end

```bash
# Local
cd packages/e2e
BASE_URL=http://localhost:3000 \
  API_URL=http://localhost:3001/api/v1 \
  pnpm exec playwright test tests/marketplace/full-flow.spec.ts --headed

# Produção (com manifesto de rollback)
BASE_URL=https://comicstrunk.com \
  API_URL=https://api.comicstrunk.com/api/v1 \
  ADMIN_EMAIL=admin@... \
  ADMIN_PASSWORD=... \
  E2E_PROD=true \
  pnpm exec playwright test tests/marketplace/full-flow.spec.ts
```

Saída esperada:

```
docs/test-reports/marketplace-flow/{YYYY-MM-DD-HHmm}/
├── screenshots/
│   ├── 01-seller-banking.png
│   ├── 02-seller-mark-for-sale.png
│   ├── 03-marketplace-listing.png
│   ├── 04-buyer-cart.png
│   ├── 05-buyer-checkout.png
│   ├── 06-buyer-pix-qr.png
│   ├── 07-admin-pending-payments.png
│   ├── 08-admin-after-approval.png
│   ├── 09-seller-orders-paid.png
│   ├── 10-seller-tracking-added.png
│   ├── 11-buyer-shipped.png
│   ├── 12-buyer-delivered.png
│   └── 13-completed.png
├── rollback.json    ← manifesto com IDs criados, em ordem reversa de delete
└── report.html      ← relatório do Playwright
```

---

## 9. Rollback em produção

`rollback.json` registra **todos** os IDs criados pelo teste:

```json
{
  "timestamp": "2026-04-26T14:32:00.000Z",
  "env": "production",
  "ran_by": "fernando.braidatto@superaholdings.com.br",
  "entities": {
    "users": ["clxxx_seller", "clxxx_buyer"],
    "catalogEntries": ["clxxx_catalog"],
    "collectionItems": ["clxxx_item"],
    "shippingAddresses": ["clxxx_addr"],
    "bankAccounts": ["clxxx_bank"],
    "orders": ["clxxx_order"],
    "orderItems": ["clxxx_oi"],
    "payments": ["clxxx_pay"],
    "notifications": ["clxxx_notif1", "clxxx_notif2"]
  }
}
```

Comando de rollback (executado **somente** após autorização explícita):

```bash
node scripts/rollback-e2e-prod.js \
  docs/test-reports/marketplace-flow/{timestamp}/rollback.json
```

Ordem de remoção (respeita FKs):

1. `notifications` (FK `userId`)
2. `payments` (FK `orderId`)
3. `orderItems` (FK `orderId`, `collectionItemId`)
4. `orders` (FK `buyerId`)
5. `cartItems` (já são limpos no `createOrder`, mas garantir)
6. `collectionItems` (FK `userId`, `catalogEntryId`)
7. `bankAccounts` (FK `userId`)
8. `shippingAddresses` (FK `userId`)
9. `catalogEntries`
10. `users`

> O script só roda com flag `--confirm` para evitar execução acidental.
