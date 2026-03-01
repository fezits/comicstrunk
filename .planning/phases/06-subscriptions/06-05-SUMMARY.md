---
phase: "06-subscriptions"
plan: "05"
subsystem: "subscription-ui"
tags: ["subscription", "plans", "stripe-checkout", "ui", "next-intl"]
dependency_graph:
  requires: ["06-01", "06-02", "06-03"]
  provides: ["subscription-page", "plan-comparison-ui", "subscription-status-card", "checkout-return-pages"]
  affects: ["nav-config.ts", "pt-BR.json"]
tech_stack:
  added: ["@radix-ui/react-alert-dialog (shadcn alert-dialog)"]
  patterns: ["Plan comparison with billing interval selector", "Stripe Checkout redirect flow", "Subscription status card with cancel/portal actions"]
key_files:
  created:
    - apps/web/src/lib/api/subscriptions.ts
    - apps/web/src/components/features/subscription/plan-comparison.tsx
    - apps/web/src/components/features/subscription/subscription-status-card.tsx
    - apps/web/src/app/[locale]/(collector)/subscription/page.tsx
    - apps/web/src/app/[locale]/(collector)/subscription/success/page.tsx
    - apps/web/src/app/[locale]/(collector)/subscription/cancel/page.tsx
    - apps/web/src/components/ui/alert-dialog.tsx
  modified:
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/components/layout/nav-config.ts
decisions:
  - "Used Crown icon for subscription nav item (distinguishes from CreditCard used for payments)"
  - "Alert-dialog installed via shadcn for cancel confirmation (accessible modal pattern)"
  - "Billing interval selector uses tab-like radio group inside BASIC card rather than separate section"
  - "Status card embeds cancel and portal actions to minimize page switches"
metrics:
  completed_date: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 06 Plan 05: Subscription UI Summary

Plan comparison page (FREE vs BASIC) with billing interval selector, Stripe Checkout redirect flow, subscription status card with cancel/portal actions, success/cancel return pages. All text in PT-BR via next-intl.

## What Was Built

### API Client (`apps/web/src/lib/api/subscriptions.ts`)
- `getPlans()` -- GET /api/v1/subscriptions/plans (list active plan configs)
- `getSubscriptionStatus()` -- GET /api/v1/subscriptions/status (current user subscription)
- `createCheckout(planConfigId)` -- POST /api/v1/subscriptions/checkout (Stripe Checkout session)
- `createPortalSession()` -- POST /api/v1/subscriptions/portal (Stripe Customer Portal)
- `cancelSubscription()` -- POST /api/v1/subscriptions/cancel (end-of-period cancellation)
- TypeScript interfaces: `PlanConfig`, `SubscriptionStatus`, `CheckoutSession`, `PortalSession`

### Plan Comparison Component (`apps/web/src/components/features/subscription/plan-comparison.tsx`)
- Side-by-side cards: FREE (plain) vs BASIC (purple border accent)
- FREE card: R$0/mes, features list (50 items, 10% commission, catalog access)
- BASIC card: price with billing interval label, features list (200 items, 8% commission, priority support)
- Billing interval selector: tab-like radio group (Mensal, Trimestral, Semestral, Anual)
- "Plano Atual" badge on current plan, "Assinar BASIC" button for upgrade
- Trial days badge (emerald) when eligible
- Responsive: 1 column mobile, 2 columns desktop

### Subscription Status Card (`apps/web/src/components/features/subscription/subscription-status-card.tsx`)
- Current plan badge with colored status indicator (ACTIVE=green, TRIALING=gray, PAST_DUE=red, CANCELLED=outline)
- Plan name, collection limit, next billing date
- Yellow warning for scheduled cancellation with end date
- Red alert for past-due payment status
- "Gerenciar Pagamento" button (opens Stripe Customer Portal)
- "Cancelar Assinatura" button with AlertDialog confirmation
- Only shows management buttons for paid subscriptions

### Main Subscription Page (`apps/web/src/app/[locale]/(collector)/subscription/page.tsx`)
- Fetches plans and subscription status on mount with parallel requests
- Loading skeleton while fetching
- Paid subscribers see status card first, then plan comparison below
- FREE users see plan comparison prominently
- Upgrade handler: creates checkout session and redirects to Stripe Checkout URL
- Error handling with toast notifications

### Checkout Success Page (`apps/web/src/app/[locale]/(collector)/subscription/success/page.tsx`)
- Green CheckCircle2 icon, "Assinatura Ativada!" heading
- Success message with congratulations
- "Ir para Minha Colecao" button linking to /collection
- Auto-redirect to /subscription after 5-second countdown

### Checkout Cancel Page (`apps/web/src/app/[locale]/(collector)/subscription/cancel/page.tsx`)
- Yellow XCircle icon, "Assinatura nao concluida" heading
- Informational message about trying again
- "Voltar para Planos" button linking back to /subscription

### Navigation (`apps/web/src/components/layout/nav-config.ts`)
- Added "Assinatura" (Crown icon) link in Account group between Profile and Settings
- Added `/subscription` to protectedRoutes array
- Linter also added admin subscription links (adminSubscriptions, adminPlans)

### Translations (`apps/web/src/messages/pt-BR.json`)
- Added `nav.subscription` key for navigation
- Added full `subscription` section with nested keys:
  - Plan names, comparison labels, billing intervals/labels
  - Feature descriptions (collection limit, commission rate, catalog access, priority support)
  - Status labels (active, trialing, past_due, cancelled)
  - Billing management (next billing, cancel scheduled, manage billing, cancel confirmation)
  - Checkout flow (success, cancel, processing, redirecting)

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter contracts build` | PASSED |
| `pnpm --filter web type-check` | PASSED |
| `pnpm --filter web build` | PASSED |
| Translation file valid JSON | PASSED |
| Subscription page at /subscription | PASSED (6.13 kB) |
| Success page at /subscription/success | PASSED (3.38 kB) |
| Cancel page at /subscription/cancel | PASSED (3.17 kB) |
| All 7 files created | PASSED |
| useTranslations in all pages | PASSED |
| 'use client' in all pages | PASSED |
| Nav config includes subscription link | PASSED |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed shadcn alert-dialog component**
- **Found during:** Task 2 (subscription status card)
- **Issue:** The plan specified using AlertDialog from shadcn/ui, but the component was not installed in the project.
- **Fix:** Ran `npx shadcn@latest add alert-dialog` to install the component.
- **Files created:** `apps/web/src/components/ui/alert-dialog.tsx`

**2. [Rule 1 - Bug] Fixed cross-namespace translation reference**
- **Found during:** Task 2 (subscription status card)
- **Issue:** The cancel dialog used `t('common.cancel')` but `t` was scoped to `'subscription'` namespace, which would fail at runtime.
- **Fix:** Added separate `tCommon = useTranslations('common')` hook and changed to `tCommon('cancel')`.
- **Files modified:** `subscription-status-card.tsx`
