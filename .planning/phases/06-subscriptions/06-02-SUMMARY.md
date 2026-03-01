---
phase: "06-subscriptions"
plan: "02"
subsystem: "Stripe Webhook Processing"
tags: ["stripe", "webhooks", "subscriptions", "idempotency", "payments"]
dependency_graph:
  requires: ["shared/lib/stripe.ts (from 06-01)", "WebhookEvent table (Phase 5)"]
  provides: ["POST /api/v1/webhooks/stripe endpoint", "processStripeWebhook service"]
  affects: ["Subscription records", "User roles", "Notification records"]
tech_stack:
  added: ["stripe@^20.4.0 (already installed by 06-01)"]
  patterns: ["Webhook idempotency via WebhookEvent table", "express.raw() before express.json()", "Stripe API v2026-02-25.clover period dates on SubscriptionItem"]
key_files:
  created:
    - "apps/api/src/modules/subscriptions/stripe-webhook.service.ts"
    - "apps/api/src/modules/subscriptions/stripe-webhook.routes.ts"
  modified:
    - "apps/api/src/shared/lib/stripe.ts"
    - "apps/api/src/create-app.ts"
decisions:
  - "Dev mode: when STRIPE_WEBHOOK_SECRET is not set, skip signature verification and parse raw body as JSON (warning logged)"
  - "Stripe v20 (API 2026-02-25.clover): current_period_start/end moved from Subscription to SubscriptionItem — access via items.data[0]"
  - "Invoice subscription ID accessed via invoice.parent.subscription_details.subscription (v20 breaking change)"
  - "Webhook always returns 200 even on handler errors to prevent Stripe retries for non-recoverable failures"
metrics:
  completed_date: "2026-02-27"
  tasks_completed: 2
  tasks_total: 2
requirements:
  - SUBS-04
  - SUBS-05
  - SUBS-06
  - SUBS-07
---

# Phase 06 Plan 02: Stripe Webhook Processing Summary

Stripe webhook endpoint with idempotent processing for 5 subscription lifecycle events, raw body middleware for signature verification, and automatic user role management.

## What Was Built

### 1. Stripe Webhook Service (`stripe-webhook.service.ts`)

Main entry point `processStripeWebhook(rawBody, signature)` with:

- **Signature verification** via `verifyWebhookSignature()` from shared lib (dev mode skips verification)
- **Idempotency guard** using `WebhookEvent` table with `provider: 'stripe'` and P2002 catch for duplicates
- **Event router** dispatching to 5 handlers:
  - `checkout.session.completed` -- Creates/updates Subscription record (BASIC, ACTIVE/TRIALING), upgrades user role to SUBSCRIBER (ADMIN untouched)
  - `customer.subscription.updated` -- Syncs period dates, maps Stripe status to local enum, handles cancel_at_period_end scheduling/reactivation
  - `customer.subscription.deleted` -- Downgrades to FREE, reverts user role to USER, creates SUBSCRIPTION_EXPIRED notification
  - `invoice.payment_failed` -- Sets subscription to PAST_DUE, creates SUBSCRIPTION_PAYMENT_FAILED notification
  - `invoice.paid` -- Reactivates PAST_DUE/TRIALING subscriptions to ACTIVE, restores SUBSCRIBER role

Helper functions handle Stripe v20 API differences:
- `getSubscriptionPeriod()` -- extracts period dates from `items.data[0]` (not top-level)
- `getSubscriptionIdFromInvoice()` -- extracts subscription ID from `invoice.parent.subscription_details`

### 2. Stripe Webhook Routes (`stripe-webhook.routes.ts`)

POST `/` handler that:
- Extracts `stripe-signature` header (returns 400 if missing)
- Passes raw Buffer body to `processStripeWebhook()`
- Always returns 200 with `{ received: true }` (even on errors, to prevent Stripe retries)

### 3. Route Registration in `create-app.ts`

Critical middleware ordering:
1. helmet, cors (security)
2. **Stripe webhook with `express.raw({ type: 'application/json' })`** (line 44-48)
3. `express.json()`, cookieParser (line 51-52)

The Stripe webhook route is registered BEFORE `express.json()` so the request body arrives as a raw Buffer for signature verification.

### 4. Updated `shared/lib/stripe.ts`

Modified `verifyWebhookSignature()` to support dev mode: when `STRIPE_WEBHOOK_SECRET` is not set, the function parses the raw body as JSON directly (with a console warning) instead of throwing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stripe v20 API breaking changes for period dates**
- **Found during:** Task 1 (initial build)
- **Issue:** Stripe API v2026-02-25.clover moved `current_period_start` and `current_period_end` from the `Subscription` object to `SubscriptionItem`. Also, `Invoice.subscription` was moved to `Invoice.parent.subscription_details.subscription`.
- **Fix:** Created helper functions `getSubscriptionPeriod()` and `getSubscriptionIdFromInvoice()` to abstract the v20 type paths
- **Files modified:** `stripe-webhook.service.ts`

**2. [Rule 3 - Blocking] TypeScript type cast for webhook payload**
- **Found during:** Task 1 (initial build)
- **Issue:** `event.data as Prisma.InputJsonValue` failed because the Stripe event data type doesn't overlap with Prisma's InputJsonValue
- **Fix:** Used double cast `as unknown as Prisma.InputJsonValue`
- **Files modified:** `stripe-webhook.service.ts`

**3. [Rule 3 - Blocking] session.subscription type handling**
- **Found during:** Task 1 (initial build)
- **Issue:** `session.subscription` is `string | Stripe.Subscription | null`, not just `string`
- **Fix:** Added type-safe extraction: `typeof session.subscription === 'string' ? session.subscription : session.subscription?.id`
- **Files modified:** `stripe-webhook.service.ts`

## Verification Results

- `pnpm --filter api build` -- PASSES
- `pnpm --filter api type-check` -- PASSES
- `express.raw()` registered at line 47, `express.json()` at line 52 in create-app.ts -- CORRECT ORDER
- All 5 event types handled: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed, invoice.paid
- Idempotency guard uses WebhookEvent table with provider='stripe' and catches P2002
- NotificationType values: SUBSCRIPTION_PAYMENT_FAILED, SUBSCRIPTION_EXPIRED -- both valid in schema
- User role changes: USER->SUBSCRIBER on upgrade, SUBSCRIBER->USER on downgrade, ADMIN never modified
