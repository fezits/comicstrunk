---
phase: 05-payments-and-commissions
plan: 02
subsystem: banking
tags: [api, banking, cpf-validation, crud, admin]
dependency_graph:
  requires: [prisma-schema-BankAccount]
  provides: [banking-api-crud, banking-admin-list, cpf-validation]
  affects: [create-app-routes]
tech_stack:
  added: [cpf-cnpj-validator]
  patterns: [transaction-primary-flag, ownership-validation, auto-promote-primary]
key_files:
  created:
    - apps/api/src/modules/banking/banking.service.ts
    - apps/api/src/modules/banking/banking.routes.ts
  modified:
    - apps/api/src/create-app.ts
    - packages/contracts/src/banking.ts
decisions:
  - Used cpf-cnpj-validator library for CPF validation (standard Brazilian CPF check-digit algorithm)
  - Applied same primary-flag transaction pattern as shipping addresses (Phase 4)
  - Admin list endpoint at /admin/list to avoid /:id collision
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 05 Plan 02: Seller Bank Account Registration API Summary

Seller bank account CRUD API with CPF validation via cpf-cnpj-validator, transaction-based primary flag management, and admin paginated list endpoint.

## What Was Built

### Banking Service (`apps/api/src/modules/banking/banking.service.ts`)
- **createBankAccount**: Validates CPF format using cpf-cnpj-validator, strips formatting to store digits-only, auto-sets isPrimary=true if first account, uses $transaction to enforce single-primary constraint
- **listUserBankAccounts**: Returns all user bank accounts ordered by isPrimary desc, createdAt desc
- **getBankAccount**: Single account lookup with ownership validation
- **updateBankAccount**: Partial update with CPF re-validation if provided, transaction-based primary swap, prevents unsetting primary on sole account
- **deleteBankAccount**: Deletes with auto-promotion of most recent remaining account to primary (same pattern as shipping address default promotion in Phase 4)
- **setPrimaryBankAccount**: Atomic primary flag swap via $transaction
- **adminListBankAccounts**: Paginated list of all bank accounts with user info (name, email), optional userId filter

### Banking Routes (`apps/api/src/modules/banking/banking.routes.ts`)
- `POST /api/v1/banking` - Create bank account (authenticated)
- `GET /api/v1/banking` - List my bank accounts (authenticated)
- `GET /api/v1/banking/admin/list` - Admin paginated list (admin only)
- `GET /api/v1/banking/:id` - Get single account (authenticated)
- `PUT /api/v1/banking/:id` - Update account (authenticated)
- `DELETE /api/v1/banking/:id` - Delete account (authenticated)
- `PATCH /api/v1/banking/:id/primary` - Set as primary (authenticated)

Static route `/admin/list` placed before parameterized `/:id` routes to prevent path collision.

### Contracts Update (`packages/contracts/src/banking.ts`)
- Added `adminBankAccountListSchema` with page, limit, userId filter
- Added `AdminBankAccountListInput` type export

### App Mount (`apps/api/src/create-app.ts`)
- Banking routes mounted at `/api/v1/banking`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed cpf-cnpj-validator dependency**
- **Found during:** Task 1
- **Issue:** The `cpf-cnpj-validator` package was not installed in the API package
- **Fix:** Ran `pnpm --filter api add cpf-cnpj-validator`
- **Files modified:** apps/api/package.json, pnpm-lock.yaml

**2. [Rule 3 - Blocking] Added admin list schema to contracts**
- **Found during:** Task 2
- **Issue:** The contracts banking.ts file existed but was missing the `adminBankAccountListSchema` needed for admin route validation
- **Fix:** Added the schema and its type export to `packages/contracts/src/banking.ts`
- **Files modified:** packages/contracts/src/banking.ts

## Verification

- TypeScript compilation: `pnpm --filter api build` -- passes with no errors
- CPF validation: createBankAccount calls `cpf.isValid()` and `cpf.strip()` from cpf-cnpj-validator
- Primary flag: enforced via `$transaction` in create, update, and setPrimary operations
- Auto-promotion: deleteBankAccount promotes most recent remaining account if deleted was primary
- Admin access: GET /admin/list requires ADMIN role via `authorize('ADMIN')` middleware
- Ownership: all seller operations validate `account.userId !== userId` and throw ForbiddenError
