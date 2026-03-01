---
phase: "06-subscriptions"
plan: "04"
subsystem: "subscription-admin-api"
tags: ["admin", "subscriptions", "plan-config", "crud"]
dependency_graph:
  requires: ["06-01"]
  provides: ["admin-subscription-management", "plan-config-crud"]
  affects: ["subscriptions.service.ts", "subscriptions.routes.ts", "subscription.ts"]
tech_stack:
  added: []
  patterns: ["Admin CRUD with authorize('ADMIN') middleware", "Manual subscription activation (dev mode, no Stripe)", "Paginated admin listing with filters"]
key_files:
  created: []
  modified:
    - packages/contracts/src/subscription.ts
    - apps/api/src/modules/subscriptions/subscriptions.service.ts
    - apps/api/src/modules/subscriptions/subscriptions.routes.ts
decisions:
  - "Admin activate uses $transaction to atomically create/update subscription and update user role"
  - "Admin plan listing returns ALL configs including inactive, unlike public /plans endpoint"
  - "User role not changed when target user is ADMIN (prevents accidental admin demotion)"
  - "updatePlanConfig accepts partial updates via explicit undefined checks, supports nullable stripePriceId"
metrics:
  completed_date: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 06 Plan 04: Subscription Admin Management Summary

Admin endpoints for subscription management: list subscriptions with pagination/filters, manual activation (dev mode without Stripe), and full PlanConfig CRUD with partial update support.

## What Was Built

### Admin Contract Schemas (`packages/contracts/src/subscription.ts`)
- `adminActivateSubscriptionSchema`: userId, planType (FREE/BASIC), durationDays (1-365, default 30)
- `createPlanConfigSchema`: full plan creation with planType, name, price, billingInterval, collectionLimit, commissionRate, trialDays, isActive, stripePriceId
- `updatePlanConfigSchema`: partial update supporting nullable stripePriceId
- `adminSubscriptionListSchema`: paginated query with status and planType filters (coerced numbers for query string)
- Inferred types: `AdminActivateSubscriptionInput`, `CreatePlanConfigInput`, `UpdatePlanConfigInput`, `AdminSubscriptionListInput`

### Admin Service Functions (`apps/api/src/modules/subscriptions/subscriptions.service.ts`)
- `adminListSubscriptions(filters)`: Paginated listing with user info (name, email, role), filterable by status and planType
- `adminActivateSubscription(input)`: Transactional manual activation - creates or updates subscription, updates user role (SUBSCRIBER for BASIC, USER for FREE), preserves ADMIN role
- `adminListAllPlans()`: Returns ALL PlanConfig rows (including inactive), ordered by planType and billingInterval
- `adminCreatePlan(data)`: Creates new PlanConfig with all fields, converts Decimal to Number on response
- `adminUpdatePlan(id, data)`: Partial update with existence check, supports nullable stripePriceId for Stripe decoupling

### Admin Routes (`apps/api/src/modules/subscriptions/subscriptions.routes.ts`)
- `GET /admin/list` (ADMIN): List all subscriptions with pagination and filters via sendPaginated
- `POST /admin/activate` (ADMIN): Manually activate subscription for a user (dev mode)
- `GET /admin/plans` (ADMIN): List all plan configs including inactive ones
- `POST /admin/plans` (ADMIN): Create new plan config (201 response)
- `PUT /admin/plans/:id` (ADMIN): Update plan config with partial data

All routes use `authenticate` + `authorize('ADMIN')` middleware chain.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter contracts build` | PASSED |
| `pnpm --filter api build` | PASSED |
| `pnpm type-check` (all 3 packages) | PASSED |
| Admin schemas exported from contracts | PASSED |
| 5 admin service functions exported | PASSED |
| 5 admin routes with ADMIN authorization | PASSED |

## Deviations from Plan

None - plan executed exactly as written.
