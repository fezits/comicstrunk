# Phase 6: Subscriptions - Research

**Researched:** 2026-02-27
**Domain:** Subscription billing (Stripe Checkout, Customer Portal, webhooks), plan enforcement, automatic downgrade
**Confidence:** HIGH

## Summary

Phase 6 integrates Stripe subscription billing into the existing plan enforcement system built in Phases 3-5. The core flow is: user clicks "Upgrade to BASIC" -> system creates a Stripe Checkout Session -> user completes payment on Stripe's hosted page -> Stripe sends `checkout.session.completed` webhook -> system creates/updates Subscription record with `stripeCustomerId` and `stripeSubscriptionId`, sets user role to SUBSCRIBER, plan to BASIC. Ongoing billing is handled entirely by Stripe (invoices, retries, payment methods). Cancellation marks end-of-period; a `customer.subscription.deleted` webhook triggers downgrade to FREE. The Customer Portal provides self-service for payment method updates, cancellation, and invoice history.

The Prisma schema already defines the `Subscription` model (with `stripeCustomerId`, `stripeSubscriptionId`, `planType`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelledAt`) and the `PlanConfig` model (with `planType`, `name`, `price`, `billingInterval`, `collectionLimit`, `commissionRate`, `trialDays`, `isActive`). The existing collection service (`checkPlanLimit`) and commission service (`getCommissionRate`) already query the Subscription table to determine the user's active plan. No schema migrations are needed.

**Primary recommendation:** Use the `stripe` npm package (v20.x) with Stripe Checkout Sessions for initial subscription creation and the Stripe Customer Portal for self-service management. Handle subscription lifecycle events via webhooks with the existing `WebhookEvent` idempotency pattern. Create a `shared/lib/stripe.ts` abstraction following the same pattern as `shared/lib/mercadopago.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUBS-01 | FREE plan (default) and BASIC paid plan available | `PlanConfig` model stores plan metadata (price, limits, commission rate). `Subscription.planType` enum is `FREE` or `BASIC`. Users without a subscription default to FREE (already enforced in collection.service.ts and commission.service.ts). Seed PlanConfig rows for FREE and BASIC plans. |
| SUBS-02 | Stripe recurring billing (monthly, quarterly, semi-annual, annual) | Create Stripe Products and Prices for each billing interval. `PlanConfig.billingInterval` enum supports MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL. Pass the corresponding Stripe Price ID to `stripe.checkout.sessions.create()` with `mode: 'subscription'`. |
| SUBS-03 | Configurable trial period | `PlanConfig.trialDays` field stores trial duration. Pass `subscription_data.trial_period_days` to Stripe Checkout Session. Stripe handles trial-to-paid transition automatically. |
| SUBS-04 | User can upgrade plan at any time | Create a Stripe Checkout Session with `mode: 'subscription'` and `customer` (if existing) or `customer_email`. After `checkout.session.completed`, create/update Subscription record. Collection limit and commission rate immediately reflect BASIC plan. |
| SUBS-05 | Cancellation marks end-of-period (not immediate); user keeps benefits until period ends | Call `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`. Stripe sends `customer.subscription.updated` with `cancel_at_period_end: true`. Update local `Subscription.cancelledAt` but keep status ACTIVE. Benefits remain until `currentPeriodEnd`. |
| SUBS-06 | Auto-downgrade to FREE when subscription expires or payment fails definitively | Listen to `customer.subscription.deleted` webhook. When received, update Subscription status to CANCELLED, set planType to FREE, update user role to USER. Existing collection items above 50 are preserved (COLL-08) but new additions are blocked (COLL-07). |
| SUBS-07 | Notification on payment failure | Listen to `invoice.payment_failed` webhook. Create a Notification record with type `SUBSCRIPTION_PAYMENT_FAILED`. The Notification model and NotificationType enum already exist in the schema. |
| SUBS-08 | Admin can approve/activate subscription changes | Admin endpoint to list subscriptions, manually activate/deactivate. Override plan type when Stripe is not configured (dev mode). Admin can also view subscription details via Stripe Dashboard. |
| SUBS-09 | Plan prices configurable by admin | Admin CRUD endpoints for `PlanConfig` model. Admin updates prices in PlanConfig and in Stripe Dashboard (or via Stripe API). Frontend reads PlanConfig for display; actual billing uses Stripe Price IDs. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 20.x (latest) | Stripe Node.js SDK for Checkout Sessions, Customer Portal, webhook verification, subscription management | Official SDK with TypeScript support, maintained by Stripe. Current API version 2026-02-25. Provides `stripe.checkout.sessions.create()`, `stripe.billingPortal.sessions.create()`, `stripe.webhooks.constructEvent()`. |
| node-cron | 4.2.1 | Background scheduler (already installed) | Already used for cart expiry and order cancellation crons. Reuse for subscription grace period checks. |
| crypto | built-in | No additional dependency needed | Stripe SDK handles signature verification internally via `constructEvent()`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @stripe/stripe-js | latest | Stripe.js for frontend (redirect to Checkout) | Only needed if using Stripe Elements. For Checkout redirect flow, a simple `window.location.href = session.url` suffices. May not be needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout (hosted page) | Stripe Elements (embedded) | Checkout is faster to implement, handles 3DS/SCA, PCI-compliant by default. Elements give more UI control but require more frontend work. Checkout is the right choice for v1. |
| Stripe Customer Portal | Custom subscription management UI | Portal is free, handles payment method updates, cancellation, invoice history, proration. Building custom requires reimplementing all of this. Use Portal for v1. |
| Stripe Billing (subscriptions) | Manual recurring charges via cron | Stripe handles retry logic, dunning, proration, invoice generation. Manual approach is fragile and reinvents the wheel. |
| `cancel_at_period_end` | Immediate cancellation + proration | End-of-period cancellation matches SUBS-05 requirement. Immediate cancellation would require refund calculation. |

**Installation:**
```bash
pnpm --filter api add stripe
```

## Existing Codebase Analysis

### Subscription Model (Prisma Schema)

Already defined at `apps/api/prisma/schema.prisma` lines 641-661:

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @map("user_id")
  stripeCustomerId     String?            @map("stripe_customer_id")
  stripeSubscriptionId String?            @map("stripe_subscription_id")
  planType             PlanType           @default(FREE) @map("plan_type")
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime?          @map("current_period_start")
  currentPeriodEnd     DateTime?          @map("current_period_end")
  cancelledAt          DateTime?          @map("cancelled_at")
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
  @@index([status])
  @@map("subscriptions")
}
```

Key observations:
- `stripeCustomerId` and `stripeSubscriptionId` are nullable (supports dev mode without Stripe)
- `PlanType` enum: `FREE`, `BASIC`
- `SubscriptionStatus` enum: `ACTIVE`, `CANCELLED`, `PAST_DUE`, `TRIALING`
- `currentPeriodStart`/`currentPeriodEnd` track billing cycle dates from Stripe
- User has `subscriptions` relation (one-to-many, supports plan history)

### PlanConfig Model (Prisma Schema)

Already defined at lines 663-679:

```prisma
model PlanConfig {
  id              String          @id @default(cuid())
  planType        PlanType        @map("plan_type")
  name            String
  price           Decimal         @db.Decimal(10, 2)
  billingInterval BillingInterval @map("billing_interval")
  collectionLimit Int             @map("collection_limit")
  commissionRate  Decimal         @map("commission_rate") @db.Decimal(5, 4)
  trialDays       Int             @default(0) @map("trial_days")
  isActive        Boolean         @default(true) @map("is_active")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  @@index([planType])
  @@index([isActive])
  @@map("plan_configs")
}
```

Key observations:
- `BillingInterval` enum: `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `ANNUAL`
- Each row represents a (planType, billingInterval) combination with its price
- `collectionLimit` and `commissionRate` stored here (source of truth for plan benefits)
- `trialDays` field exists for SUBS-03
- Missing: `stripePriceId` -- need to store the Stripe Price ID for each plan config. **Decision: add a `stripePriceId` String? field to PlanConfig** or store the mapping in env vars/config. Recommendation: add the field to PlanConfig for admin manageability.

