---
phase: 05-payments-and-commissions
plan: 07
subsystem: payment-flow-integration, navigation
tags: [payment-status, order-detail, navigation, pix, sidebar]
dependency_graph:
  requires: [pix-payment-page, payment-history-page, seller-banking-page, admin-payments-page, admin-commission-page, admin-banking-page]
  provides: [order-payment-status-section, nav-phase5-links, complete-payment-flow]
  affects: [order-detail-page, sidebar-navigation, mobile-navigation]
tech_stack:
  added: []
  patterns: [fetch-on-mount-with-cleanup, inline-countdown-timer, nav-group-expansion]
key_files:
  created:
    - apps/web/src/components/features/orders/payment-status-section.tsx
  modified:
    - apps/web/src/components/features/orders/order-detail-page.tsx
    - apps/web/src/components/layout/nav-config.ts
    - apps/web/src/messages/pt-BR.json
decisions:
  - "Created a new Seller nav group for banking rather than mixing seller pages into the Account group"
  - "Payment status section fetches on mount and handles all 5 states: not started, pending, paid, expired, refunded"
  - "Inline ExpiryCountdown sub-component for compact MM:SS display within the pending state"
  - "Protected routes updated to include /payments/history and /seller/banking"
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 5 Plan 7: Payment Flow Integration and Navigation Updates Summary

Order detail page payment placeholder replaced with real PaymentStatusSection component that fetches payment data and displays state-specific UI (not started, pending, paid, expired, refunded). Sidebar navigation updated with 6 new links across 3 groups for all Phase 5 pages.

## What Was Built

### Task 1: Order Detail Payment Status Section

**PaymentStatusSection component** (`apps/web/src/components/features/orders/payment-status-section.tsx`):
- Client component with props `{ orderId, orderStatus }` that fetches payment data on mount via `getPaymentStatus(orderId)`
- Handles 5 distinct payment states:
  - **Not started** (no payment record): Shows "Pagamento nao iniciado" with AlertCircle icon. If order is PENDING, shows "Pagar com PIX" button linking to `/checkout/payment?orderId=xxx`
  - **Pending** (providerStatus === 'pending'): Yellow badge "Aguardando pagamento PIX" with Clock icon. Shows inline MM:SS countdown timer if pixExpiresAt is in the future. "Ir para pagamento" button links to payment page
  - **Paid** (paidAt set, no refund): Green badge "Pagamento confirmado" with CheckCircle2 icon. Shows payment date (DD/MM/YYYY HH:MM) and amount in BRL
  - **Expired** (pixExpiresAt in past, not paid): Red badge "PIX expirado" with AlertCircle icon. "Tentar novamente" button links to payment page
  - **Refunded** (refundedAmount > 0): Blue badge showing refund amount. For partial refunds, shows both original and refunded amounts
- Error handling: gracefully shows "not started" state if API returns error (payment may not exist for old orders)
- Includes inline `ExpiryCountdown` sub-component with 1-second interval-based countdown in MM:SS format
- BRL formatting via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` with amount/100 conversion

**Order detail page update** (`apps/web/src/components/features/orders/order-detail-page.tsx`):
- Removed CreditCard import (no longer used directly)
- Added PaymentStatusSection import
- Replaced static payment placeholder Card with `<PaymentStatusSection orderId={order.id} orderStatus={order.status} />`

**i18n translations**: Added 11 new keys to `orders` namespace: paymentNotStarted, payWithPix, awaitingPayment, goToPayment, paymentConfirmed, paymentDate, paymentAmount, refundAmount, pixExpired, retryPayment, expiresIn.

### Task 2: Navigation Updates for Phase 5 Pages

**Navigation config** (`apps/web/src/components/layout/nav-config.ts`):
- Added 4 new lucide-react icon imports: Receipt, Landmark, CreditCard, PieChart
- **Orders group**: Added "Historico de Pagamentos" link to `/payments/history` with Receipt icon
- **New Seller group**: Created with `requiresAuth: true`, containing "Contas Bancarias" link to `/seller/banking` with Landmark icon
- **Admin group**: Added 3 new items:
  - "Pagamentos" -> `/admin/payments` with CreditCard icon
  - "Comissoes" -> `/admin/commission` with PieChart icon
  - "Contas Bancarias" -> `/admin/banking` with Landmark icon
- **Protected routes**: Added `/payments/history` and `/seller/banking`

**i18n translations**: Added 5 new nav keys (paymentHistory, sellerBanking, adminPayments, adminCommission, adminBanking) and `seller` group label under `nav.groups`.

## Deviations from Plan

None - plan executed exactly as written. The checkout redirect to payment page was already done in plan 05-04, confirmed still in place.

## Verification Results

1. `pnpm --filter contracts build` -- passed
2. `pnpm --filter web build` -- passed, all routes compiled successfully
3. `payment-status-section.tsx` created and verified present on disk
4. `order-detail-page.tsx` imports PaymentStatusSection and renders it in place of placeholder
5. `nav-config.ts` has all 6 new navigation items across 3 groups
6. `pt-BR.json` has all new translation keys (11 orders keys + 6 nav keys)
7. Build output shows `/[locale]/orders/[id]` at 5.58 kB (includes payment section)
8. All Phase 5 route pages visible in build output: payments/history, seller/banking, admin/payments, admin/commission, admin/banking

## Self-Check: PASSED

Created files verified:
- `apps/web/src/components/features/orders/payment-status-section.tsx` -- FOUND

Modified files verified:
- `apps/web/src/components/features/orders/order-detail-page.tsx` -- PaymentStatusSection import present
- `apps/web/src/components/layout/nav-config.ts` -- 6 new nav items present
- `apps/web/src/messages/pt-BR.json` -- all new translation keys present

Build verification: `pnpm --filter web build` passed with all routes visible in output.
