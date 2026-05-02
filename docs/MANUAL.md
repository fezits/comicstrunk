# Manual de uso — Comics Trunk

Versão: 2026-04-26 (após Onda 3 do marketplace)

---

## 1. Fluxo do COMPRADOR

### 1.1 Encontrar um item
- Acessa `/pt-BR/marketplace` (sem login necessário pra browse)
- Filtra por título, vendedor, condição
- Clica num anúncio pra ver detalhe + foto adicional + reputação do vendedor

### 1.2 Adicionar ao carrinho
- Clica **Adicionar ao carrinho** no detalhe
- Item fica reservado por **30 minutos** (ninguém mais consegue adicionar)
- Sidebar/badge mostra contador

### 1.3 Checkout
- Acessa `/pt-BR/checkout` ou clica no botão **Finalizar Compra**
- Seleciona endereço de entrega (cadastra novo se necessário)
- Vê **Resumo do Pedido** com:
  - Subtotal dos itens
  - Total de frete (soma dos `shippingCost` definidos pelos vendedores)
  - **Total final**
- Clica **Finalizar Pedido** → cria `Order` em status `PENDING`

### 1.4 Pagamento PIX
- Redirecionado pra `/pt-BR/checkout/payment?orderId=...`
- Vê **QR code PIX** + **código copia-e-cola** + **timer 30min**
- Paga via app do banco
- Aguarda **aprovação do admin** (se modo PIX local) ou aprovação automática (modo Mercado Pago)

### 1.5 Acompanhamento
- `/pt-BR/orders` lista todos os pedidos
- Cada pedido mostra status: `PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED`
- Quando vendedor envia, recebe **e-mail + notificação** com código de rastreio
- Clica em **Confirmar entrega** após receber → `DELIVERED`
- Clica em **Finalizar pedido** após inspecionar → `COMPLETED`
- (Se esquecer, sistema auto-finaliza após 7 dias da entrega)

### 1.6 Disputa (se algo der errado)
- Janela de **7 dias após DELIVERED** pra abrir disputa
- Razões: `NÃO_RECEBIDO`, `DIFERENTE_DA_DESCRIÇÃO`, `DANIFICADO`, `NÃO_ENVIADO_NO_PRAZO`
- Sistema notifica 24h antes da janela fechar
- Admin medeia disputa em `/pt-BR/admin/disputes`

---

## 2. Fluxo do VENDEDOR

### 2.1 Pré-requisitos (OBRIGATÓRIO antes de listar)
1. **Cadastrar conta bancária** em `/pt-BR/seller/banking`
   - Banco, agência, conta, **CPF válido** (sistema valida com algoritmo)
   - Tipo: Corrente ou Poupança
   - Pelo menos 1 conta como `isPrimary`
2. Sem isso, ao tentar marcar item à venda recebe erro:
   > *Cadastre uma conta bancária antes de listar itens à venda. Acesse /seller/banking*

### 2.2 Listar item à venda
- Adiciona item à coleção em `/pt-BR/collection`
- Edita o item e marca **À venda**
- Define:
  - **Preço de venda**
  - **Condição** (NEW, VERY_GOOD, GOOD, FAIR, POOR)
  - **Custo de frete** (opcional — se vazio, será grátis pro comprador)
  - **Fotos** (opcional, do estado real do item)
- Item aparece em `/pt-BR/marketplace` imediatamente

### 2.3 Quando recebe um pedido
- Recebe **e-mail + notificação** `ITEM_SOLD`
- `/pt-BR/seller/orders` lista pedidos recebidos
- Status inicial: `PAID` (já foi pago)
- Clica em **Marcar como em preparo** → `PROCESSING`
- Insere **código de rastreio + transportadora** → `SHIPPED`
- Comprador é notificado automaticamente

### 2.4 Saldo e saque (Payout — Onda 3)
- Quando pedido vira `COMPLETED`, sistema credita **`sellerNetSnapshot`** no saldo do vendedor automaticamente
- `GET /api/v1/payouts/balance` retorna:
  - `available`: pode sacar
  - `pending`: solicitações em andamento (já travado)
  - `totalEarned`: total ganho histórico
  - `totalPaidOut`: total já recebido
- `GET /api/v1/payouts/balance/entries` retorna extrato (créditos de venda + débitos de saque)
- Solicita saque: `POST /api/v1/payouts/request` body `{ "amount": 50.00 }`
- Sistema notifica admins
- Vendedor acompanha em `GET /api/v1/payouts/me`

### 2.5 Disputa contra vendedor
- Comprador pode abrir disputa
- Vendedor recebe notificação + email
- Tem **48h pra responder** (senão escala pra admin automaticamente)
- Pode anexar provas (DisputeEvidence)

---

## 3. Fluxo do ADMIN (gestão da plataforma)

### 3.1 Login
- `https://comicstrunk.com/pt-BR/login` com credencial admin
- Acessa `/pt-BR/admin` (dashboard)

