---
phase: 05-payments-and-commissions
plan: 01
subsystem: payments
tags: [pix, mercadopago, webhook, payment-processing, idempotency]
dependency_graph:
  requires: [orders-service, order-state-machine, commission-service]
  provides: [pix-payment-creation, webhook-handler, payment-status-polling, mercadopago-client]
  affects: [order-lifecycle, create-app-routes]
tech_stack:
  added: [mercadopago@2.12.0, cpf-cnpj-validator]
  patterns: [webhook-idempotency-guard, hmac-signature-validation, dev-mode-fallback, cart-aligned-pix-expiry]
key_files:
  created:
    - packages/contracts/src/payments.ts
    - packages/contracts/src/banking.ts
    - apps/api/src/shared/lib/mercadopago.ts
    - apps/api/src/modules/payments/payments.service.ts
    - apps/api/src/modules/payments/payments.routes.ts
    - apps/api/src/modules/payments/webhook.routes.ts
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/create-app.ts
    - apps/api/.env.example
    - apps/api/package.json
decisions:
  - Dev mode fallback returns mock payment with null QR data and providerPaymentId prefixed with 'dev-' when MERCADOPAGO_ACCESS_TOKEN is not set
  - Webhook handler always returns 200 even on processing errors to prevent Mercado Pago retry storms
  - PIX expiry calculated from cart reservation TTL with 5-minute buffer, capped at 30 minutes max
  - Signature validation skipped gracefully when MERCADOPAGO_WEBHOOK_SECRET is not configured (dev mode)
  - Webhook idempotency uses Prisma P2002 unique constraint catch on WebhookEvent [provider, eventId]
metrics:
  duration: 4min
  completed: 2026-02-27
---

# Phase 5 Plan 1: PIX Payment Backend Summary

PIX payment infrastructure via Mercado Pago SDK with QR code generation, webhook idempotency, signature validation, and dev-mode fallback for local development without credentials.

## What Was Built

### Task 1: Contract Schemas and Mercado Pago SDK Client

**Contract schemas** created for both payments and banking domains:

- `packages/contracts/src/payments.ts` -- Zod schemas for `initiatePaymentSchema`, `paymentStatusSchema`, `adminApprovePaymentSchema`, `refundPaymentSchema`, `listPaymentsSchema` with inferred TypeScript types
- `packages/contracts/src/banking.ts` -- Zod schemas for `createBankAccountSchema`, `updateBankAccountSchema`, `bankAccountSchema` with inferred types
- Both exported from `packages/contracts/src/index.ts` barrel

**Mercado Pago SDK client** (`apps/api/src/shared/lib/mercadopago.ts`):
- `MercadoPagoConfig` initialized with access token and 10s timeout
- `mpPayment` -- Payment class instance for API calls (null when unconfigured)
- `isMercadoPagoConfigured()` -- boolean check for dev mode branching
- `validateWebhookSignature()` -- HMAC-SHA256 validation using `crypto.timingSafeEqual` for constant-time comparison; gracefully skips when webhook secret is not set

**Dependencies installed:** `mercadopago@^2.12.0`, `cpf-cnpj-validator` (for future bank account CPF validation)

**Environment variables** added to `.env.example`: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `API_PUBLIC_URL`

### Task 2: PIX Payment Service, Routes, and Webhook Handler

**Payment service** (`apps/api/src/modules/payments/payments.service.ts`):

- `initiatePixPayment(orderId, userId)` -- Validates order ownership and PENDING status, checks for existing non-expired payment, calculates PIX expiry aligned with cart reservation TTL (MIN(remaining_cart - 5min, 30min)), creates Mercado Pago PIX payment or dev-mode mock, upserts Payment record
- `getPaymentStatus(orderId, userId)` -- Returns payment with optional Mercado Pago polling to detect status changes; auto-triggers `processPaymentConfirmation` if polling reveals approval
- `processPaymentConfirmation(orderId)` -- Atomic transaction: order status PENDING->PAID, all PENDING items to PAID, payment paidAt + providerStatus updated
- `getPaymentByOrderId(orderId)` -- Simple lookup
- `processWebhookEvent(eventId, eventType, payload, dataId)` -- Idempotency guard via WebhookEvent insert (P2002 catch for duplicates), fetches Mercado Pago payment details as source of truth, triggers confirmation on approval, marks event as processed

**Payment routes** (`apps/api/src/modules/payments/payments.routes.ts`):
- `POST /api/v1/payments/initiate` -- Authenticated, validates body with `initiatePaymentSchema`, returns 201 with payment data
- `GET /api/v1/payments/:orderId/status` -- Authenticated, returns current payment status with optional MP polling

**Webhook routes** (`apps/api/src/modules/payments/webhook.routes.ts`):
- `POST /api/v1/webhooks/mercadopago` -- NO auth middleware (MP sends without JWT), signature validation, delegates to `processWebhookEvent`, always returns 200

**Routes mounted** in `create-app.ts`:
- `/api/v1/payments` -> `paymentsRoutes`
- `/api/v1/webhooks/mercadopago` -> `webhookRoutes`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. TypeScript compilation: `pnpm --filter contracts build && pnpm --filter api build` -- no errors
2. Contract exports: `payments.ts` and `banking.ts` properly exported from index
3. Webhook idempotency: `WebhookEvent` model with unique `[provider, eventId]` constraint used correctly via P2002 catch
4. PIX expiry alignment: service calculates expiry based on cart TTL with 5-min buffer, capped at 30 min
5. Dev mode fallback: When `MERCADOPAGO_ACCESS_TOKEN` is not set, payment creation succeeds with mock data (providerPaymentId: `dev-{orderId}`, null QR codes)
6. Signature validation: uses `crypto.timingSafeEqual` for constant-time comparison, skips if secret not configured
7. All files exist and are properly structured
8. Route mounts verified in create-app.ts

## Key Technical Details

- **Mercado Pago SDK v2:** Uses `new MercadoPagoConfig({ accessToken })` then `new Payment(client).create()` pattern
- **PIX response:** QR code from `point_of_interaction.transaction_data.qr_code_base64`, copia-e-cola from `qr_code`
- **Webhook signature:** Template `id:{dataId};request-id:{xRequestId};ts:{ts};` with HMAC-SHA256
- **Idempotency:** Insert WebhookEvent first, catch P2002 unique violation to skip duplicates
- **Payment confirmation:** Same function called by both webhook handler and polling fallback for consistency

## Self-Check: PASSED

All 7 created files verified present. Key patterns confirmed:
- `crypto.timingSafeEqual` in mercadopago.ts
- `P2002` idempotency guard in payments.service.ts
- Cart TTL alignment with 5-min buffer in payments.service.ts
- Contracts barrel exports payments and banking
- Routes mounted in create-app.ts
- TypeScript compilation succeeds for both contracts and API