### Existing Plan Enforcement (Collection Service)

File: `apps/api/src/modules/collection/collection.service.ts`

The `checkPlanLimit()` function (lines 44-69) already:
1. Counts current collection items within a Prisma transaction
2. Queries the `Subscription` table for the user's active subscription
3. Falls back to FREE if no subscription found
4. Uses `COLLECTION_LIMITS` from contracts (`FREE: 50, BASIC: 200`)
5. Throws `BadRequestError` with plan details when limit exceeded

**Integration point:** This function already works. When a user upgrades to BASIC, creating/updating their Subscription record with `planType: 'BASIC'` and `status: 'ACTIVE'` is sufficient -- the collection service will immediately respect the new limit.

### Existing Commission Integration (Commission Service)

File: `apps/api/src/modules/commission/commission.service.ts`

The `previewCommission()` and `getCommissionRate()` functions already:
1. Look up user's active subscription to determine plan type
2. Query `CommissionConfig` for the rate by plan type
3. Default rates: FREE 10%, BASIC 8%

**Integration point:** Like collection limits, commission rates are already plan-aware. Upgrading the subscription record is sufficient.

### Existing Webhook Idempotency Pattern (Payments Service)

File: `apps/api/src/modules/payments/payments.service.ts`

The `processWebhookEvent()` function (lines 228-295) implements:
1. Insert into `WebhookEvent` table (unique constraint on `[provider, eventId]`)
2. Catch `P2002` (unique violation) to skip duplicate events
3. Process the event based on type
4. Mark as processed with `processedAt` timestamp

