# Phase 5: Payments and Commissions - Research

**Researched:** 2026-02-27
**Domain:** Payment processing (PIX via Mercado Pago), webhook idempotency, commission reporting, seller banking
**Confidence:** MEDIUM-HIGH

## Summary

Phase 5 integrates Mercado Pago PIX payments into the existing order lifecycle built in Phase 4. The core flow is: buyer creates order (already done) -> system generates PIX QR code via Mercado Pago API -> buyer pays in their banking app -> Mercado Pago sends webhook -> system verifies webhook signature, checks idempotency, transitions order to PAID, and records commissions. Secondary flows include admin manual payment approval, refunds (total/partial), user payment history, seller bank account registration, and commission reporting.

The Prisma schema already defines all required models: `Payment` (with `pixQrCode`, `pixCopyPaste`, `pixExpiresAt`, `providerPaymentId`, `providerStatus`, `refundedAmount`), `WebhookEvent` (with unique constraint on `[provider, eventId]` for idempotency), `BankAccount` (with all BANK-01 fields), and `CommissionConfig` (already implemented in Phase 4). No schema migrations are needed.

**Primary recommendation:** Use the `mercadopago` npm package (v2.12.0) with the Payments API (`/v1/payments` with `payment_method_id: 'pix'`) for PIX payment creation. Use the newer Orders API only if the Payments API becomes deprecated. Implement webhook signature validation via HMAC-SHA256 on the `x-signature` header, and leverage the existing `WebhookEvent` table's unique constraint for idempotency.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORDR-08 | PIX payment expires in 24h | Mercado Pago default PIX expiry is 24h; configurable via `date_of_expiration` field (30min to 30 days). Align with cart reservation TTL. |
| PYMT-01 | PIX payment displays QR code and copia-e-cola code | Mercado Pago response provides `point_of_interaction.transaction_data.qr_code` (copia-e-cola text) and `qr_code_base64` (QR image). Store in Payment model's `pixQrCode` and `pixCopyPaste` fields. |
| PYMT-02 | PIX status verified automatically via webhook | Mercado Pago sends POST webhook with `payment` topic on status changes. Validate via `x-signature` HMAC-SHA256. Fetch full payment details via `payment.get()` to confirm status. |
| PYMT-03 | Admin can manually approve/confirm a PIX payment when auto-verification fails | Admin endpoint transitions order PENDING->PAID, creates/updates Payment record with `paidAt`, triggers same post-payment logic (commission recording, status update). |
| PYMT-04 | Webhook processing is idempotent (duplicate events ignored via event ID) | `WebhookEvent` table has `@@unique([provider, eventId])` constraint. Insert-or-skip pattern: try insert, catch unique violation, skip processing. |
| PYMT-05 | Refund support (total or partial) | Mercado Pago SDK provides `payment.refund()` (full) and `payment.refundPartial()` (amount-based). Track in Payment's `refundedAmount` field. Transition order items to REFUNDED status. |
| PYMT-06 | Complete payment history accessible to user | Query Payment table joined with Order, filtered by buyer's orders. Return amount, method, status, dates, order reference. |
| PYMT-07 | PIX QR code expiry aligned with cart reservation time (prevents timer mismatch) | Calculate PIX expiry as `MIN(remaining_cart_time - 5min buffer, 30min)`. Pass as `date_of_expiration` ISO 8601 string to Mercado Pago. |
| PYMT-08 | Admin payment approval dashboard (review and confirm/reject pending payments) | Admin endpoints listing pending payments with order details, manual approve/reject actions. Paginated with filters. |
| COMM-06 | Admin commission dashboard: totals by period, by plan, transaction list | Aggregate `OrderItem.commissionAmountSnapshot` grouped by period (day/week/month) and seller plan type. Already have commission data snapshotted in order items from Phase 4. |
| BANK-01 | Seller can register bank account details (bank, branch, account, CPF, holder, type) | `BankAccount` model already defined with all fields. CRUD service with CPF validation (modulo-11 algorithm or lightweight library). |
| BANK-02 | Multiple accounts supported with one marked as primary | `BankAccount.isPrimary` boolean field exists. Enforce single-primary via transaction: unset old primary before setting new. |
| BANK-03 | Admin can view seller bank data for payout processing | Admin endpoint listing all bank accounts with seller info, filterable by seller. Paginated. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mercadopago | 2.12.0 | Mercado Pago Node.js SDK for PIX payments, refunds, payment status | Official SDK with TypeScript support, maintained by Mercado Pago. Provides `Payment` class with `create`, `get`, `cancel`, `refund`, `refundPartial` methods. |
| node-cron | 4.2.1 | Background scheduler (already installed) | Already used in Phase 4 for cart expiry and order cancellation crons. Reuse for PIX expiry monitoring. |
| crypto | built-in | HMAC-SHA256 webhook signature validation | Node.js built-in `crypto` module. No external dependency needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cpf-cnpj-validator | latest | CPF validation for bank account registration | Lightweight, TypeScript-compatible. Use for BANK-01 CPF field validation. Alternative: hand-roll modulo-11 algorithm (simple, ~20 lines). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mercadopago SDK (Payments API) | Mercado Pago Orders API (`/v1/orders`) | Orders API is newer but SDK support for it is less mature; Payments API is well-documented and battle-tested for PIX. Stick with Payments API for v1. |
| cpf-cnpj-validator | Hand-rolled CPF validation | CPF modulo-11 is simple (~20 lines), but library handles edge cases (repeated digits, formatting). Either works; library saves validation edge-case bugs. |
| Server-side QR rendering | Mercado Pago `qr_code_base64` response field | Mercado Pago returns pre-rendered base64 QR code. No need for `qrcode` npm package -- just display the base64 image on frontend. |

