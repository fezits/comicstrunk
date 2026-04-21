---
phase: 05-payments-and-commissions
plan: 04
subsystem: payments-frontend
tags: [pix, qr-code, payment-ui, polling, countdown-timer]
dependency_graph:
  requires: [pix-payment-creation, payment-status-polling, payments-routes]
  provides: [pix-checkout-page, pix-qr-display, pix-countdown-timer, payment-api-client]
  affects: [checkout-flow, order-creation-redirect]
tech_stack:
  added: []
  patterns: [interval-based-polling, clipboard-api-with-fallback, state-machine-ui, brl-currency-formatting]
key_files:
  created:
    - apps/web/src/lib/api/payments.ts
    - apps/web/src/components/features/checkout/pix-qr-code.tsx
    - apps/web/src/components/features/checkout/pix-countdown-timer.tsx
    - apps/web/src/components/features/checkout/pix-payment-page.tsx
    - apps/web/src/app/[locale]/(collector)/checkout/payment/page.tsx
  modified:
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/components/features/checkout/checkout-page.tsx
decisions:
  - Payment amount formatted as BRL using Intl.NumberFormat('pt-BR') with amount/100 conversion from cents
  - Countdown timer uses color-coded urgency -- green above 5min, yellow 1-5min, red under 1min with pulse animation
  - QR code component includes clipboard fallback via textarea for browsers without navigator.clipboard API
  - Page uses Suspense boundary at route level to support useSearchParams in Next.js 15
  - Checkout page redirect updated from order detail to payment page after order creation
metrics:
  duration: 8min
  completed: 2026-02-27
---

# Phase 5 Plan 4: PIX Payment Checkout Page Summary

PIX payment page with QR code display, copia-e-cola copy button, countdown timer aligned with PIX expiry, 5-second status polling, and auto-transition to success/expired states.

## What Was Built

### Task 1: Payment API Client and PIX Display Components

**Payment API client** (`apps/web/src/lib/api/payments.ts`):
- `PaymentData` interface matching the backend payment response structure
- `initiatePayment(orderId)` -- POST `/payments/initiate` to create PIX payment
- `getPaymentStatus(orderId)` -- GET `/payments/{orderId}/status` for polling
- (Linter auto-added `PaymentHistoryItem`, `PaymentHistoryResponse`, and `getPaymentHistory` from concurrent plan work)

**PIX QR Code component** (`apps/web/src/components/features/checkout/pix-qr-code.tsx`):
- Renders base64 QR code image with white background padding for readability
- Graceful null handling: shows placeholder with QrCode icon when base64 is unavailable
- Copia-e-cola text displayed in monospace font within bordered container
- Copy button using `navigator.clipboard.writeText` with textarea fallback
- Visual feedback: button toggles to checkmark icon for 3 seconds after copy
- Sonner toast confirmation on successful copy

**PIX Countdown Timer** (`apps/web/src/components/features/checkout/pix-countdown-timer.tsx`):
- Calculates remaining seconds from ISO `expiresAt` string minus current time
- 1-second interval-based countdown displaying MM:SS format
- Three color states: green (>5min), yellow (1-5min), red (<1min with pulse animation)
- Fires `onExpired` callback when timer reaches zero
- Handles null expiresAt gracefully with "no time limit" badge
- Uses `useRef` for stable callback reference to prevent unnecessary re-renders

### Task 2: PIX Payment Page with Polling and Route

**PIX Payment Page** (`apps/web/src/components/features/checkout/pix-payment-page.tsx`):
- State machine with 6 states: `loading`, `awaiting_payment`, `processing`, `success`, `expired`, `error`
- On mount: reads `orderId` from URL search params, calls `initiatePayment`, determines initial state
- Polling: 5-second interval via `setInterval` when in `awaiting_payment` state, calls `getPaymentStatus`
- Auto-transitions: to `success` when `paidAt` set or `providerStatus === 'approved'`; to `error` on rejection
- Proper cleanup: polling interval cleared on unmount or state transition
- State-specific renders:
  - **loading**: Spinner + skeleton placeholder
  - **awaiting_payment**: QR code card + countdown timer + order total + polling indicator
  - **success**: Green checkmark, confirmation message, "Ver pedido" button
  - **expired**: Red X icon, expiry message, "Tentar novamente" button that re-initiates payment
  - **error**: Alert icon, error message, "Voltar ao pedido" button
- BRL formatting via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` with amount/100

**Route page** (`apps/web/src/app/[locale]/(collector)/checkout/payment/page.tsx`):
- `'use client'` directive for client-side state and polling
- Suspense boundary wrapping `PixPaymentPage` (required for `useSearchParams` in Next.js 15)
- Loading fallback with centered spinner

**i18n translations** -- 20 new keys added under `payments` namespace in pt-BR.json covering all UI states and labels.

**Checkout redirect** -- Updated `checkout-page.tsx` to redirect to `/checkout/payment?orderId={id}` after order creation instead of the order detail page, connecting the checkout flow to the payment page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Updated checkout redirect to payment page**
- **Found during:** Task 2
- **Issue:** Checkout page redirected to `/orders/{id}` after order creation, bypassing the new payment page
- **Fix:** Changed redirect to `/checkout/payment?orderId={id}` in `checkout-page.tsx`
- **Files modified:** `apps/web/src/components/features/checkout/checkout-page.tsx`

**2. [Rule 3 - Blocking issue] Added Suspense boundary for useSearchParams**
- **Found during:** Task 2
- **Issue:** Next.js 15 requires Suspense boundary when using `useSearchParams` at the route level
- **Fix:** Route page wraps `PixPaymentPage` in `<Suspense>` with spinner fallback
- **Files modified:** `apps/web/src/app/[locale]/(collector)/checkout/payment/page.tsx`

## Verification Results

1. `pnpm --filter contracts build` -- passed, no errors
2. `pnpm --filter web build` -- passed, `/[locale]/checkout/payment` route at 5.98 kB
3. All 5 created files verified present on disk
4. Payment API client has `initiatePayment` and `getPaymentStatus` functions
5. QR code component handles null QR code gracefully with placeholder
6. Countdown timer has interval-based countdown with `onExpired` callback and color-coded urgency
7. PIX payment page handles all 5 states with proper polling and cleanup
8. Polling interval is 5 seconds via `setInterval`
9. pt-BR.json has 20 payment translation keys under `payments` namespace
10. BRL formatting uses `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

## Self-Check: PASSED

All 5 created files verified present:
- `apps/web/src/lib/api/payments.ts` -- FOUND
- `apps/web/src/components/features/checkout/pix-qr-code.tsx` -- FOUND
- `apps/web/src/components/features/checkout/pix-countdown-timer.tsx` -- FOUND
- `apps/web/src/components/features/checkout/pix-payment-page.tsx` -- FOUND
- `apps/web/src/app/[locale]/(collector)/checkout/payment/page.tsx` -- FOUND

2 modified files verified:
- `apps/web/src/messages/pt-BR.json` -- payments keys present
- `apps/web/src/components/features/checkout/checkout-page.tsx` -- redirect updated

Build verification: `pnpm --filter web build` passed with payment route visible in output.