**Integration point:** Reuse this exact pattern for Stripe webhooks, with `provider: 'stripe'` instead of `'mercadopago'`.

### Existing SDK Abstraction Pattern (MercadoPago)

File: `apps/api/src/shared/lib/mercadopago.ts`

Pattern to follow:
- Conditional initialization based on env var presence
- Export client instance and helper functions
- `isConfigured()` check for dev mode fallback
- Signature validation as a standalone function

### Existing Cron Pattern

File: `apps/api/src/shared/cron/index.ts`

Pattern:
- `registerCronJobs()` called once on server startup
- Each cron job in a `cron.schedule()` call with error handling
- Console logging for actions taken

**Integration point:** Add a daily cron job to check for subscriptions past their `currentPeriodEnd` that Stripe may have already cancelled (safety net for missed webhooks).

### Route Registration Pattern

File: `apps/api/src/create-app.ts`

- Routes registered as `app.use('/api/v1/{resource}', resourceRoutes)`
- Webhook routes at `app.use('/api/v1/webhooks/mercadopago', webhookRoutes)`
- `express.json()` applied globally before routes

**CRITICAL ISSUE for Stripe webhooks:** Stripe requires the **raw request body** for signature verification via `stripe.webhooks.constructEvent()`. The current setup applies `express.json()` globally (line 43), which parses the body before the webhook route reaches it. This is different from Mercado Pago, which validates signatures from headers and parsed fields.

**Solution:** Register the Stripe webhook route BEFORE `express.json()` with `express.raw({ type: 'application/json' })`, or use a middleware that captures `req.rawBody` alongside the parsed body.

### Notification Types (Schema)

The `NotificationType` enum already includes:
- `SUBSCRIPTION_PAYMENT_FAILED` -- for SUBS-07
- `SUBSCRIPTION_EXPIRED` -- for SUBS-06

### User Role Enum

The `UserRole` enum has `USER`, `SUBSCRIBER`, `ADMIN`. When a user upgrades to BASIC, their role should change from `USER` to `SUBSCRIBER`. On downgrade, revert to `USER`.

### Contracts Package

File: `packages/contracts/src/collection.ts`

```typescript
export const COLLECTION_LIMITS = {
  FREE: 50,
  BASIC: 200,
} as const;
```

This is the single source of truth for collection limits per plan. The subscription service should reference this when returning plan info to the frontend.

### PlanConfig Missing from Seed

The current seed does not create PlanConfig rows. Phase 6 must seed:
- FREE MONTHLY: R$0.00, 50 items, 10% commission, 0 trial days
- BASIC MONTHLY: R$X.XX, 200 items, 8% commission, N trial days
- BASIC QUARTERLY: (discounted)
- BASIC SEMIANNUAL: (discounted)
- BASIC ANNUAL: (discounted)

Prices TBD by the user -- the seed should include reasonable defaults.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── modules/
│   └── subscriptions/
│       ├── subscriptions.routes.ts    # Checkout session, portal session, plan list, admin CRUD
│       └── subscriptions.service.ts   # Stripe SDK calls, subscription lifecycle logic
├── shared/
│   ├── lib/
│   │   └── stripe.ts                 # Stripe SDK client, isStripeConfigured(), constructEvent()
│   └── cron/
│       └── index.ts                  # Extended: subscription grace period check
packages/contracts/src/
└── subscription.ts                   # Zod schemas for plan config, subscription status, etc.
```

### Pattern 1: Stripe SDK Abstraction (`shared/lib/stripe.ts`)

**What:** Conditional Stripe client initialization following the MercadoPago pattern.
**When to use:** All Stripe interactions.
**Example:**
```typescript
import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: '2026-02-25.clover' })
  : null;