**Installation:**
```bash
pnpm --filter api add mercadopago cpf-cnpj-validator
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/modules/
├── payments/
│   ├── payments.routes.ts        # PIX creation, history, admin approval, refund endpoints
│   ├── payments.service.ts       # Mercado Pago SDK calls, payment lifecycle logic
│   └── webhook.routes.ts         # POST /api/v1/webhooks/mercadopago (no auth, signature validation)
├── banking/
│   ├── banking.routes.ts         # Bank account CRUD, admin view
│   └── banking.service.ts        # Bank account business logic, CPF validation
├── commission/                   # Already exists
│   ├── commission.routes.ts      # Extended with reporting endpoints
│   └── commission.service.ts     # Extended with dashboard aggregation queries
└── orders/                       # Already exists
    ├── orders.routes.ts          # No changes needed
    └── orders.service.ts         # Extended: bulk status transition PENDING->PAID
```

### Pattern 1: Webhook Idempotency Guard
**What:** Every webhook delivery is recorded in `WebhookEvent` before processing. The unique constraint `[provider, eventId]` prevents duplicate processing.
**When to use:** Every webhook handler entry point.
**Example:**
```typescript
// Source: Prisma schema WebhookEvent model + project patterns
async function processWebhook(provider: string, eventId: string, eventType: string, payload: unknown) {
  // Step 1: Try to insert event record (idempotency check)
  try {
    await prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    // Unique constraint violation = duplicate event, skip silently
    if (isPrismaUniqueConstraintError(error)) {
      console.log(`[Webhook] Duplicate event ${eventId} skipped`);
      return; // Return 200 to acknowledge, but don't process
    }
    throw error;
  }

  // Step 2: Process the event (only reached for new events)
  try {
    await handlePaymentEvent(eventType, payload);
    // Step 3: Mark as processed
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    console.error(`[Webhook] Error processing event ${eventId}:`, error);
    throw error;
  }
}
```

### Pattern 2: Webhook Signature Validation
**What:** Validate the `x-signature` header from Mercado Pago using HMAC-SHA256 with a webhook secret.
**When to use:** Before any webhook processing.
**Example:**
```typescript
// Source: Mercado Pago webhook docs
import crypto from 'crypto';

function validateWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  webhookSecret: string,
): boolean {
  // Parse ts and v1 from x-signature header
  const parts = xSignature.split(',');
  const tsValue = parts.find(p => p.trim().startsWith('ts='))?.split('=')[1];
  const v1Value = parts.find(p => p.trim().startsWith('v1='))?.split('=')[1];
  if (!tsValue || !v1Value) return false;

  // Build template string
  const template = `id:${dataId};request-id:${xRequestId};ts:${tsValue};`;

  // Compute HMAC-SHA256
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(template)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(v1Value, 'hex'),
  );
}
```

