---
phase: 05-payments-and-commissions
plan: 03
subsystem: payments, commissions
tags: [admin-approval, refund, payment-history, commission-dashboard, payment-management]
dependency_graph:
  requires: [payments-service, commission-service, order-state-machine, mercadopago-client]
  provides: [admin-payment-approval, admin-payment-rejection, refund-payment, user-payment-history, admin-pending-payments, admin-payment-list, commission-dashboard, commission-transactions]
  affects: [order-lifecycle, order-item-transitions]
tech_stack:
  added: []
  patterns: [PaymentRefund-sdk-class, raw-sql-aggregation, rate-grouped-dashboard]
key_files:
  created: []
  modified:
    - apps/api/src/modules/payments/payments.service.ts
    - apps/api/src/modules/payments/payments.routes.ts
    - apps/api/src/modules/commission/commission.service.ts
    - apps/api/src/modules/commission/commission.routes.ts
    - apps/api/src/shared/lib/mercadopago.ts
    - apps/api/src/shared/lib/order-state-machine.ts
decisions:
  - "Used Mercado Pago PaymentRefund class (separate from Payment) for refunds: mpRefund.total() for full, mpRefund.create() for partial"
  - "Added PAID -> REFUNDED transition to ORDER_ITEM_TRANSITIONS state machine for refund support"
  - "Admin approval creates Payment record if none exists (for cases where PIX was never initiated)"
  - "Refund continues even if Mercado Pago SDK call fails (admin can retry, local record still updates)"
  - "Commission dashboard uses Prisma $queryRaw for efficient GROUP BY aggregation by commission rate"
metrics:
  duration: 8min
  completed: 2026-02-27
---

# Phase 5 Plan 3: Payment Management and Commission Dashboard Summary

Admin payment lifecycle management (approve/reject/refund) with user payment history, plus commission reporting dashboard with rate-grouped aggregation and paginated transaction list.

## What Was Built

### Task 1: Admin Payment Approval, Refund, and User Payment History

**Payment service** extended with 6 new functions in `apps/api/src/modules/payments/payments.service.ts`:

- `adminApprovePayment(orderId)` -- Validates PENDING order, finds or creates Payment record, calls existing `processPaymentConfirmation()` (same flow as webhook) for consistency, updates payment with paidAt and approved status
- `adminRejectPayment(orderId)` -- Validates PENDING order, transitions order to CANCELLED and all PENDING items to CANCELLED within `$transaction`, marks payment as rejected
- `refundPayment(paymentId, amount?)` -- Validates payment was completed (has paidAt), calculates refund amount (full if no amount provided), calls Mercado Pago `PaymentRefund.total()` or `PaymentRefund.create()` with try/catch (continues on SDK failure), updates refundedAmount, on full refund transitions PAID items to REFUNDED and order to CANCELLED
- `getUserPaymentHistory(userId, page, limit)` -- Queries payments joined with orders where buyerId matches, includes order details (orderNumber, status, totalAmount, createdAt), sorted desc, paginated
- `adminListPendingPayments(page, limit)` -- Queries PENDING orders that have Payment records (PIX initiated but unconfirmed), includes payment data and buyer info, sorted by createdAt asc (oldest first = most urgent)
- `adminListAllPayments(filters)` -- All payments with optional providerStatus filter, includes order and buyer info, sorted desc, paginated

**Payment routes** extended in `apps/api/src/modules/payments/payments.routes.ts`:

- `GET /history` -- Authenticated, user's payment history (paginated)
- `POST /admin/approve` -- ADMIN, validates body with `adminApprovePaymentSchema`
- `POST /admin/reject` -- ADMIN, validates body with `adminApprovePaymentSchema` (same schema: `{ orderId }`)
- `GET /admin/pending` -- ADMIN, paginated pending payments list
- `GET /admin/list` -- ADMIN, paginated all payments with optional status filter
- `POST /:paymentId/refund` -- ADMIN, validates body with `refundPaymentSchema` (optional amount for partial)

All static routes placed before parameterized routes in the Express router.

**Mercado Pago lib** (`apps/api/src/shared/lib/mercadopago.ts`):
- Added `PaymentRefund` import and `mpRefund` instance export (separate SDK class from `Payment`)