export function isStripeConfigured(): boolean {
  return !!secretKey;
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !stripe) {
    throw new Error('Stripe webhook secret not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
```

### Pattern 2: Stripe Checkout Session Creation

**What:** Create a Checkout Session for subscription billing.
**When to use:** When user clicks "Upgrade to BASIC".
**Example:**
```typescript
export async function createCheckoutSession(userId: string, priceId: string) {
  if (!stripe) throw new BadRequestError('Stripe not configured');

  // Find or create Stripe customer
  let subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const customer = await stripe.customers.create({
      email: user!.email,
      name: user!.name,
      metadata: { comicstrunkUserId: userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.WEB_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.WEB_URL}/subscription/cancel`,
    subscription_data: {
      trial_period_days: planConfig.trialDays || undefined,
      metadata: { comicstrunkUserId: userId },
    },
    metadata: { comicstrunkUserId: userId },
  });

  return { url: session.url, sessionId: session.id };
}
```

### Pattern 3: Customer Portal Session

**What:** Create a Customer Portal session for self-service subscription management.
**When to use:** When user clicks "Manage Subscription" in account settings.
**Example:**
```typescript
export async function createPortalSession(userId: string) {
  if (!stripe) throw new BadRequestError('Stripe not configured');

  const subscription = await prisma.subscription.findFirst({
    where: { userId, stripeCustomerId: { not: null } },
  });

  if (!subscription?.stripeCustomerId) {
    throw new BadRequestError('No active subscription found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.WEB_URL}/account/subscription`,
  });

  return { url: session.url };
}
```

### Pattern 4: Webhook Handler for Subscription Events

**What:** Process Stripe webhook events for subscription lifecycle.
**When to use:** POST `/api/v1/webhooks/stripe` endpoint.
**Example:**
```typescript
// CRITICAL: This route must receive the raw body (not parsed JSON)
// Register BEFORE express.json() or use express.raw() middleware

export async function processStripeWebhook(rawBody: Buffer, signature: string) {
  const event = verifyWebhookSignature(rawBody, signature);

  // Idempotency guard (reuse WebhookEvent pattern)
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payload: event.data as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return; // Duplicate event
    }
    throw error;
  }

  // Route event to handler
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  // Mark as processed
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: 'stripe', eventId: event.id } },
    data: { processedAt: new Date() },
  });
}
```

### Pattern 5: Subscription Event Handlers

**checkout.session.completed:**
```typescript
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.comicstrunkUserId;
  if (!userId || session.mode !== 'subscription') return;

  const stripeSubscription = await stripe!.subscriptions.retrieve(
    session.subscription as string,
  );

  await prisma.$transaction(async (tx) => {
    // Create or update Subscription record
    await tx.subscription.upsert({
      where: { /* find by userId + latest */ },
      create: {
        userId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        planType: 'BASIC',
        status: stripeSubscription.status === 'trialing' ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
      update: { ... },
    });

    // Update user role to SUBSCRIBER
    await tx.user.update({
      where: { id: userId },
      data: { role: 'SUBSCRIBER' },
    });
  });
}
```

**customer.subscription.deleted:**
```typescript
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });
  if (!subscription) return;

  await prisma.$transaction(async (tx) => {
    // Downgrade subscription
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        planType: 'FREE',
        cancelledAt: new Date(),
      },
    });

    // Revert user role (unless admin)
    const user = await tx.user.findUnique({ where: { id: subscription.userId } });
    if (user && user.role !== 'ADMIN') {
      await tx.user.update({
        where: { id: subscription.userId },
        data: { role: 'USER' },
      });
    }
  });

  // Create notification (SUBS-06)
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Assinatura expirada',
      message: 'Sua assinatura BASIC expirou. Seu plano foi revertido para FREE.',
    },
  });
}
```

**invoice.payment_failed:**
```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });
  if (!subscription) return;

  // Update status to PAST_DUE
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'PAST_DUE' },
  });

  // Create notification (SUBS-07)
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: 'SUBSCRIPTION_PAYMENT_FAILED',
      title: 'Falha no pagamento da assinatura',
      message: 'Houve uma falha no pagamento da sua assinatura. Atualize seu meio de pagamento.',
    },
  });
}
```

### Pattern 6: Raw Body Middleware for Stripe Webhooks

**What:** Capture raw body before JSON parsing for Stripe signature verification.
**When to use:** Must be registered BEFORE `express.json()`.
**Example approach (recommended):**
```typescript
// In create-app.ts, register Stripe webhook route BEFORE express.json()

