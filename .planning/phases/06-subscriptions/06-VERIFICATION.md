---
phase: 06-subscriptions
verified: 2026-02-27
status: pending_human_verification
score: 6/6 plans executed
---

# Phase 06: Subscriptions — O que foi entregue e como testar

**Fase:** Assinaturas (Phase 06)
**Data:** 2026-02-27
**Status:** Todos os 6 planos executados, aguardando verificacao humana
**Build:** contracts + api + web compilam com sucesso

---

## O que foi entregue

### Backend (4 planos)

#### 06-01: Subscription API + Stripe SDK
- **Stripe SDK** abstraction em `shared/lib/stripe.ts` com dev-mode fallback
- **Subscription service** (`/api/v1/subscriptions`): checkout session, status, cancel, portal, plan listing
- **Contract schemas** em `packages/contracts/src/subscription.ts`
- **Migration**: adicionou `stripePriceId` nullable em PlanConfig
- **Seed atualizado**: cria 5 PlanConfigs (1 FREE + 4 BASIC por intervalo de cobranca)
- **Dev mode**: sem `STRIPE_SECRET_KEY`, retorna URLs mock — admin manual activation serve como teste

#### 06-02: Stripe Webhook Handler
- **5 event types** processados: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
- **Idempotency** via WebhookEvent table (provider: 'stripe', unique constraint)
- **Raw body** middleware registrado ANTES de `express.json()` no create-app.ts
- **Signature verification** via `stripe.webhooks.constructEvent()` (skip em dev mode)
- **Auto-downgrade**: subscription deleted → FREE, cria notificacao SUBSCRIPTION_EXPIRED
- **Payment failure**: invoice failed → status PAST_DUE, cria notificacao

#### 06-03: Enforcement (Cron + Plan Limits)
- **Cron diario** (5:00 AM): reconciliacao de assinaturas — verifica Stripe real, downgrade expiradas
- **TRIALING tratado como ACTIVE**: collection limit check e commission rate check agora aceitam `status: { in: ['ACTIVE', 'TRIALING'] }`
- Safety net para webhooks que possam ter falhado

#### 06-04: Admin Subscription API
- **5 admin endpoints**: listar assinaturas, ativar manual, listar todos planos, criar plano, atualizar plano
- **Manual activation**: permite ativar assinatura sem Stripe (dev/teste)
- **Plan config CRUD**: criar/editar planos com preco, limite, comissao, trial, stripePriceId

### Frontend (2 planos)

#### 06-05: Subscription UI (Usuario)
- **Pagina de assinatura** (`/subscription`): comparacao FREE vs BASIC lado a lado
- **Seletor de intervalo**: Mensal, Trimestral, Semestral, Anual com preco para cada
- **Status card**: plano atual, proxima cobranca, botao cancelar (com AlertDialog), botao gerenciar (Stripe Portal)
- **Success page** (`/subscription/success`): confirmacao com auto-redirect 5s
- **Cancel page** (`/subscription/cancel`): checkout abandonado com link para tentar novamente
- **Navegacao**: "Assinatura" (icone Crown) no menu lateral

#### 06-06: Admin Subscription UI
- **Dashboard de assinaturas** (`/admin/subscriptions`): tabela com filtros (status, plano), ativacao manual via dialog
- **Gerenciamento de planos** (`/admin/subscriptions/plans`): cards agrupados por tipo, criar/editar plano com preview de impacto na comissao
- **Switch ativo/inativo** para planos
- **Navegacao admin**: "Assinaturas" e "Planos" no menu

---

## Como testar

### Pre-requisitos

```bash
# 1. Banco de dados com seed (inclui PlanConfigs)
pnpm --filter api db:migrate
pnpm --filter api db:seed

# 2. Iniciar API
pnpm --filter api dev

# 3. Iniciar Frontend
pnpm --filter web dev

# 4. Build completo
pnpm build
```

### Variaveis de ambiente (apps/api/.env)

```env
# === MODO DEV (sem Stripe — recomendado para testes iniciais) ===
# Nao defina STRIPE_SECRET_KEY
# Use admin manual activation para testar fluxos

# === MODO STRIPE SANDBOX ===
STRIPE_SECRET_KEY=sk_test_xxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxx

# Para testar webhooks localmente:
# stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```

---

### Fluxos de teste

#### 1. Verificar seed de planos

```bash
# Deve retornar 5 planos (1 FREE + 4 BASIC intervalos)
curl http://localhost:3001/api/v1/subscriptions/plans
```

