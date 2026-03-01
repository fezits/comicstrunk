---
phase: 05-payments-and-commissions
plan: 06
subsystem: admin-financial-ui
tags: [admin-payments, admin-commission, admin-banking, dashboard, pix-approval]
dependency_graph:
  requires: [payments-admin-api, commission-admin-api, banking-admin-api]
  provides: [admin-payments-page, admin-commission-page, admin-banking-page, admin-payment-approval-dialog]
  affects: [admin-navigation, i18n-translations]
tech_stack:
  added: []
  patterns: [ref-based-fetch-stable-callback, client-side-search-filter, masked-sensitive-data]
key_files:
  created:
    - apps/web/src/lib/api/admin-payments.ts
    - apps/web/src/lib/api/admin-commission.ts
    - apps/web/src/components/features/admin/payments/admin-payments-page.tsx
    - apps/web/src/components/features/admin/payments/pending-payments-table.tsx
    - apps/web/src/components/features/admin/payments/payment-approval-dialog.tsx
    - apps/web/src/components/features/admin/commission/admin-commission-page.tsx
    - apps/web/src/components/features/admin/commission/commission-summary-cards.tsx
    - apps/web/src/components/features/admin/commission/commission-transactions-table.tsx
    - apps/web/src/components/features/admin/banking/admin-banking-page.tsx
    - apps/web/src/app/[locale]/(admin)/admin/payments/page.tsx
    - apps/web/src/app/[locale]/(admin)/admin/commission/page.tsx
    - apps/web/src/app/[locale]/(admin)/admin/banking/page.tsx
  modified:
    - apps/web/src/messages/pt-BR.json
decisions:
  - "Used useRef for period values in commission page to avoid stale closures without eslint-disable comments (react-hooks/exhaustive-deps plugin not installed)"
  - "Admin banking uses client-side search filter on loaded data rather than server-side userId param"
  - "Bank account and CPF masking done client-side: account shows last 4 digits, CPF shows first 3 and last 2"
  - "Payment status badges use provider status string mapping (approved/pending/rejected) rather than order status"
metrics:
  duration: 12min
  completed: 2026-02-27
---

# Phase 5 Plan 6: Admin Payment, Commission, and Banking Dashboard UI Summary

Admin-facing financial dashboards with payment approval/rejection workflow, commission reporting with period selectors and plan-rate breakdowns, and seller bank account listing with masked sensitive data.

## What Was Built

### Task 1: Admin API Clients and Payment Dashboard

**API clients created:**

- `apps/web/src/lib/api/admin-payments.ts` -- Types and functions for admin payment management:
  - `getAdminPendingPayments(page, limit)` -- GET `/payments/admin/pending`
  - `getAdminAllPayments(params)` -- GET `/payments/admin/list` with optional status filter
  - `adminApprovePayment(orderId)` -- POST `/payments/admin/approve`
  - `adminRejectPayment(orderId)` -- POST `/payments/admin/reject`
  - `adminRefundPayment(paymentId, amount?)` -- POST `/payments/{paymentId}/refund`
  - `getAdminBankAccounts(params)` -- GET `/banking/admin/list` (also in this file for banking page)
  - Exported types: `PendingPaymentOrder`, `AdminPayment`, `AdminBankAccount`, `PaginationMeta`

- `apps/web/src/lib/api/admin-commission.ts` -- Types and functions for commission reporting:
  - `getCommissionDashboard(periodStart, periodEnd)` -- GET `/commission/admin/dashboard`
  - `getCommissionTransactions(params)` -- GET `/commission/admin/transactions`
  - Exported types: `CommissionDashboardData`, `CommissionByPlan`, `CommissionTransaction`

**Payment dashboard components:**

- `pending-payments-table.tsx` -- Table showing pending orders with buyer info, amounts in BRL, PIX status badges, expiry info, and approve/reject action buttons. Empty state shows CheckCircle icon with "Nenhum pagamento pendente".

- `payment-approval-dialog.tsx` -- Confirmation dialog with two modes: approve (green confirm button with amount) and reject (destructive button with cancellation warning). Loading state on confirm button.

- `admin-payments-page.tsx` -- Two-tab layout (Pendentes/Todos). Pending tab fetches and renders PendingPaymentsTable with dialog-based approval flow. All tab shows paginated table of every payment with status badges, payment date, refund amount. Tab switching lazy-loads data.