// Option A: Register raw route before json middleware
app.use(
  '/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes,
);

// THEN apply express.json() for all other routes
app.use(express.json());
```

This is the cleanest approach -- the webhook route gets `req.body` as a Buffer (raw), while all other routes get parsed JSON.

### Anti-Patterns to Avoid

- **Storing Stripe Price IDs only in code:** Store in PlanConfig or env vars so admin can update without code changes.
- **Trusting webhook payload without signature verification:** Always use `stripe.webhooks.constructEvent()` -- never skip signature validation.
- **Applying `express.json()` before the Stripe webhook route:** Stripe signature verification requires the raw body bytes. Must use `express.raw()` for the webhook endpoint.
- **Building custom subscription management UI:** Stripe Customer Portal handles cancellation, payment method updates, invoice history. Use it.
- **Polling Stripe for subscription status:** Use webhooks as the primary mechanism. Only poll as a fallback for missed webhooks.
- **Immediately revoking access on cancellation:** SUBS-05 requires end-of-period cancellation. User keeps benefits until `currentPeriodEnd`.
- **Deleting collection items on downgrade:** COLL-08 explicitly states existing items are preserved -- only new additions are blocked.
- **Creating a new Stripe customer on every checkout:** Check for existing `stripeCustomerId` in the Subscription table first.

## Webhook Events to Handle

| Event | When Fired | Action |
|-------|-----------|--------|
| `checkout.session.completed` | User completes Checkout payment | Create/update Subscription record (BASIC, ACTIVE), update User role to SUBSCRIBER, store stripeCustomerId and stripeSubscriptionId |
| `customer.subscription.updated` | Subscription renewed, plan changed, `cancel_at_period_end` set | Update `currentPeriodStart`, `currentPeriodEnd`, `cancelledAt` (if cancellation scheduled), `status` |
| `customer.subscription.deleted` | Subscription cancelled (end of period reached) or payment fails all retries | Downgrade to FREE, set status CANCELLED, revert User role to USER, create SUBSCRIPTION_EXPIRED notification |
| `invoice.payment_failed` | Automatic payment collection fails | Set Subscription status to PAST_DUE, create SUBSCRIPTION_PAYMENT_FAILED notification |
| `invoice.paid` | Invoice successfully paid (renewal) | Update `currentPeriodStart`/`currentPeriodEnd`, confirm status ACTIVE |

**Note:** Stripe does NOT guarantee event delivery order. Design handlers to be idempotent and order-independent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment page | Custom payment form | Stripe Checkout (hosted page) | PCI compliance, 3DS/SCA handling, localized payment methods. Zero frontend payment code needed. |
| Subscription management | Custom cancel/update payment UI | Stripe Customer Portal | Free, maintained by Stripe, handles all edge cases (proration, retry, invoice download). |
| Recurring billing engine | Cron-based charge scheduling | Stripe Billing | Stripe handles retry logic (Smart Retries), dunning emails, proration, tax calculation. |
| Webhook signature validation | Custom HMAC logic | `stripe.webhooks.constructEvent()` | SDK handles timing-safe comparison, header parsing, error formatting. |
| Invoice generation | Custom PDF generation | Stripe Invoices | Stripe auto-generates invoices with line items, tax, and download links. |
| Payment retry logic | Custom retry with exponential backoff | Stripe Smart Retries | Stripe uses ML to optimize retry timing per card network. |

## Common Pitfalls

### Pitfall 1: express.json() destroys raw body needed for Stripe webhook verification
**What goes wrong:** `stripe.webhooks.constructEvent()` throws "No signatures found matching the expected signature" because the body was already parsed by `express.json()`.
**Why it happens:** Express JSON middleware parses the body and replaces `req.body` with a JavaScript object. Stripe needs the original bytes for HMAC verification.
**How to avoid:** Register the Stripe webhook route with `express.raw({ type: 'application/json' })` BEFORE `express.json()` is applied. This is different from the Mercado Pago webhook, which validates from headers and parsed fields.
**Warning signs:** Webhook returns 400 with signature mismatch error in production but works in dev (where secret may be skipped).

### Pitfall 2: Not handling trial-to-paid transition
**What goes wrong:** User's trial ends, Stripe charges them, but local system still shows TRIALING status.
**Why it happens:** The `customer.subscription.updated` event fires when the trial ends and Stripe transitions to active billing. If not handled, the local status is stale.
**How to avoid:** In the `customer.subscription.updated` handler, always sync the status field from `stripeSubscription.status`. Map Stripe statuses to local enum: `active` -> ACTIVE, `trialing` -> TRIALING, `past_due` -> PAST_DUE, `canceled` -> CANCELLED.

### Pitfall 3: User creates multiple subscriptions
**What goes wrong:** User clicks "Upgrade" multiple times, creating multiple Stripe subscriptions and Subscription records.
**Why it happens:** No guard against creating a Checkout Session when user already has an active subscription.
**How to avoid:** Before creating a Checkout Session, check if user already has an ACTIVE or TRIALING subscription. If yes, redirect to Customer Portal instead. Also set `allow_promotion_codes: true` on Checkout if desired.

### Pitfall 4: Stripe Customer ID not persisted on first checkout
**What goes wrong:** User completes checkout but `stripeCustomerId` is not saved. Subsequent operations (Portal, webhook matching) fail.
**Why it happens:** The Checkout Session creates a Stripe customer automatically if none is provided, but the system doesn't record it.
**How to avoid:** In `checkout.session.completed`, always extract `session.customer` and store in the Subscription record. Use `metadata.comicstrunkUserId` to link back to the local user.

### Pitfall 5: Webhook events arrive out of order
**What goes wrong:** `customer.subscription.deleted` arrives before `checkout.session.completed`, or `invoice.paid` arrives before the subscription update.
**Why it happens:** Stripe explicitly does NOT guarantee event delivery order.
**How to avoid:** Design each handler to be independent. Use `stripeSubscriptionId` to find/create local records. If a subscription record doesn't exist yet when a webhook arrives, log a warning and skip (the `checkout.session.completed` will create it). Consider a short retry delay for unmatched events.

### Pitfall 6: Stripe webhook endpoint not receiving events in development
**What goes wrong:** No webhook events arrive during local development.
**Why it happens:** Stripe cannot reach `localhost`.
**How to avoid:** Use the Stripe CLI (`stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe`) for local development. This creates a temporary webhook secret and forwards events. Alternatively, design the system to work without webhooks in dev mode (admin manual activation, similar to Phase 5's MercadoPago approach).

### Pitfall 7: PlanConfig not seeded
**What goes wrong:** Subscription endpoints return empty plan lists. Frontend has nothing to display.
**Why it happens:** PlanConfig rows not created in seed.
**How to avoid:** Add PlanConfig seed data with reasonable defaults. This is consistent with the project's seed-first approach (see MEMORY.md: seed violations).

## Schema Considerations

### Missing Field: `stripePriceId` on PlanConfig

The current `PlanConfig` model does not have a field to store the Stripe Price ID. Each plan configuration (e.g., BASIC MONTHLY, BASIC ANNUAL) corresponds to a Stripe Price object. Options:

**Option A (Recommended): Add `stripePriceId` field to PlanConfig**
```prisma
model PlanConfig {
  // ... existing fields
  stripePriceId   String?         @map("stripe_price_id")
}
```
- Pro: Admin can manage Stripe Price associations via the admin panel
- Pro: No code changes needed when prices change (just update the record)
- Con: Requires a migration (but it's additive/nullable, so non-destructive)

**Option B: Store in environment variables**
```
STRIPE_PRICE_BASIC_MONTHLY=price_xxx
STRIPE_PRICE_BASIC_QUARTERLY=price_yyy
STRIPE_PRICE_BASIC_ANNUAL=price_zzz
```
- Pro: No migration needed
- Con: Requires deploy for price changes, not admin-manageable

**Decision: Go with Option A.** Add a nullable `stripePriceId` String? field to PlanConfig. This is a safe, additive migration.

### Subscription Lookup Pattern

The existing code (collection service, commission service) uses:
```typescript
const subscription = await tx.subscription.findFirst({
  where: { userId, status: 'ACTIVE' },
  orderBy: { createdAt: 'desc' },
});
```

This pattern supports plan history (multiple Subscription records per user) and correctly picks the most recent active subscription. The new subscription service should create new Subscription records rather than updating old ones, to preserve history.

However, `TRIALING` status should also grant plan benefits. The query should be updated to:
```typescript
where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
```

## Environment Variables

Add to `apps/api/.env.example`:
```bash
# Stripe credentials
STRIPE_SECRET_KEY=""           # sk_test_xxx for sandbox, sk_live_xxx for production
STRIPE_WEBHOOK_SECRET=""       # whsec_xxx from Stripe Dashboard or CLI
STRIPE_PUBLISHABLE_KEY=""      # pk_test_xxx (passed to frontend for Checkout redirect)
```

Add to `apps/web/.env.example`:
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""  # pk_test_xxx for Stripe.js (if needed)
```