### Pattern 3: PIX Payment Creation with Mercado Pago SDK
**What:** Create a PIX payment using the SDK's Payment class and store QR code data.
**When to use:** When buyer initiates payment at checkout.
**Example:**
```typescript
// Source: Mercado Pago SDK v2 docs + deepwiki analysis
import { MercadoPagoConfig, Payment } from 'mercadopago';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: { timeout: 10000 },
});

const paymentApi = new Payment(mpClient);

async function createPixPayment(orderId: string, amount: number, buyerEmail: string, expiresAt: Date) {
  const response = await paymentApi.create({
    body: {
      transaction_amount: amount,
      payment_method_id: 'pix',
      payer: { email: buyerEmail },
      description: `Comics Trunk - Order ${orderId}`,
      external_reference: orderId,
      date_of_expiration: expiresAt.toISOString(),
      notification_url: `${process.env.API_URL}/api/v1/webhooks/mercadopago`,
    },
    requestOptions: {
      idempotencyKey: `pix-${orderId}`,
    },
  });

  // Extract PIX data from response
  const transactionData = response.point_of_interaction?.transaction_data;
  return {
    providerPaymentId: String(response.id),
    providerStatus: response.status,
    pixQrCode: transactionData?.qr_code_base64 ?? null,
    pixCopyPaste: transactionData?.qr_code ?? null,
    pixExpiresAt: expiresAt,
  };
}
```

### Pattern 4: Post-Payment Processing (Order Transition)
**What:** After confirming payment (webhook or admin), transition all order items from PENDING to PAID.
**When to use:** In the webhook handler and in admin manual approval.
**Example:**
```typescript
// Source: Existing order-state-machine.ts pattern
async function processPaymentConfirmation(orderId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Update order status to PAID
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    // 2. Update all PENDING items to PAID
    await tx.orderItem.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'PAID' },
    });

    // 3. Update payment record
    await tx.payment.updateMany({
      where: { orderId },
      data: { paidAt: new Date(), providerStatus: 'approved' },
    });
  });
}
```

### Pattern 5: Bank Account Primary Flag Management
**What:** Ensure only one bank account per user is marked as primary.
**When to use:** When creating or updating bank accounts.
**Example:**
```typescript
// Source: Project pattern from ShippingAddress.isDefault (Phase 4)
async function setBankAccountPrimary(userId: string, accountId: string) {
  await prisma.$transaction(async (tx) => {
    // Unset all existing primary flags for this user
    await tx.bankAccount.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
    // Set the target account as primary
    await tx.bankAccount.update({
      where: { id: accountId },
      data: { isPrimary: true },
    });
  });
}
```

