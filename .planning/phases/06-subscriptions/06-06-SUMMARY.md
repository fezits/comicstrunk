---
phase: "06-subscriptions"
plan: "06"
subsystem: "admin-subscription-ui"
tags: ["admin", "subscriptions", "plan-config", "ui", "crud"]
dependency_graph:
  requires: ["06-04"]
  provides: ["admin-subscription-management-ui", "plan-config-management-ui"]
  affects: ["nav-config.ts", "pt-BR.json"]
tech_stack:
  added: ["@radix-ui/react-switch (shadcn switch component)"]
  patterns: ["Admin list page with filters and pagination", "Dialog-based CRUD form", "Commission impact live preview", "Grouped card layout for plan configs"]
key_files:
  created:
    - apps/web/src/lib/api/admin-subscriptions.ts
    - apps/web/src/components/features/admin/subscription-list.tsx
    - apps/web/src/components/features/admin/plan-config-form.tsx
    - apps/web/src/app/[locale]/(admin)/admin/subscriptions/page.tsx
    - apps/web/src/app/[locale]/(admin)/admin/subscriptions/plans/page.tsx
    - apps/web/src/components/ui/switch.tsx
  modified:
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/components/layout/nav-config.ts
decisions:
  - "Installed shadcn Switch component (was missing from UI library)"
  - "Used Crown icon for subscriptions and Layers icon for plans in admin nav"
  - "Plan config page uses card layout grouped by plan type (FREE/BASIC sections)"
  - "Commission impact preview shows live calculation as user types rate"
metrics:
  completed_date: "2026-02-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 2
---

# Phase 06 Plan 06: Admin Subscription Management UI Summary

Admin subscription management UI with paginated subscription list (status/planType filters, manual activation dialog), plan config CRUD via dialog forms with commission impact preview, and active/inactive toggle on plan cards.

## What Was Built

### Admin API Client (`apps/web/src/lib/api/admin-subscriptions.ts`)
- `adminListSubscriptions(params)`: GET /subscriptions/admin/list with pagination and filters
- `adminActivateSubscription(input)`: POST /subscriptions/admin/activate for manual activation
- `adminListPlans()`: GET /subscriptions/admin/plans for all plan configs
- `adminCreatePlan(input)`: POST /subscriptions/admin/plans for new plan creation
- `adminUpdatePlan(id, input)`: PUT /subscriptions/admin/plans/:id for partial updates
- TypeScript interfaces: `AdminSubscription`, `PlanConfig`, `PaginationMeta`

### Subscription List Component (`apps/web/src/components/features/admin/subscription-list.tsx`)
- Table of all subscriptions with columns: User, Email, Plan, Status, Period End, Actions
- Filter bar with status dropdown (All, ACTIVE, TRIALING, PAST_DUE, CANCELLED) and planType dropdown (All, FREE, BASIC)
- Colored Badge per status: ACTIVE=green (default), TRIALING=blue (secondary), PAST_DUE=yellow (outline), CANCELLED=red (destructive)
- Pagination controls at bottom
- "Ativar Assinatura" button opens Dialog for manual activation with userId, planType, durationDays fields
- Pre-fills userId when clicking "Ativar" on a specific subscription row

### Plan Config Form Component (`apps/web/src/components/features/admin/plan-config-form.tsx`)
- Dialog-based form supporting create and edit modes
- Create mode: all fields including planType and billingInterval selects
- Edit mode: planType and billingInterval locked (not changeable)
- Fields: name, planType, billingInterval, price, collectionLimit, commissionRate, trialDays, stripePriceId, isActive toggle
- Live commission impact preview below commission rate field: "Em uma venda de R$100: comissao R$X, vendedor recebe R$Y"
- Validation: name required, price >= 0, collectionLimit >= 1, commissionRate 0-1

### Admin Subscriptions Page (`apps/web/src/app/[locale]/(admin)/admin/subscriptions/page.tsx`)
- Title: "Assinaturas" with "Gerenciar Planos" link button to plans page
- Renders SubscriptionList component

### Admin Plans Page (`apps/web/src/app/[locale]/(admin)/admin/subscriptions/plans/page.tsx`)
- Title: "Configuracao de Planos" with back arrow to subscriptions page
- Fetches all plan configs via adminListPlans()
- Grouped card layout: FREE section and BASIC section
- Each card shows: name, price (BRL), billing interval, collection limit, commission rate (%), trial days, stripePriceId
- Active/inactive toggle directly on each card
- "Editar" button opens PlanConfigForm in edit mode
- "Novo Plano" button opens PlanConfigForm in create mode

### Navigation Updates (`apps/web/src/components/layout/nav-config.ts`)
- Added Crown icon for "Assinaturas" -> /admin/subscriptions
- Added Layers icon for "Planos" -> /admin/subscriptions/plans
- Both in the admin navigation group (adminOnly, requiresAuth)

### Translations (`apps/web/src/messages/pt-BR.json`)
- Added `nav.adminSubscriptions` and `nav.adminPlans` keys
- Added full `adminSubscription` section with nested keys: title, filters, table, status labels, activate dialog, plans (create/edit, intervals, impact preview)

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter web build` | PASSED (compiled, type-checked, routes built) |
| All 6 files created in correct paths | PASSED |
| i18n usage in admin subscription pages | PASSED |
| Commission impact preview in plan-config-form.tsx | PASSED |
| pt-BR.json valid JSON | PASSED |
| Admin subscription nav links in nav-config.ts | PASSED |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing shadcn Switch component**
- **Found during:** Task 1
- **Issue:** The plan specified using Switch component but it was not installed in the project
- **Fix:** Ran `npx shadcn@latest add switch` to install the component
- **Files created:** `apps/web/src/components/ui/switch.tsx`

**2. [Rule 3 - Blocking] Nav config already had Crown icon imported**
- **Found during:** Task 1
- **Issue:** A previous plan (06-05) had already imported Crown and added subscription nav item
- **Fix:** Only added Layers import and the two admin nav items without duplicating Crown
- **Files modified:** `apps/web/src/components/layout/nav-config.ts`