## Stripe Dashboard Setup (Manual Steps)

Before the API can create subscriptions, the following must be configured in the Stripe Dashboard:

1. **Create a Product** (e.g., "Comics Trunk BASIC Plan")
2. **Create Prices** for each billing interval:
   - BASIC Monthly: R$ X.XX/month (recurring)
   - BASIC Quarterly: R$ X.XX/quarter (recurring)
   - BASIC Semi-annual: R$ X.XX/6 months (recurring)
   - BASIC Annual: R$ X.XX/year (recurring)
3. **Configure Customer Portal** (Settings > Customer Portal):
   - Enable "Cancel subscription" (at end of period)
   - Enable "Update payment method"
   - Add the product to the portal's subscription list
   - Set default return URL
4. **Create Webhook Endpoint** (Developers > Webhooks):
   - URL: `{API_PUBLIC_URL}/api/v1/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
5. **Copy secrets** to `.env`:
   - Secret key -> `STRIPE_SECRET_KEY`
   - Webhook signing secret -> `STRIPE_WEBHOOK_SECRET`
   - Publishable key -> `STRIPE_PUBLISHABLE_KEY`

For development, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
# This outputs a webhook secret (whsec_xxx) to use as STRIPE_WEBHOOK_SECRET
```

## API Endpoints