### Anti-Patterns to Avoid
- **Processing webhooks without idempotency:** Never skip the `WebhookEvent` insert-or-skip pattern. Mercado Pago retries on failure and can send duplicates.
- **Trusting webhook payload directly for status:** Always fetch the payment details via `payment.get()` after receiving a webhook, rather than trusting the webhook payload's claimed status. The webhook is a notification, not the source of truth.
- **Blocking webhook response on business logic:** Return 200 quickly to Mercado Pago. If heavy processing is needed, acknowledge first and process asynchronously (though for this project's scale, synchronous processing with a 22s timeout is fine).
- **Storing Mercado Pago credentials in code:** Use environment variables (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`). Never commit credentials.
- **Using the older IPN notification system:** Mercado Pago is deprecating IPN in favor of Webhooks. Use Webhooks (the `x-signature` verification approach).
- **Modifying commission data after order creation:** Commissions are snapshotted at order creation (Phase 4 design). COMM-06 reporting reads from `OrderItem.commissionAmountSnapshot`, never recalculates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PIX QR code generation | Custom QR code library | Mercado Pago SDK response `qr_code_base64` | Mercado Pago returns pre-rendered base64 QR image in the payment response. No need for server-side QR generation. |
| Payment status polling | Custom polling infrastructure | Mercado Pago webhooks + fallback polling on frontend | Webhooks are the primary mechanism; frontend polls `/api/v1/payments/:id/status` every 5s as fallback. |
| CPF check-digit validation | Manual modulo-11 implementation | `cpf-cnpj-validator` npm package | Handles formatting, repeated-digit rejection, and edge cases. |
| Webhook retry/queue | Custom queue system (Bull, etc.) | Mercado Pago's built-in retry policy | MP retries at 0, 15, 30 min, then 6h intervals. Return 200 on success; MP handles retries on failure. |
| Currency formatting for BRL | Hand-rolled formatting | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | Browser/Node built-in. Handles decimal separator, symbol placement. |

**Key insight:** Mercado Pago handles the hard parts (QR code generation, PIX protocol, banking network communication, retry logic). Our system is an orchestrator: create payment, store references, receive confirmations, update state.

## Common Pitfalls

### Pitfall 1: Webhook endpoint requires raw body for signature validation
**What goes wrong:** Express `json()` middleware parses the body before the webhook route, destroying the raw body needed for HMAC validation.
**Why it happens:** The standard middleware stack applies `express.json()` globally before routes.
**How to avoid:** The Mercado Pago webhook sends a standard JSON POST. The signature is computed from the `data.id` field and headers, NOT from the raw body. So this is NOT a Stripe-like raw body issue. The `x-signature` template uses `id:{data.id};request-id:{x-request-id};ts:{ts};` -- all extracted from parsed JSON and headers. No special body handling needed.
**Warning signs:** N/A -- this is a false alarm for developers used to Stripe webhooks.

### Pitfall 2: PIX expiry vs cart reservation mismatch
**What goes wrong:** PIX QR code expires after the cart reservation, or vice versa. Buyer pays but cart items are already released, or cart is still reserved but PIX has expired.
**Why it happens:** Cart reservation (24h) and PIX expiry are configured independently.
**How to avoid:** Calculate PIX expiry as `MIN(remaining_cart_reservation - 5min_buffer, 30min)`. If remaining cart time is less than 35 minutes, use `remaining - 5min`. The 5-minute buffer accounts for banking processing delay. Store the expiry in `Payment.pixExpiresAt` and pass to Mercado Pago via `date_of_expiration`.
**Warning signs:** Orders stuck in PENDING with expired PIX and still-reserved cart items.

### Pitfall 3: Race condition on concurrent webhook deliveries
**What goes wrong:** Two identical webhook events arrive nearly simultaneously, both pass the idempotency check, and both process the payment.
**Why it happens:** The `WebhookEvent` insert and subsequent processing are not atomic.
**How to avoid:** The `@@unique([provider, eventId])` database constraint makes the insert atomic -- only one of two concurrent inserts will succeed, the other throws a unique violation. The catch block silently skips the duplicate. This is the correct database-level guard.
**Warning signs:** Duplicate commission recordings (check `WebhookEvent` for duplicate `eventId` entries -- should be impossible with the constraint).

### Pitfall 4: Mercado Pago sandbox PIX limitations
**What goes wrong:** In sandbox/test mode, PIX payments are created in `pending` status but cannot be completed (no real banking network). The QR code cannot be scanned.
**Why it happens:** Mercado Pago sandbox does not simulate PIX payment completion.
**How to avoid:** For development/testing: use the admin manual payment approval endpoint to simulate payment confirmation. For integration tests: mock the Mercado Pago SDK. For production testing: use small real payments (R$ 0.01 minimum). Add a dev-only endpoint to simulate webhook delivery.
**Warning signs:** Tests relying on actual PIX completion in sandbox environment.

### Pitfall 5: Webhook URL must be publicly accessible
**What goes wrong:** Mercado Pago cannot deliver webhooks to `localhost:3001`.
**Why it happens:** Webhooks require a publicly routable URL.
**How to avoid:** For development: use ngrok or similar tunnel, or rely on the polling fallback + admin manual approval. For production: configure the cPanel URL as `notification_url`. Store the webhook URL in env var (`API_PUBLIC_URL`) separate from the internal API URL.
**Warning signs:** No webhook deliveries received in development; payment stuck in PENDING.

### Pitfall 6: Decimal precision in currency amounts
**What goes wrong:** Floating-point arithmetic produces values like `R$ 9.990000000000001`.
**Why it happens:** JavaScript IEEE 754 floating-point numbers.
**How to avoid:** Continue using the existing `roundCurrency` utility from `shared/lib/currency.ts` (already used in Phase 4 commission calculations). All monetary amounts in Prisma are `Decimal(10,2)`. Mercado Pago `transaction_amount` expects a number, not a string -- use `Number(order.totalAmount)`.
**Warning signs:** Commission amounts or refund amounts with more than 2 decimal places.

## Code Examples

### Creating a PIX Payment (Full Service Pattern)
```typescript
// Source: Mercado Pago SDK v2 docs + project patterns
import { MercadoPagoConfig, Payment as MpPayment } from 'mercadopago';
import { prisma } from '../../shared/lib/prisma';
import { NotFoundError, BadRequestError } from '../../shared/utils/api-error';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});
const mpPayment = new MpPayment(mpClient);