### 3.2 Aprovação de pagamento PIX (manual)
- `/pt-BR/admin/payments` lista pedidos `PENDING`
- Cada linha mostra: pedido, comprador, valor, data, status PIX
- Verifica recebimento no app do banco
- Clica **Aprovar** → Order vira `PAID`, comprador notificado por email
- Ou **Rejeitar** → Order vira `CANCELLED`, comprador notificado (`PAYMENT_REJECTED`)

### 3.3 Gestão de pagamentos a vendedores (Payout — Onda 3)
- `GET /api/v1/payouts/admin?status=REQUESTED` — lista solicitações pendentes
- Cada solicitação mostra:
  - Nome do vendedor + email
  - **Snapshot dos dados bancários** (banco, agência, conta, CPF, titular) no momento da solicitação
  - Valor solicitado
- Admin pode:
  - **Aprovar** (`POST /admin/:id/approve`) — marca como APPROVED, notifica vendedor
  - **Marcar como pago** (`POST /admin/:id/paid` body `{ "externalReceipt": "comprovante PIX" }`) — registra que o PIX foi feito manualmente, debita do saldo
  - **Rejeitar** (`POST /admin/:id/reject` body `{ "reason": "motivo" }`) — devolve valor pro saldo do vendedor

**Processo recomendado:**
1. Admin abre app do banco/conta empresarial
2. Vê solicitação aprovada na plataforma
3. Faz PIX manual usando os dados do `bankSnapshot`
4. Cola o ID do comprovante no campo "externalReceipt"
5. Marca como **PAID** no painel
6. Vendedor recebe notificação `PAYOUT_PAID`

### 3.4 Disputas
- `/pt-BR/admin/disputes` lista todas
- Disputas em `OPEN` há 48h+ sem resposta do vendedor são auto-escaladas pra `IN_MEDIATION`
- Admin lê provas, conversa com partes, resolve com:
  - `RESOLVED_REFUND` (reembolso total)
  - `RESOLVED_PARTIAL_REFUND` (parcial)
  - `RESOLVED_NO_REFUND` (em favor do vendedor)

### 3.5 Suspender usuário
- `/pt-BR/admin/users/{id}` → botão **Suspender**
- **Motivo precisa ter pelo menos 10 caracteres** (validation Zod)
- Efeito: força role pra `USER` (despromove admin) + cancela subscriptions ativas
- Pode reverter via **Remover suspensão**
- Erros agora mostram mensagem real (antes mostrava só "Erro ao suspender usuario")

### 3.6 Duplicatas no catálogo
- `/pt-BR/admin/duplicates` lista pares (GCD vs Rika/Panini)
- 2 modos:
  - **Padrão GCD #issue**: detecta duplicatas pelo padrão GCD
  - **Mesmo título (qualquer fonte)**: agrupa por título normalizado
- Ações:
  - **Remover** um lado (com cascade FK: cart, order, collection, etc) — sourceKey vai para a lista `removed_source_keys` e o cron das 4h não recria mais
  - **Manter ambos** — par registrado em `dismissed_duplicates` por sourceKey (estável, sobrevive a delete+recreate do cron)
- Validação: se há pedidos ativos referenciando o item, bloqueia remoção com mensagem clara
- Reversão (via SQL): `DELETE FROM removed_source_keys WHERE source_key = '...'` ou `DELETE FROM dismissed_duplicates WHERE source_key_a = ... AND source_key_b = ...`

### 3.7 Lista de assinaturas
- `/pt-BR/admin/subscriptions` lista todas
- **Agora inclui usuários FREE** (Onda 3): signup cria Subscription FREE automaticamente
- Backfill rodado em prod: 68 usuários antigos receberam Subscription FREE retroativamente

---

## 4. Configuração de e-mails (Resend)

### Status atual
**E-mails NÃO estão sendo enviados em produção** porque a env `RESEND_API_KEY` não está configurada no cPanel. Logs do API mostram:

```
[EMAIL] DESABILITADO — RESEND_API_KEY não configurada. Email "<assunto>" para <destinatário> NÃO foi enviado. Configure RESEND_API_KEY no cPanel para ativar.
```

### Como ativar (Fernando precisa fazer)

1. Cria conta em https://resend.com (gratuito até 3000 emails/mês, 100/dia)
2. Configura domínio `comicstrunk.com.br`:
   - Adiciona registros DNS (SPF + DKIM) que o Resend fornece
   - Aguarda verificação (alguns minutos)
3. Cria API key no painel Resend (`re_xxxxx`)
4. No cPanel:
   - **Setup Node.js App** → `api.comicstrunk.com`
   - Adiciona env var `RESEND_API_KEY=re_xxxxx`
   - Adiciona env var `RESEND_FROM_EMAIL='Comics Trunk <noreply@comicstrunk.com.br>'`
   - **Restart** a app
5. Testar: criar conta nova → checar se email de boas-vindas chegou