### User-Facing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/subscriptions/plans` | Public | List active plan configs with prices |
| GET | `/api/v1/subscriptions/status` | Auth | Get current user's subscription status |
| POST | `/api/v1/subscriptions/checkout` | Auth | Create Stripe Checkout Session, return URL |
| POST | `/api/v1/subscriptions/portal` | Auth | Create Stripe Customer Portal session, return URL |
| POST | `/api/v1/subscriptions/cancel` | Auth | Schedule cancellation at end of period |

### Webhook
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/webhooks/stripe` | Stripe signature | Receive and process Stripe webhook events |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/subscriptions/admin/list` | Admin | List all subscriptions with filters |
| POST | `/api/v1/subscriptions/admin/activate` | Admin | Manually activate a subscription (dev mode) |
| GET | `/api/v1/subscriptions/admin/plans` | Admin | List all plan configs (including inactive) |
| POST | `/api/v1/subscriptions/admin/plans` | Admin | Create a plan config |
| PUT | `/api/v1/subscriptions/admin/plans/:id` | Admin | Update a plan config |

## Key Decisions and Trade-offs

### Decision 1: Stripe Checkout vs Stripe Elements
**Chosen:** Stripe Checkout (hosted page)
**Rationale:** Checkout handles PCI compliance, 3DS/SCA, payment method collection, and localization out of the box. Elements would give more UI control but require significantly more frontend work and PCI responsibility. For v1, the redirect-based flow is simpler and safer.
**Trade-off:** User leaves the site briefly to pay on Stripe's page. The `success_url` and `cancel_url` bring them back.

### Decision 2: Customer Portal vs Custom Management
**Chosen:** Stripe Customer Portal
**Rationale:** The Portal provides cancellation, payment method updates, and invoice history for free. Building a custom UI would require implementing all of this from scratch plus handling edge cases (proration, retry states, payment method validation).
**Trade-off:** Less control over the UI. The Portal's appearance can be customized in the Stripe Dashboard (logo, colors, etc.) but not deeply.

### Decision 3: One Subscription record per lifecycle event vs. updating in place
**Chosen:** Create new records for new subscriptions, update existing for lifecycle changes
**Rationale:** The existing `findFirst({ orderBy: { createdAt: 'desc' } })` pattern supports history. When a user re-subscribes after cancellation, create a new record. For updates within a subscription (renewal, payment failure), update the existing record.

### Decision 4: Raw body handling for Stripe webhooks
**Chosen:** Register Stripe webhook route with `express.raw()` BEFORE `express.json()`
**Rationale:** Cleanest solution. The webhook route gets `req.body` as a Buffer, all other routes get parsed JSON. No need for a complex middleware chain or `req.rawBody` hack.

