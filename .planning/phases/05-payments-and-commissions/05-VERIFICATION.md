---
phase: 05-payments-and-commissions
verified: 2026-02-27
status: pending_human_verification
score: 7/7 plans executed
---

# Phase 05: Payments and Commissions — O que foi entregue e como testar

**Fase:** Pagamentos e Comissoes (Phase 05)
**Data:** 2026-02-27
**Status:** Todos os 7 planos executados, aguardando verificacao humana
**Build:** contracts + api + web compilam com sucesso

---

## O que foi entregue

### Backend (3 planos)

#### 05-01: PIX Payment API + Webhook
- **Mercado Pago SDK** abstraction em `shared/lib/mercadopago.ts` com dev-mode fallback (retorna mock quando sem credentials)
- **Payment service** (`/api/v1/payments`): initiate PIX, check status
- **Webhook handler** (`/api/v1/webhooks/mercadopago`): signature validation HMAC-SHA256, idempotency via WebhookEvent unique constraint, auto-confirm payment + trigger order→PAID + record commission
- **PIX expiry alignment**: `MIN(remaining_cart_time - 5min, 30min)` para evitar mismatch cart/PIX
- **Dev mode**: sem `MERCADOPAGO_ACCESS_TOKEN`, retorna dados mock — admin manual approval serve como mecanismo de teste

#### 05-02: Seller Banking API
- **Banking module** (`/api/v1/banking`): CRUD completo de contas bancarias
- **CPF validation** via `cpf-cnpj-validator` (digitos verificadores mod 11)
- **Primary flag** com swap atomico via `$transaction`
- **Auto-promotion** quando conta primary e deletada (mais recente assume)
- **Admin view** (`GET /admin/list`): lista todas contas de vendedores com paginacao e filtro

#### 05-03: Payment Management + Commission Reporting
- **Admin payment management**: approve/reject manual, refund total/parcial via Mercado Pago SDK
- **Payment history**: usuario ve historico com valores, datas, referencias de pedido
- **Commission dashboard**: totais por periodo, por plano, lista de transacoes
- **State machine update**: adicionou transicao PAID→REFUNDED

### Frontend (4 planos)

#### 05-04: PIX Payment UI
- **Pagina PIX** (`/checkout/payment?orderId=xxx`): QR code base64 + copia-e-cola com botao copiar
- **Countdown timer**: colorido (verde→amarelo→vermelho) alinhado com expiracao do PIX
- **Status polling**: verifica a cada 5 segundos, auto-redirect para pedido quando PAID
- **Estado expirado**: mensagem + botao "Tentar novamente"
- **Checkout atualizado**: apos criar pedido, redireciona para pagina PIX (nao mais para detalhe do pedido)

#### 05-05: Payment History + Seller Banking UI
- **Historico de pagamentos** (`/payments/history`): tabela paginada com data, pedido (link), valor, status badge, metodo
- **Banking do vendedor** (`/seller/banking`): CRUD completo com formulario (banco, agencia, conta, tipo, CPF com mascara, titular)
- **Cards de conta**: badge "Principal", acoes editar/deletar/tornar principal
- **CPF masking**: XXX.XXX.XXX-XX no formulario

#### 05-06: Admin UI (Payments + Commissions + Banking)
- **Dashboard de pagamentos** (`/admin/payments`): 2 abas (Pendentes/Todos), approve/reject dialog
- **Dashboard de comissoes** (`/admin/commission`): cards resumo (total, volume, quantidade), filtro por periodo, tabela de transacoes
- **View de contas bancarias** (`/admin/banking`): tabela de todas contas de vendedores, busca por nome/email, CPF mascarado

#### 05-07: Integracao
- **Payment status section** no detalhe do pedido: 5 estados (nao iniciado, pendente, pago, expirado, reembolsado)
- **Navegacao atualizada**: links para historico de pagamentos, dados bancarios vendedor, admin payments/commission/banking

---

## Como testar

### Pre-requisitos

```bash
# 1. Banco de dados com seed
pnpm --filter api db:seed

# 2. Iniciar API
pnpm --filter api dev

# 3. Iniciar Frontend
pnpm --filter web dev

# 4. Build completo (verificar compilacao)
pnpm build
```

### Variaveis de ambiente (apps/api/.env)

```env
# Para testes com Mercado Pago real (sandbox):
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxx
MERCADOPAGO_WEBHOOK_SECRET=xxxx

# Para modo dev (sem Mercado Pago):
# Nao defina as variaveis acima — o sistema usa mock automaticamente
# Use admin manual approval para testar o fluxo completo
```

---

### Fluxos de teste

#### 1. Fluxo PIX Completo (modo dev — sem Mercado Pago)

1. **Login** como comprador (`user@test.com` / `Test1234`)
2. **Adicionar item** ao carrinho via marketplace
3. **Checkout** → selecionar endereco → "Finalizar Pedido"
4. Deve redirecionar para **pagina PIX** (`/checkout/payment?orderId=xxx`)
5. Em modo dev:
   - QR code e copia-e-cola serao null (exibira mensagem de modo dev)
   - Countdown timer inicia baseado no PIX expiry retornado