Esperado:
- FREE: limite 50 itens, comissao 15%, preco R$0
- BASIC Mensal: limite 200 itens, comissao 8%, preco R$19.90
- BASIC Trimestral: R$49.90
- BASIC Semestral: R$89.90
- BASIC Anual: R$149.90

#### 2. Pagina de assinatura (usuario FREE)

1. Login como `user@test.com` / `Test1234`
2. Menu lateral → "Assinatura" (icone coroa)
3. Verificar:
   - Card de status mostra "FREE" com badge
   - Botao "Upgrade para BASIC"
   - Comparacao lado a lado: FREE vs BASIC com features listadas
   - Toggle de intervalo de cobranca (Mensal/Trimestral/Semestral/Anual)
   - Preco muda ao trocar intervalo
4. Clicar "Assinar BASIC":
   - **Modo dev**: mostrara erro "Stripe nao configurado" (esperado)
   - **Modo Stripe**: redireciona para Checkout do Stripe

#### 3. Ativacao manual via admin (modo dev — sem Stripe)

1. Login como admin (`admin@comicstrunk.com` / senha do seed)
2. Menu admin → "Assinaturas"
3. Clicar "Ativar Assinatura"
4. No dialog:
   - Email do usuario: `user@test.com`
   - Plano: BASIC
   - Confirmar
5. Verificar na tabela: assinatura aparece como ACTIVE
6. **Trocar para o usuario**: login como `user@test.com`
7. Menu → "Assinatura":
   - Card deve mostrar "BASIC" com badge verde
   - Proxima cobranca: data visivel
   - Botoes "Cancelar" e "Gerenciar" visiveis

#### 4. Verificar limites de plano atualizados

1. Como usuario BASIC (`user@test.com` — ativado no teste anterior):
   - Ir para Colecao → Adicionar item
   - Deve permitir ate 200 itens (antes era 50)
2. Como usuario FREE (outro usuario):
   - Limite continua em 50 itens
   - Ao atingir 50: mensagem "Limite do plano FREE atingido. Faca upgrade para BASIC."

#### 5. Comissao diferenciada por plano

1. Como usuario BASIC no marketplace:
   - Ao listar item para venda, preview de comissao deve mostrar 8%
2. Como usuario FREE:
   - Preview de comissao deve mostrar 15%

#### 6. Cancelamento de assinatura

1. Login como usuario BASIC
2. Menu → "Assinatura"
3. Clicar "Cancelar Assinatura"
4. AlertDialog: "Tem certeza? Beneficios continuam ate o fim do periodo."
5. Confirmar cancelamento
6. Status card deve mostrar:
   - "Cancelado" badge
   - "Ativo ate DD/MM/YYYY" (fim do periodo atual)
   - Botao "Reativar" (se implementado)

#### 7. Admin — Dashboard de assinaturas

1. Login como admin
2. Menu admin → "Assinaturas"
3. Verificar:
   - Tabela com todas assinaturas
   - Filtro por status: ACTIVE, TRIALING, CANCELLED, EXPIRED, PAST_DUE
   - Filtro por plano: FREE, BASIC
   - Info de usuario (nome, email) em cada linha
   - Datas: inicio, fim do periodo, cancelamento

#### 8. Admin — Gerenciamento de planos

1. Login como admin
2. Menu admin → "Planos"
3. Verificar:
   - Cards agrupados: FREE (1 card), BASIC (4 cards por intervalo)
   - Cada card mostra: nome, preco, limite, comissao, trial, ativo/inativo
4. Clicar "Editar" em um plano:
   - Formulario com todos campos
   - **Preview de impacto na comissao**: "Se alterar de X% para Y%, afeta N vendedores"
5. Toggle ativo/inativo:
   - Desativar plano → nao aparece mais para usuarios na pagina de assinatura
   - Reativar → volta a aparecer
6. Clicar "Novo Plano":
   - Formulario de criacao
   - Selecionar tipo (FREE/BASIC), intervalo, preco, limites

#### 9. Fluxo completo com Stripe (se credenciais disponiveis)

1. Configurar variaveis Stripe no .env
2. No dashboard Stripe:
   - Criar Product "Comics Trunk BASIC"
   - Criar Price para cada intervalo
   - Copiar Price IDs para os PlanConfigs via admin UI