export async function initiatePixPayment(orderId: string, userId: string) {
  // 1. Fetch order and validate ownership
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { select: { email: true } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.buyerId !== userId) throw new BadRequestError('Not your order');
  if (order.status !== 'PENDING') throw new BadRequestError('Order already paid or cancelled');

  // 2. Check for existing payment
  const existingPayment = await prisma.payment.findFirst({
    where: { orderId },
  });
  if (existingPayment?.pixExpiresAt && existingPayment.pixExpiresAt > new Date()) {
    // Return existing unexpired payment
    return existingPayment;
  }

  // 3. Calculate PIX expiry aligned with cart reservation
  const now = new Date();
  const maxExpiry = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
  const pixExpiresAt = maxExpiry; // Simplified; real impl checks cart TTL

  // 4. Call Mercado Pago
  const mpResponse = await mpPayment.create({
    body: {
      transaction_amount: Number(order.totalAmount),
      payment_method_id: 'pix',
      payer: { email: order.buyer.email },
      description: `Comics Trunk - ${order.orderNumber}`,
      external_reference: orderId,
      date_of_expiration: pixExpiresAt.toISOString(),
    },
    requestOptions: { idempotencyKey: `pix-${orderId}` },
  });

  const txData = mpResponse.point_of_interaction?.transaction_data;

  // 5. Store payment record
  const payment = await prisma.payment.upsert({
    where: { id: existingPayment?.id ?? '' },
    create: {
      orderId,
      amount: Number(order.totalAmount),
      method: 'PIX',
      providerPaymentId: String(mpResponse.id),
      providerStatus: mpResponse.status ?? 'pending',
      pixQrCode: txData?.qr_code_base64 ?? null,
      pixCopyPaste: txData?.qr_code ?? null,
      pixExpiresAt,
    },
    update: {
      providerPaymentId: String(mpResponse.id),
      providerStatus: mpResponse.status ?? 'pending',
      pixQrCode: txData?.qr_code_base64 ?? null,
      pixCopyPaste: txData?.qr_code ?? null,
      pixExpiresAt,
    },
  });

  return payment;
}
```

### Webhook Handler (Full Pattern)
```typescript
// Source: Mercado Pago webhook docs + project idempotency pattern
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