6. **Como admin**: va em `/admin/payments`
   - Aba "Pendentes" deve mostrar o pagamento
   - Clique "Aprovar" → dialogo de confirmacao → confirmar
7. A pagina PIX do comprador deve **auto-redirecionar** para o detalhe do pedido (polling detecta PAID)
8. O detalhe do pedido deve mostrar status "Pago" na secao de pagamento

#### 2. Pagamento PIX com Mercado Pago (sandbox)

1. Configure `MERCADOPAGO_ACCESS_TOKEN` com credenciais sandbox
2. Repita o fluxo acima — agora a pagina PIX mostrara:
   - QR code real (imagem base64)
   - Copia-e-cola copiavel com botao
   - Countdown timer real
3. **Nota**: PIX sandbox nao completa pagamentos — use admin approval para simular
4. Para testar webhook: use ngrok/tunnel + configure webhook URL no Mercado Pago dashboard

#### 3. Historico de Pagamentos (comprador)

1. Login como comprador
2. Navegacao lateral → "Historico de Pagamentos"
3. Deve mostrar tabela com pagamentos anteriores
4. Cada linha mostra: data, numero do pedido (link), valor em R$, status badge, metodo
5. Clicar no numero do pedido → abre detalhe do pedido

#### 4. Dados Bancarios (vendedor)

1. Login como vendedor
2. Navegacao lateral → "Dados Bancarios"
3. Clicar "Nova Conta Bancaria"
4. Preencher formulario:
   - Banco: Banco do Brasil
   - Agencia: 1234-5
   - Conta: 12345-6
   - Tipo: Corrente
   - CPF: 123.456.789-09 (deve validar digitos)
   - Titular: Nome Completo
5. Salvar → conta aparece na lista com badge "Principal"
6. Adicionar segunda conta → primeira permanece principal
7. Clicar "Tornar Principal" na segunda → swap atomico
8. Deletar conta principal → segunda assume como primary
9. **CPF invalido** deve mostrar erro de validacao

#### 5. Admin — Dashboard de Pagamentos

1. Login como admin
2. Navegacao → Admin → "Pagamentos"
3. Aba "Pendentes":
   - Tabela de pagamentos aguardando aprovacao
   - Botao "Aprovar" → dialogo confirmacao
   - Botao "Rejeitar" → dialogo com campo de motivo
4. Aba "Todos":
   - Todos os pagamentos com filtro de status
5. Aprovar um pagamento:
   - Status do pedido deve mudar para PAID
   - Comissao deve ser registrada automaticamente

#### 6. Admin — Dashboard de Comissoes

1. Login como admin
2. Navegacao → Admin → "Comissoes"
3. Cards resumo: total de comissao, volume de vendas, quantidade de transacoes
4. Filtro de periodo: 7 dias, 30 dias, 90 dias
5. Tabela de transacoes: data, pedido, vendedor, valor venda, comissao, taxa

#### 7. Admin — Dados Bancarios dos Vendedores

1. Login como admin
2. Navegacao → Admin → "Dados Bancarios"
3. Tabela com todas contas de vendedores
4. Busca por nome ou email do vendedor
5. CPF exibido mascarado (***.***.XXX-XX)
6. Info: banco, agencia, conta, tipo, titular, badge primary

#### 8. Detalhe do Pedido — Secao de Pagamento

1. Login como comprador
2. Abrir qualquer pedido em `/orders/[id]`
3. Secao "Pagamento" deve mostrar:
   - **PENDING**: badge amarelo + botao "Pagar com PIX" (link para pagina PIX)
   - **PAID**: badge verde + data de confirmacao
   - **REFUNDED**: badge vermelho + info do reembolso
4. Pedido sem pagamento: estado "Aguardando pagamento"

#### 9. Reembolso (admin)

1. Login como admin
2. No dashboard de pagamentos, selecionar pagamento PAID
3. Clicar "Reembolsar"
4. Escolher reembolso total ou parcial (com valor)
5. Confirmar → status muda para REFUNDED
6. No detalhe do pedido do comprador, secao pagamento mostra reembolso

---

### API Endpoints para teste direto (curl/Postman)