3. Configurar Customer Portal no Stripe Dashboard
4. Como usuario FREE:
   - Menu → Assinatura → "Assinar BASIC" → Mensal
   - Redireciona para Stripe Checkout
   - Usar cartao de teste: 4242 4242 4242 4242
   - Completar pagamento
   - Redireciona para `/subscription/success`
   - Apos 5s redireciona para `/subscription`
   - Status mostra BASIC ACTIVE
5. Para webhook local:
   ```bash
   stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
   ```
   - Verificar que webhook processa checkout.session.completed
   - Assinatura criada automaticamente no banco

#### 10. Reconciliacao (cron)

1. O cron roda diariamente as 5:00 AM
2. Para testar manualmente, verificar nos logs do API:
   - "Subscription reconciliation: checked X, downgraded Y"
3. Para simular: alterar `currentPeriodEnd` de uma assinatura para data passada no banco
4. Aguardar cron ou reiniciar API → assinatura deve ser downgraded

---

### API Endpoints

```bash
# === Planos (publico) ===
GET http://localhost:3001/api/v1/subscriptions/plans

# === Assinatura (autenticado) ===
GET  http://localhost:3001/api/v1/subscriptions/status
POST http://localhost:3001/api/v1/subscriptions/checkout
  Body: { "planConfigId": "xxx" }
POST http://localhost:3001/api/v1/subscriptions/cancel
POST http://localhost:3001/api/v1/subscriptions/portal

# === Admin ===
GET  http://localhost:3001/api/v1/subscriptions/admin/list?status=ACTIVE
POST http://localhost:3001/api/v1/subscriptions/admin/activate
  Body: { "userId": "xxx", "planType": "BASIC" }
GET  http://localhost:3001/api/v1/subscriptions/admin/plans
POST http://localhost:3001/api/v1/subscriptions/admin/plans
  Body: { "name": "BASIC Mensal", "planType": "BASIC", "billingInterval": "MONTHLY", "price": 19.90, "collectionLimit": 200, "commissionRate": 8.0, "trialDays": 7, "isActive": true }
PUT  http://localhost:3001/api/v1/subscriptions/admin/plans/:id
  Body: { "price": 24.90 }

# === Webhook Stripe (sem auth) ===
POST http://localhost:3001/api/v1/webhooks/stripe
  Headers: stripe-signature: xxx
  Body: raw Stripe event JSON
```

---

## Arquivos criados/modificados

### Backend
| Arquivo | Descricao |
|---------|-----------|
| `shared/lib/stripe.ts` | Stripe SDK singleton com dev-mode fallback |
| `modules/subscriptions/subscriptions.service.ts` | Checkout, status, cancel, portal, plan seed, admin CRUD |
| `modules/subscriptions/subscriptions.routes.ts` | 10 endpoints (5 usuario + 5 admin) |
| `modules/subscriptions/stripe-webhook.service.ts` | 5 event handlers com idempotency |
| `modules/subscriptions/stripe-webhook.routes.ts` | POST webhook com raw body + signature |
| `shared/cron/index.ts` | +1 cron: reconciliacao diaria 5AM |
| `modules/collection/collection.service.ts` | TRIALING aceito em checkPlanLimit |
| `modules/commission/commission.service.ts` | TRIALING aceito em previewCommission |
| `prisma/schema.prisma` | +stripePriceId em PlanConfig |
| `prisma/seed.ts` | +5 PlanConfig seeds |

### Contratos
| Arquivo | Descricao |
|---------|-----------|
| `packages/contracts/src/subscription.ts` | Schemas Zod + tipos para assinaturas |

### Frontend
| Arquivo | Descricao |
|---------|-----------|
| `lib/api/subscriptions.ts` | Client API assinaturas |
| `lib/api/admin-subscriptions.ts` | Client API admin assinaturas |
| `components/features/subscription/plan-comparison.tsx` | Comparacao FREE vs BASIC |
| `components/features/subscription/subscription-status-card.tsx` | Card de status atual |
| `components/features/admin/subscription-list.tsx` | Tabela admin assinaturas |
| `components/features/admin/plan-config-form.tsx` | Formulario plano com preview |
| `components/ui/alert-dialog.tsx` | shadcn AlertDialog |
| `components/ui/switch.tsx` | shadcn Switch |

### Rotas novas
| Rota | Pagina |
|------|--------|
| `/subscription` | Pagina de assinatura (comparacao + status) |
| `/subscription/success` | Confirmacao pos-checkout |
| `/subscription/cancel` | Checkout abandonado |
| `/admin/subscriptions` | Dashboard admin assinaturas |
| `/admin/subscriptions/plans` | Gerenciamento de planos |
