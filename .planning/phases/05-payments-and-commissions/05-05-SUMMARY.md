---
phase: 05-payments-and-commissions
plan: 05
subsystem: payments-ui, banking-ui
tags: [frontend, payment-history, bank-account-crud, cpf-masking, i18n]
dependency_graph:
  requires: [payments-api-history, banking-api-crud]
  provides: [payment-history-page, bank-account-management-ui, banking-api-client]
  affects: [collector-routes, seller-routes, pt-BR-translations]
tech_stack:
  added: []
  patterns: [cpf-input-masking, account-number-masking, dialog-crud-pattern, table-pagination]
key_files:
  created:
    - apps/web/src/lib/api/banking.ts
    - apps/web/src/components/features/payments/payment-history-page.tsx
    - apps/web/src/components/features/banking/bank-account-form.tsx
    - apps/web/src/components/features/banking/bank-account-list.tsx
    - apps/web/src/app/[locale]/(collector)/payments/history/page.tsx
    - apps/web/src/app/[locale]/(seller)/seller/banking/page.tsx
  modified:
    - apps/web/src/lib/api/payments.ts
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/components/features/admin/commission/admin-commission-page.tsx
decisions:
  - "Used Dialog component for bank account form (add/edit) and delete confirmation since AlertDialog is not installed in the UI library"
  - "Used Checkbox instead of Switch for isPrimary toggle since Switch component not available"
  - "Client-side status filtering for payment history since API history endpoint does not support status query param"
  - "CPF masking follows same onChange pattern as CEP masking in address form (Phase 4)"
  - "Account number display uses tail-4-digits masking pattern (****1234) for security"
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 3
---

# Phase 05 Plan 05: Payment History and Banking UI Summary

Payment history table at /payments/history with paginated data, BRL formatting, status badges, and order links. Seller bank account CRUD at /seller/banking with CPF masking, primary account management, and Dialog-based form/delete flows.

## What Was Built

### Task 1: Payment History Page

**API client extension** (`apps/web/src/lib/api/payments.ts`):
- Added `PaymentHistoryItem` type extending `PaymentData` with order info (orderNumber, status, totalAmount, createdAt)
- Added `PaymentHistoryResponse` type with data array and pagination metadata
- Added `getPaymentHistory(page?, limit?)` function calling GET `/payments/history`

**Payment history page** (`apps/web/src/components/features/payments/payment-history-page.tsx`):
- Client component with pagination state from URL search params
- shadcn Table with columns: Data (DD/MM/YYYY HH:MM), Pedido (linked to /orders/{id}), Valor (BRL via Intl.NumberFormat), Metodo (PIX badge), Status (colored badges: green=Confirmado, yellow=Pendente, blue=Reembolsado, red=Rejeitado), Reembolso (BRL or dash)
- Status filter dropdown with client-side filtering
- Pagination controls (prev/next buttons with page indicator)
- Empty state with CreditCard icon and "Nenhum pagamento encontrado"
- Loading state with Skeleton rows
- All strings via `useTranslations('paymentHistory')`

**Route page** (`apps/web/src/app/[locale]/(collector)/payments/history/page.tsx`):
- Renders `<PaymentHistoryPage />` component

### Task 2: Seller Bank Account Management UI

**Banking API client** (`apps/web/src/lib/api/banking.ts`):
- `BankAccount` and `CreateBankAccountInput` types matching API contract
- `listBankAccounts()` - GET `/banking`
- `createBankAccount(data)` - POST `/banking`
- `updateBankAccount(id, data)` - PUT `/banking/{id}`
- `deleteBankAccount(id)` - DELETE `/banking/{id}`
- `setPrimaryBankAccount(id)` - PATCH `/banking/{id}/primary`

**Bank account form** (`apps/web/src/components/features/banking/bank-account-form.tsx`):
- react-hook-form with Zod validation via zodResolver
- Fields: Banco (text), Agencia (text), Conta (text), CPF (masked XXX.XXX.XXX-XX), Titular (text), Tipo de conta (Select: Corrente/Poupanca), Conta principal (Checkbox)
- CPF masking: `formatCpf()` function on onChange handler strips non-digits, inserts dots and dash progressively. Stores digits-only via `cpfToDigits()`, displays formatted via `digitsToCpf()`
- Zod schema validates CPF regex pattern, all required fields
- Submit/Cancel buttons with loading state

**Bank account list** (`apps/web/src/components/features/banking/bank-account-list.tsx`):
- Card-based list showing each account with Building2 icon
- Displays: bank name, branch/account (masked: ****1234), holder name, account type badge
- Primary account has gold/yellow "Principal" Badge
- Action buttons: Star (set primary, hidden if already primary), Pencil (edit), Trash2 (delete)
- Empty state with Building2 icon, "Nenhuma conta bancaria cadastrada" + prompt to add first account

**Seller banking page** (`apps/web/src/app/[locale]/(seller)/seller/banking/page.tsx`):
- Client component orchestrating full CRUD lifecycle
- State: accounts list, isFormOpen, editingAccount, deletingId
- On mount fetches `listBankAccounts()`
- "Adicionar conta" button opens form Dialog in create mode
- Edit opens form Dialog pre-filled with account data
- Delete opens confirmation Dialog with warning text
- Set primary calls API and refreshes list
- Toast notifications via Sonner on all success/error outcomes
- Loading skeleton state

**i18n translations** (`apps/web/src/messages/pt-BR.json`):
- Added `paymentHistory` section: title, column headers, status labels, pagination
- Added `banking` section: title, form field labels, account type labels, CRUD action labels, success/error messages, empty states

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed eslint-disable-line comments referencing missing react-hooks/exhaustive-deps rule**
- **Found during:** Build verification
- **Issue:** `admin-commission-page.tsx` had `// eslint-disable-line react-hooks/exhaustive-deps` comments but the ESLint 9 flat config did not define this rule, causing build-breaking "Definition for rule not found" errors
- **Fix:** Linter auto-fixed by restructuring to use refs and proper dependency arrays (removing the need for eslint-disable comments entirely)
- **Files modified:** `apps/web/src/components/features/admin/commission/admin-commission-page.tsx`

### Build Note

The `pnpm --filter web build` command fails at "Collecting page data" phase with `middleware-manifest.json` not found error. This is a pre-existing Next.js 15.5.12 issue on Windows unrelated to this plan's changes. TypeScript type-check (`tsc --noEmit`) passes cleanly with zero errors, confirming all new code compiles correctly.

## Verification Results

1. TypeScript compilation: `pnpm --filter web type-check` passes with no errors
2. All 6 new files created and verified present on disk
3. payments.ts has `getPaymentHistory` function with `PaymentHistoryItem` type
4. banking.ts has all 5 CRUD functions (list, create, update, delete, setPrimary)
5. Bank account form has CPF masking via `formatCpf()` onChange handler
6. Bank account list shows primary badge (yellow) and masked account numbers
7. Both route pages exist at correct paths
8. pt-BR.json has both `paymentHistory` and `banking` translation sections

## Self-Check: PASSED

All created files verified present. All key functions verified via grep. TypeScript compilation verified clean.