```bash
# === Pagamentos (autenticado) ===
POST http://localhost:3001/api/v1/payments/initiate
  Body: { "orderId": "xxx" }
  → Retorna: { pixQrCode, pixCopyPaste, pixExpiresAt, paymentId }

GET  http://localhost:3001/api/v1/payments/:orderId/status
  → Retorna: { status, paidAt, pixQrCode, pixCopyPaste, pixExpiresAt }

GET  http://localhost:3001/api/v1/payments/history?page=1&limit=20
  → Retorna: paginated list of user's payments

# === Pagamentos Admin ===
GET   http://localhost:3001/api/v1/payments/admin/pending
POST  http://localhost:3001/api/v1/payments/admin/approve   Body: { "paymentId": "xxx" }
POST  http://localhost:3001/api/v1/payments/admin/reject    Body: { "paymentId": "xxx", "reason": "..." }
GET   http://localhost:3001/api/v1/payments/admin/list?status=PAID
POST  http://localhost:3001/api/v1/payments/:paymentId/refund  Body: { "type": "total" }

# === Webhook (sem auth, signature validation) ===
POST http://localhost:3001/api/v1/webhooks/mercadopago
  Headers: x-signature: ts=xxx,v1=xxx
  Body: { "action": "payment.updated", "data": { "id": "12345" } }

# === Banking (autenticado) ===
POST   http://localhost:3001/api/v1/banking
  Body: { "bankName": "Banco do Brasil", "branch": "1234", "accountNumber": "12345-6",
          "accountType": "CHECKING", "cpf": "12345678909", "holderName": "Nome" }
GET    http://localhost:3001/api/v1/banking
PUT    http://localhost:3001/api/v1/banking/:id
DELETE http://localhost:3001/api/v1/banking/:id
PATCH  http://localhost:3001/api/v1/banking/:id/primary

# === Banking Admin ===
GET http://localhost:3001/api/v1/banking/admin/list?page=1&limit=20

# === Commission Admin ===
GET http://localhost:3001/api/v1/commission/admin/dashboard?period=30d
GET http://localhost:3001/api/v1/commission/admin/transactions?page=1&limit=20
```

---

## Arquivos criados/modificados

### Backend
| Arquivo | Descricao |
|---------|-----------|
| `shared/lib/mercadopago.ts` | Mercado Pago SDK singleton, webhook signature validator, dev-mode check |
| `modules/payments/payments.service.ts` | PIX initiate, status check, webhook processing, admin approve/reject, refund, history |
| `modules/payments/payments.routes.ts` | 8 endpoints (initiate, status, history, admin pending/list/approve/reject, refund) |
| `modules/payments/webhook.routes.ts` | POST webhook com idempotency via WebhookEvent |
| `modules/banking/banking.service.ts` | CRUD banco, CPF validation, primary flag, admin view |
| `modules/banking/banking.routes.ts` | 7 endpoints (CRUD + primary + admin list) |
| `modules/commission/commission.service.ts` | +dashboard e transactions (admin) |
| `modules/commission/commission.routes.ts` | +2 endpoints admin |
| `shared/lib/order-state-machine.ts` | +PAID→REFUNDED transition |

### Contratos
| Arquivo | Descricao |
|---------|-----------|
| `packages/contracts/src/payments.ts` | Schemas Zod para pagamentos |
| `packages/contracts/src/banking.ts` | Schemas Zod para contas bancarias |

### Frontend
| Arquivo | Descricao |
|---------|-----------|
| `lib/api/payments.ts` | Client API pagamentos (initiate, status, history) |
| `lib/api/banking.ts` | Client API banking (CRUD) |
| `lib/api/admin-payments.ts` | Client API admin pagamentos |
| `lib/api/admin-commission.ts` | Client API admin comissoes |
| `components/features/checkout/pix-payment-page.tsx` | Pagina PIX com QR + countdown + polling |
| `components/features/checkout/pix-qr-code.tsx` | Display QR code + copia-e-cola |
| `components/features/checkout/pix-countdown-timer.tsx` | Timer colorido |
| `components/features/payments/payment-history-page.tsx` | Historico de pagamentos |
| `components/features/banking/bank-account-form.tsx` | Formulario com CPF mask |
| `components/features/banking/bank-account-list.tsx` | Lista de contas |
| `components/features/admin/payments/admin-payments-page.tsx` | Dashboard pagamentos admin |
| `components/features/admin/payments/pending-payments-table.tsx` | Tabela pendentes |
| `components/features/admin/payments/payment-approval-dialog.tsx` | Dialogo aprovacao |
| `components/features/admin/commission/admin-commission-page.tsx` | Dashboard comissoes |
| `components/features/admin/commission/commission-summary-cards.tsx` | Cards resumo |
| `components/features/admin/commission/commission-transactions-table.tsx` | Tabela transacoes |
| `components/features/admin/banking/admin-banking-page.tsx` | View contas admin |
| `components/features/orders/payment-status-section.tsx` | Secao pagamento no detalhe pedido |

### Rotas novas
| Rota | Pagina |
|------|--------|
| `/checkout/payment` | Pagina PIX com QR code e countdown |
| `/payments/history` | Historico de pagamentos do usuario |
| `/seller/banking` | Gerenciamento de contas bancarias |
| `/admin/payments` | Dashboard de pagamentos (admin) |
| `/admin/commission` | Dashboard de comissoes (admin) |
| `/admin/banking` | View de contas bancarias dos vendedores (admin) |