**Order state machine** (`apps/api/src/shared/lib/order-state-machine.ts`):
- Added `REFUNDED` to `ORDER_ITEM_TRANSITIONS.PAID` allowed transitions (was: `[PROCESSING, CANCELLED]`, now: `[PROCESSING, CANCELLED, REFUNDED]`)

### Task 2: Commission Dashboard Reporting

**Commission service** extended with 2 new functions in `apps/api/src/modules/commission/commission.service.ts`:

- `getCommissionDashboard(periodStart, periodEnd)` -- Uses `$queryRaw` for efficient SQL aggregation: groups order items by `commission_rate_snapshot` for orders in valid statuses (PAID, PROCESSING, SHIPPED, DELIVERED, COMPLETED) within date range. Returns `{ byPlan: [{rate, transactionCount, totalCommission, totalSales}], totals: {totalCommission, totalSales, transactionCount}, period: {start, end} }`
- `getCommissionTransactions(page, limit, periodStart?, periodEnd?)` -- Lists individual order items with commission data, joined with order (orderNumber, buyer), collection item (catalog entry title). Filters by paid/completed statuses and optional date range. Returns flattened records with all relevant fields, paginated.

**Commission routes** extended in `apps/api/src/modules/commission/commission.routes.ts`:

- `GET /admin/dashboard` -- ADMIN, required `periodStart` and `periodEnd` query params (ISO date or datetime), returns commission dashboard data
- `GET /admin/transactions` -- ADMIN, pagination + optional `periodStart`/`periodEnd`, returns paginated commission transaction list

Inline Zod schemas created for both endpoints:
- `commissionDashboardSchema` -- `periodStart` and `periodEnd` accepting ISO datetime or date strings
- `commissionTransactionsSchema` -- extends `paginationSchema` with optional period filters

Admin routes placed before parameterized `/configs/:id` route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mercado Pago SDK refund API uses separate PaymentRefund class**
- **Found during:** Task 1
- **Issue:** Plan assumed `mpPayment.refund()` method, but Mercado Pago SDK v2 uses a separate `PaymentRefund` class with `total()` and `create()` methods
- **Fix:** Added `PaymentRefund` import and `mpRefund` instance to `mercadopago.ts`, used `mpRefund.total({ payment_id })` for full refund and `mpRefund.create({ payment_id, body: { amount } })` for partial
- **Files modified:** `apps/api/src/shared/lib/mercadopago.ts`, `apps/api/src/modules/payments/payments.service.ts`

**2. [Rule 2 - Missing Critical] Order item state machine missing PAID -> REFUNDED transition**
- **Found during:** Task 1
- **Issue:** `ORDER_ITEM_TRANSITIONS` only allowed PAID items to transition to PROCESSING or CANCELLED, but refund flow needs REFUNDED
- **Fix:** Added `REFUNDED` to the PAID transitions array in `order-state-machine.ts`
- **Files modified:** `apps/api/src/shared/lib/order-state-machine.ts`

## Verification Results

1. TypeScript compilation: `pnpm --filter api build` -- no errors
2. Admin approval reuses `processPaymentConfirmation` (same as webhook) for consistency
3. Refund handles both total and partial amounts via Mercado Pago `PaymentRefund` SDK class
4. Payment history is buyer-scoped (only shows authenticated user's payments)
5. Commission dashboard uses `$queryRaw` for aggregation efficiency
6. All admin routes require `authorize('ADMIN')` middleware
7. Static routes placed before parameterized routes in both routers

## Self-Check: PASSED

All modified files verified present and contain expected functions/routes:
- `payments.service.ts`: 6 new exported functions (adminApprovePayment, adminRejectPayment, refundPayment, getUserPaymentHistory, adminListPendingPayments, adminListAllPayments)
- `payments.routes.ts`: 6 new routes (/history, /admin/approve, /admin/reject, /admin/pending, /admin/list, /:paymentId/refund)
- `commission.service.ts`: 2 new exported functions (getCommissionDashboard, getCommissionTransactions)
- `commission.routes.ts`: 2 new routes (/admin/dashboard, /admin/transactions)
- `mercadopago.ts`: PaymentRefund import and mpRefund export added
- `order-state-machine.ts`: REFUNDED added to PAID item transitions
- TypeScript compilation succeeds