- `apps/web/src/app/[locale]/(admin)/admin/payments/page.tsx` -- Route wrapper.

**i18n translations:** Added `adminPayments` key to pt-BR.json with 28 translation entries.

### Task 2: Admin Commission Dashboard and Banking Pages

**Commission dashboard components:**

- `commission-summary-cards.tsx` -- Three Card components showing totals (green accent for commissions, blue for sales volume, purple for transaction count). Below cards: breakdown table by commission rate showing per-plan transaction count, commission, and sales volume. Skeleton loading state.

- `commission-transactions-table.tsx` -- Table with order number, item title, price, commission rate (percentage), commission amount (green), seller net, status badge, date. Pagination controls. Empty state for no transactions in period.

- `admin-commission-page.tsx` -- Period selector with two date inputs (defaults to current month). "Filtrar" button triggers parallel fetch of dashboard data and transactions. Uses useRef pattern for period values to keep fetchData callback stable without exhaustive-deps lint issues.

- `apps/web/src/app/[locale]/(admin)/admin/commission/page.tsx` -- Route wrapper.

**Banking page:**

- `admin-banking-page.tsx` -- Table of all sellers' bank accounts with columns: seller (name + email), bank, branch, account (masked: shows last 4 digits), CPF (masked: shows first 3 and last 2 digits), holder name, account type (Corrente/Poupanca), primary badge. Client-side search filter by seller name or email. Pagination controls.

- `apps/web/src/app/[locale]/(admin)/admin/banking/page.tsx` -- Route wrapper.

**i18n translations:** Added `adminCommission` (19 entries) and `adminBanking` (14 entries) to pt-BR.json.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint react-hooks/exhaustive-deps rule not defined in project**
- **Found during:** Task 1 build verification
- **Issue:** eslint-disable comments for react-hooks/exhaustive-deps caused build failure because the react-hooks ESLint plugin is not installed in the project config
- **Fix:** Restructured commission page to use `useRef` for period values, keeping `fetchData` callback stable with only `tCommon` as dependency. Removed all eslint-disable comments.
- **Files modified:** `admin-commission-page.tsx`

## Verification Results

1. Frontend build: `pnpm --filter contracts build && pnpm --filter web build` -- PASSED (compiled successfully, no errors)
2. Admin payments page has Pendentes tab with approve/reject buttons and Todos tab with paginated payment list
3. Commission dashboard shows summary cards with period selector and plan-rate breakdown table
4. Commission transactions table has all 8 columns (order, item, price, rate, commission, seller net, status, date)
5. Bank account data uses masked display: account number (last 4 digits), CPF (first 3, last 2)
6. All admin routes under (admin) route group at /admin/payments, /admin/commission, /admin/banking
7. All UI strings in pt-BR.json: adminPayments (28), adminCommission (19), adminBanking (14)
8. BRL formatting uses `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
9. All 13 files verified present on disk

## Self-Check: PASSED

All 12 created files and 1 modified file verified present:
- `apps/web/src/lib/api/admin-payments.ts` -- FOUND
- `apps/web/src/lib/api/admin-commission.ts` -- FOUND
- `apps/web/src/components/features/admin/payments/admin-payments-page.tsx` -- FOUND
- `apps/web/src/components/features/admin/payments/pending-payments-table.tsx` -- FOUND
- `apps/web/src/components/features/admin/payments/payment-approval-dialog.tsx` -- FOUND
- `apps/web/src/components/features/admin/commission/admin-commission-page.tsx` -- FOUND
- `apps/web/src/components/features/admin/commission/commission-summary-cards.tsx` -- FOUND
- `apps/web/src/components/features/admin/commission/commission-transactions-table.tsx` -- FOUND
- `apps/web/src/components/features/admin/banking/admin-banking-page.tsx` -- FOUND
- `apps/web/src/app/[locale]/(admin)/admin/payments/page.tsx` -- FOUND
- `apps/web/src/app/[locale]/(admin)/admin/commission/page.tsx` -- FOUND
- `apps/web/src/app/[locale]/(admin)/admin/banking/page.tsx` -- FOUND
- `apps/web/src/messages/pt-BR.json` -- FOUND (with adminPayments, adminCommission, adminBanking keys)
- Build routes confirmed: `/[locale]/admin/banking` (4.29 kB), `/[locale]/admin/commission` (6.3 kB), `/[locale]/admin/payments` (2.68 kB)