export async function handleMercadoPagoWebhook(
  headers: Record<string, string>,
  body: { id?: number; type?: string; action?: string; data?: { id?: string } },
) {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  const dataId = body.data?.id;

  // 1. Validate signature
  if (xSignature && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    const isValid = validateWebhookSignature(
      xSignature, xRequestId, dataId ?? '', process.env.MERCADOPAGO_WEBHOOK_SECRET,
    );
    if (!isValid) throw new UnauthorizedError('Invalid webhook signature');
  }

  // 2. Idempotency guard
  const eventId = String(body.id ?? dataId);
  const eventType = body.action ?? body.type ?? 'unknown';

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'mercadopago',
        eventId,
        eventType,
        payload: body as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return; // Duplicate, skip
    }
    throw error;
  }

  // 3. Process based on event type
  if (eventType === 'payment.updated' || eventType === 'payment') {
    await processPaymentUpdate(dataId!);
  }

  // 4. Mark processed
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: 'mercadopago', eventId } },
    data: { processedAt: new Date() },
  });
}
```

### Refund Pattern
```typescript
// Source: Mercado Pago SDK refund methods
export async function refundPayment(paymentId: string, amount?: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.providerPaymentId) throw new BadRequestError('No provider payment to refund');

  if (amount) {
    // Partial refund
    await mpPayment.refundPartial({
      id: payment.providerPaymentId,
      body: { amount },
    });
  } else {
    // Full refund
    await mpPayment.refund({ id: payment.providerPaymentId });
  }

  const refundedAmount = amount ?? Number(payment.amount);
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      refundedAmount: (Number(payment.refundedAmount ?? 0) + refundedAmount),
      providerStatus: amount ? 'partially_refunded' : 'refunded',
    },
  });
}
```

### Commission Dashboard Aggregation
```typescript
// Source: Project Prisma patterns + SQL aggregation
export async function getCommissionDashboard(
  periodStart: Date, periodEnd: Date,
) {
  // Commission totals by plan type
  const byPlan = await prisma.$queryRaw`
    SELECT
      oi.commission_rate_snapshot as rate,
      COUNT(*) as transaction_count,
      SUM(oi.commission_amount_snapshot) as total_commission,
      SUM(oi.price_snapshot) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED')
      AND o.created_at >= ${periodStart}
      AND o.created_at <= ${periodEnd}
    GROUP BY oi.commission_rate_snapshot
  `;

  return byPlan;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mercado Pago IPN notifications | Webhook notifications with x-signature HMAC validation | 2024 | IPN is being deprecated. Use Webhooks for new integrations. Signature validation prevents spoofed webhooks. |
| Mercado Pago Payments API (`/v1/payments`) | Orders API (`/v1/orders`) introduced | 2025 | Orders API is newer but Payments API is still fully supported. For PIX-only integration, Payments API is simpler and better documented. |
| mercadopago npm v1 (callback-based) | mercadopago npm v2 (Promise/async, TypeScript) | v2.0.0 | v2 has TypeScript types, Promise-based API, built-in retry with exponential backoff. |

**Deprecated/outdated:**
- **IPN notifications:** Being replaced by Webhooks. Do not implement IPN for new integrations.
- **mercadopago npm v1 API:** The v1 API used `mercadopago.payment.create()` (dot notation). v2 uses class instances: `new Payment(client).create()`.

## Open Questions

1. **Mercado Pago test account setup**
   - What we know: Requires seller and buyer test accounts. Access token for sandbox starts with `TEST-`. PIX payments in sandbox cannot be completed (remain pending).
   - What's unclear: Whether the user has already created Mercado Pago test accounts and has sandbox credentials.
   - Recommendation: Provide env vars in `.env.example`. Implement admin manual approval as the primary testing mechanism. Add a dev-only webhook simulation endpoint.

2. **Public URL for webhooks in development**
   - What we know: Mercado Pago webhooks require a publicly accessible URL. `localhost` does not work.
   - What's unclear: Whether the user has ngrok or another tunnel available, or whether to rely solely on polling + manual approval during development.
   - Recommendation: Design the system to work without webhooks (polling + manual approval). Webhooks are an enhancement for production. Configure `notification_url` via env var.

3. **Mercado Pago Orders API vs Payments API long-term**
   - What we know: Orders API is newer (2025) and Mercado Pago is promoting it. Payments API is fully supported.
   - What's unclear: Whether Payments API will be deprecated and on what timeline.
   - Recommendation: Use Payments API for v1 (better documented for PIX, simpler). Abstract the SDK calls behind a service interface so switching to Orders API later requires minimal changes.

4. **Refund behavior for multi-seller orders**
   - What we know: An order can contain items from multiple sellers. Payment is a single PIX for the whole order total.
   - What's unclear: Whether partial refunds should refund individual seller items or an arbitrary amount.
   - Recommendation: Implement refund at order-item level. When an item is refunded, calculate the refund as `item.priceSnapshot`. For partial order refunds, admin selects which items to refund. Mercado Pago supports partial refunds by amount.

## Sources

### Primary (HIGH confidence)
- [Mercado Pago PIX Integration (Checkout API)](https://www.mercadopago.com.br/developers/en/docs/checkout-api/integration-configuration/integrate-with-pix) - PIX payment creation, expiry, QR code response
- [Mercado Pago PIX via Orders API](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/pix) - Orders API PIX endpoint, request/response structure
- [Mercado Pago Webhook Notifications](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks) - Webhook topics, signature validation, retry policy
- [Mercado Pago SDK Node.js (GitHub)](https://github.com/mercadopago/sdk-nodejs) - SDK v2.12.0, TypeScript support, initialization
- [Mercado Pago SDK Payment Operations (DeepWiki)](https://deepwiki.com/mercadopago/sdk-nodejs/4.2-payment-operations) - Payment class methods, create/get/cancel/refund/refundPartial

### Secondary (MEDIUM confidence)
- [Mercado Pago SDK Payment Wiki](https://github.com/mercadopago/sdk-nodejs/wiki/Payment) - Payment methods: create, get, search, cancel, refund, refundPartial
- [PIX Payment Sample Node.js (GitHub)](https://github.com/mercadopago/pix-payment-sample-node) - Official sample project
- [Mercado Pago SDK x-signature discussion](https://github.com/mercadopago/sdk-nodejs/discussions/318) - Webhook signature validation issues

### Tertiary (LOW confidence)
- CPF validation: Algorithm is well-documented (modulo-11), but specific npm library recommendation (`cpf-cnpj-validator`) based on web search -- validate version/maintenance status before adopting.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Mercado Pago is the established PIX provider in Brazil. SDK is official and well-maintained.
- Architecture: HIGH - Patterns follow existing project conventions (module structure, Prisma, state machine). Webhook idempotency via database unique constraint is a proven pattern.
- Pitfalls: MEDIUM-HIGH - PIX-specific pitfalls (sandbox limitations, expiry alignment) based on official docs. Webhook signature validation verified against multiple sources.

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (Mercado Pago SDK and API are stable; check for major version bumps)