### Quais e-mails são enviados (quando configurado)
- `WELCOME` — após signup
- `PAYMENT_CONFIRMED` — após admin aprovar PIX
- `ORDER_SHIPPED` — após vendedor adicionar tracking
- `ITEM_SOLD` — pro vendedor quando recebe pedido
- `DISPUTE_*` — abertura, resposta, resolução
- `PASSWORD_RESET` — link de recuperação
- `SUBSCRIPTION_*` — pagamento falhou, assinatura expirada
- `PAYOUT_*` — solicitado, aprovado, pago, rejeitado (novos da Onda 3)

### Alternativa: SMTP local via Docker (apenas DEV)
Se quiser testar localmente sem usar Resend:
```bash
docker run -d --name maildev -p 1080:1080 -p 1025:1025 maildev/maildev
```
- Web UI: http://localhost:1080 (vê todos emails enviados)
- Configurar nodemailer com `SMTP_HOST=localhost SMTP_PORT=1025`

> Atualmente o backend só usa Resend SDK. Pra usar SMTP local precisa adicionar nodemailer e ramo condicional. Não está implementado.

---

## 5. Cron jobs ativos em produção

| Cron | Quando | O que faz |
|---|---|---|
| `*/5 * * * *` | a cada 5min | Remove cart items expirados |
| `*/10 * * * *` | a cada 10min | Retry de webhooks Mercado Pago não processados (max 5 tentativas) |
| `0 2 * * *` | 02:00 | Desativa deals expirados |
| `0 3 * * *` | 03:00 | Limpa carrinhos abandonados (>7d) |
| `0 4 * * *` | 04:00 | Cancela order items não enviados (>7d em PROCESSING) |
| `30 4 * * *` | 04:30 | LGPD: processa solicitações de exclusão (>30d) |
| `0 5 * * *` | 05:00 | Reconciliação subscriptions (Stripe) |
| `0 6 * * *` | 06:00 | Auto-escala disputas sem resposta do vendedor (>48h) |
| `0 7 * * *` | 07:00 | **Auto-completa OrderItems entregues há 7+ dias sem disputa + credita saldo do vendedor** |
| `30 7 * * *` | 07:30 | Notifica compradores 24h antes da janela de disputa fechar |

---

## 6. Migrations de banco aplicadas nesta sessão

1. `20260426220000_add_notification_types` — novos tipos de notificação
2. `20260426220500_webhook_retry_fields` — `attempts`, `lastError`, `lastAttemptAt`
3. `20260426223000_payout_and_shipping` — `seller_balances`, `payout_requests`, `seller_balance_entries`, `collection_items.shipping_cost`, `orders.shipping_total`, novos enum values

---

## 7. Endpoints de API (resumo)

### Comprador
- `POST /api/v1/cart` — adicionar ao carrinho
- `GET /api/v1/cart` — ver carrinho
- `POST /api/v1/orders` — criar pedido (checkout)
- `POST /api/v1/payments/initiate` — gerar PIX
- `GET /api/v1/orders` — meus pedidos
- `PATCH /api/v1/orders/items/:id/status` — confirmar entrega/finalizar
- `POST /api/v1/disputes` — abrir disputa

### Vendedor
- `POST /api/v1/banking` — cadastrar conta
- `PATCH /api/v1/collection/:id/sale` — marcar à venda (com salePrice + shippingCost)
- `GET /api/v1/orders/seller` — pedidos recebidos
- `PATCH /api/v1/orders/items/:id/status` — avançar processamento
- `PATCH /api/v1/shipping/tracking/:id` — adicionar tracking
- `GET /api/v1/payouts/balance` — meu saldo
- `GET /api/v1/payouts/balance/entries` — meu extrato
- `POST /api/v1/payouts/request` — solicitar saque
- `GET /api/v1/payouts/me` — minhas solicitações

### Admin
- `GET /api/v1/payments/admin/pending` — PIX pendentes
- `POST /api/v1/payments/admin/approve` — aprovar
- `POST /api/v1/payments/admin/reject` — rejeitar
- `GET /api/v1/payouts/admin?status=REQUESTED` — solicitações de saque
- `POST /api/v1/payouts/admin/:id/approve`
- `POST /api/v1/payouts/admin/:id/paid` — registra recibo + debita saldo
- `POST /api/v1/payouts/admin/:id/reject` — devolve saldo
- `GET /api/v1/admin/duplicates` — duplicatas
- `DELETE /api/v1/admin/duplicates/:id` — remover (com cascade FK)
- `POST /api/v1/admin/users/:id/suspend`
- `POST /api/v1/admin/users/:id/unsuspend`

---

## 8. Próximas evoluções sugeridas

- **Frontend de payout** — telas em `/pt-BR/seller/payouts` e `/pt-BR/admin/payouts` (backend já pronto)
- **Frontend de campo `shippingCost`** no formulário de marcar à venda
- **Cálculo de frete dinâmico** — substituir frete fixo por integração Melhor Envio quando volume justificar
- **Payout automático via MP Money Out** — substituir payout manual quando > 50 saques/mês
- **Configurar `RESEND_API_KEY` em prod** — emails não estão sendo enviados hoje
