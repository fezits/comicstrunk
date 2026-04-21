---
phase: "06-subscriptions"
plan: "03"
subsystem: "subscription-enforcement"
tags: ["cron", "subscriptions", "reconciliation", "trialing", "plan-limits", "commission"]
dependency_graph:
  requires: ["06-01", "06-02"]
  provides: ["subscription-reconciliation-cron", "trialing-status-support"]
  affects: ["shared/cron/index.ts", "collection.service.ts", "commission.service.ts"]
tech_stack:
  added: []
  patterns: ["Stripe subscription status cross-check in cron", "TRIALING treated as ACTIVE for plan benefits"]
key_files:
  created: []
  modified:
    - apps/api/src/shared/cron/index.ts
    - apps/api/src/modules/collection/collection.service.ts
    - apps/api/src/modules/commission/commission.service.ts
decisions:
  - "Cron runs at 5 AM daily (after existing 3 AM and 4 AM jobs) to avoid overlap"
  - "Only reconciles subscriptions with cancelledAt set (scheduled cancellation) to avoid false positives"
  - "Stripe cross-check skips downgrade if Stripe says subscription is still active/trialing"
  - "TRIALING status uses same in-clause pattern as ACTIVE for both collection limits and commission rates"
metrics:
  completed_date: "2026-02-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 06 Plan 03: Subscription Enforcement Summary

Daily reconciliation cron job at 5 AM catches expired subscriptions with scheduled cancellations that missed Stripe webhooks, and TRIALING status now grants full BASIC plan benefits (200-item collection limit, 8% commission rate) in both collection and commission services.

## What Was Built

### 1. Subscription Reconciliation Cron Job (`shared/cron/index.ts`)

New daily cron scheduled at `0 5 * * *` (5 AM) as a safety net for missed Stripe webhooks:

- **Query:** Finds subscriptions where status is ACTIVE or TRIALING, planType is not FREE, currentPeriodEnd has passed, and cancelledAt is set (cancellation was scheduled)
- **Stripe cross-check:** When Stripe is configured, retrieves the actual Stripe subscription to verify it is truly cancelled/expired before downgrading. Skips if Stripe says it is still active
- **Downgrade transaction:** Sets subscription status to CANCELLED, planType to FREE. Reverts user role to USER (ADMIN role is preserved). Creates SUBSCRIPTION_EXPIRED notification in Portuguese
- **Error isolation:** Each subscription is processed independently with its own try/catch -- one failure does not block others
- **Logging:** Logs each individual downgrade and a summary line showing total checked vs downgraded

### 2. Collection Service TRIALING Support (`collection.service.ts`)

Updated `checkPlanLimit()` subscription query from `status: 'ACTIVE'` to `status: { in: ['ACTIVE', 'TRIALING'] }`. Users on a trial period now get the BASIC collection limit (200 items) immediately upon starting their trial.

### 3. Commission Service TRIALING Support (`commission.service.ts`)

Updated `previewCommission()` subscription query from `status: 'ACTIVE'` to `status: { in: ['ACTIVE', 'TRIALING'] }`. Trial users now see the BASIC commission rate (8%) when previewing sales, matching the rate they will have as full subscribers.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter api build` | PASSED |
| `pnpm --filter api type-check` | PASSED |
| Cron file has 4 scheduled jobs (3 existing + 1 new) | PASSED |
| Collection service query includes `status: { in: ['ACTIVE', 'TRIALING'] }` | PASSED |
| Commission service query includes `status: { in: ['ACTIVE', 'TRIALING'] }` | PASSED |
| Subscription reconciliation cron registered at `0 5 * * *` | PASSED |
| ADMIN role preserved during downgrade | PASSED |
| SUBSCRIPTION_EXPIRED notification created on downgrade | PASSED |

## Deviations from Plan

None -- plan executed exactly as written. The plan specified 5 AM for the cron (not 3 AM as mentioned in the user prompt), and the implementation follows the plan's specification.

## Behavioral Summary

- A user with TRIALING subscription and planType=BASIC gets 200-item collection limit and 8% commission rate
- A user with CANCELLED subscription defaults to FREE (50-item limit, 10% commission rate)
- A user whose subscription period ended with cancelledAt set will be automatically downgraded within 24 hours by the reconciliation cron
- Existing items above the FREE limit (50) are preserved after downgrade -- only new additions are blocked