### Decision 5: Dev mode without Stripe
**Chosen:** Admin manual activation endpoint (similar to Phase 5 MercadoPago pattern)
**Rationale:** Stripe sandbox works well (unlike MercadoPago PIX sandbox), but having an admin override is useful for testing and for environments where Stripe credentials are not available. The `isStripeConfigured()` guard controls the flow.

## Open Questions

1. **Plan pricing**
   - What we know: BASIC plan with monthly, quarterly, semi-annual, and annual billing intervals. Commission rate is 8% for BASIC (vs 10% FREE).
   - What's unclear: Actual BRL prices for each interval. Whether quarterly/semi-annual/annual get a discount.
   - Recommendation: Seed with placeholder prices (e.g., R$9.90/month, R$24.90/quarter, R$44.90/semi-annual, R$79.90/annual). User can adjust via admin panel.

2. **Trial period duration**
   - What we know: `PlanConfig.trialDays` field exists. Stripe supports up to 730 days.
   - What's unclear: How many days for the BASIC plan trial. Whether all billing intervals share the same trial.
   - Recommendation: Default to 7 days. Configurable per PlanConfig row.

3. **Payment method collection during trial**
   - What we know: Stripe Checkout can be configured with `payment_method_collection: 'if_required'` to skip payment details during trial.
   - What's unclear: Whether to require payment method upfront (reduces trial abuse) or not (increases trial signups).
   - Recommendation: Require payment method upfront (`payment_method_collection: 'always'`). This is the standard SaaS approach and reduces involuntary churn at trial end.

4. **Stripe Product and Price creation method**
   - What we know: Need Stripe Products/Prices before creating Checkout Sessions.
   - What's unclear: Whether to create them via Stripe Dashboard (manual) or via API (programmatic).
   - Recommendation: Create via Dashboard for v1 (simpler, visual). Store Price IDs in PlanConfig. For v2, consider API-based creation from admin panel.

5. **`stripePriceId` migration**
   - What we know: PlanConfig needs a `stripePriceId` field. It's an additive nullable field.
   - What's unclear: Whether the user prefers to add this field now or keep it in env vars.
   - Recommendation: Add the field via migration. It's safe (nullable, additive) and makes admin management easier.

6. **Handling `TRIALING` status in existing plan limit checks**
   - What we know: Current code only checks `status: 'ACTIVE'`. Trialing users should also get BASIC benefits.
   - What's unclear: Whether to update collection.service.ts and commission.service.ts now or wait for Phase 6 implementation.
   - Recommendation: Update during Phase 6 implementation. Change the query to `status: { in: ['ACTIVE', 'TRIALING'] }`.

## Sources

### Primary (HIGH confidence)
- [Stripe Node.js SDK (npm)](https://www.npmjs.com/package/stripe) - v20.x, TypeScript support, API version 2026-02-25
- [Stripe Checkout Sessions (Subscriptions)](https://docs.stripe.com/billing/quickstart) - Hosted payment page for subscriptions
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal) - Self-service subscription management
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Event types and lifecycle
- [Stripe Webhook Signature Verification](https://docs.stripe.com/webhooks/signature) - `constructEvent()` and raw body requirement
- [Stripe Trial Periods](https://docs.stripe.com/billing/subscriptions/trials) - `subscription_data.trial_period_days`
- [Stripe Cancel Subscriptions](https://docs.stripe.com/billing/subscriptions/cancel) - `cancel_at_period_end` pattern
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create) - Create session parameters

### Secondary (MEDIUM confidence)
- [Stripe Subscription Integration in Node.js Guide](https://dev.to/ivanivanovv/stripe-subscription-integration-in-nodejs-2024-ultimate-guide-2ba3) - Community guide with full flow examples
- [stripe-samples/checkout-single-subscription (GitHub)](https://github.com/stripe-samples/checkout-single-subscription) - Official sample with 8 server implementations
- [Stripe Billing Portal Session Create API](https://docs.stripe.com/api/customer_portal/sessions/create) - Portal session parameters

### Tertiary (LOW confidence)
- Stripe CLI for local webhook forwarding -- mentioned in docs, recommended for development testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Stripe is the de facto payment/subscription provider. SDK is official, well-maintained, TypeScript-native.
- Architecture: HIGH - Follows existing project patterns (module structure, Prisma, SDK abstraction, webhook idempotency). Raw body handling is the only non-trivial integration concern.
- Pitfalls: HIGH - Stripe webhook signature verification with Express is extremely well-documented. The raw body issue is the #1 reported issue in stripe-node GitHub.

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (Stripe SDK and API are stable; check for major version bumps)
