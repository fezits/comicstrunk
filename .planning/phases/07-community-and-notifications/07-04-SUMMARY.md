---
phase: "07"
plan: "04"
subsystem: email-notifications
tags: [email, resend, templates, transactional, notifications]
dependency_graph:
  requires: [notification-service, notification-preferences]
  provides: [email-service, resend-sdk, email-templates]
  affects: [auth, orders, payments]
tech_stack:
  added: [resend]
  patterns: [fire-and-forget-email, preference-gated-email, sdk-abstraction]
key_files:
  created:
    - apps/api/src/shared/lib/resend.ts
    - apps/api/src/shared/email-templates/base-layout.ts
    - apps/api/src/shared/email-templates/welcome.ts
    - apps/api/src/shared/email-templates/payment-confirmed.ts
    - apps/api/src/shared/email-templates/order-shipped.ts
    - apps/api/src/shared/email-templates/item-sold.ts
    - apps/api/src/shared/email-templates/password-reset.ts
    - apps/api/src/modules/notifications/email.service.ts
  modified:
    - apps/api/src/modules/notifications/notifications.service.ts
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/orders/orders.service.ts
    - apps/api/src/modules/payments/payments.service.ts
    - apps/api/package.json
    - apps/api/.env.example
decisions:
  - "Used fire-and-forget pattern (void sendXxxEmail()) for all email hooks to prevent email failures from blocking main operations"
  - "Password reset email always sends regardless of notification preferences (security-critical)"
  - "Exported isNotificationEnabled from notifications.service.ts to enable email.service.ts preference gate"
  - "Email templates use inline CSS only for email client compatibility"
metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 6
---

# Phase 07 Plan 04: Email Notification Service Summary

Transactional email service with Resend SDK abstraction, 5 responsive PT-BR email templates, preference-gated sending, and fire-and-forget hooks in auth, orders, and payments modules.

## What Was Built

### 1. Resend SDK Abstraction (`apps/api/src/shared/lib/resend.ts`)
- Follows the mercadopago/stripe SDK pattern: read env var, conditionally initialize client, export instance + `isResendConfigured()` check
- Exports `RESEND_FROM_EMAIL` with configurable default `Comics Trunk <noreply@comicstrunk.com.br>`
- When `RESEND_API_KEY` is not set, `resend` is null and `isResendConfigured()` returns false

### 2. Base Email Layout (`apps/api/src/shared/email-templates/base-layout.ts`)
- `baseEmailLayout(content)` wraps content in responsive HTML email boilerplate
- Purple (#7C3AED) header bar with "Comics Trunk" branding
- Max-width 600px centered container, white body, gray footer
- Footer: "Comics Trunk - Sua plataforma de gibis e HQs" + preference hint
- All inline CSS, no external stylesheets

### 3. Email Templates (5 templates)
All templates return `{ subject: string; html: string }` and wrap content in `baseEmailLayout()`:

- **welcome.ts** - Greeting with user name, platform intro, feature list, "Explorar Catalogo" CTA
- **payment-confirmed.ts** - Order summary box (number, items, total in purple), "Ver Pedido" CTA
- **order-shipped.ts** - Shipping details box (item, order, tracking code in monospace), carrier info, "Acompanhar Pedido" CTA
- **item-sold.ts** - Sale details box (item, price, net in green), seller congrats, "Ver Pedido" CTA
- **password-reset.ts** - Reset instructions, prominent CTA button, 1-hour expiry warning box, security note, fallback link text

### 4. Email Service (`apps/api/src/modules/notifications/email.service.ts`)
- Internal `sendEmail()` helper: checks `isResendConfigured()`, logs to console if not configured, catches all errors (fire-and-forget)
- Internal `checkPreferenceAndSend()`: calls `isNotificationEnabled()` from notifications service before sending
- **sendWelcomeEmail** - checks WELCOME preference
- **sendPaymentConfirmedEmail** - checks PAYMENT_CONFIRMED preference
- **sendOrderShippedEmail** - checks ORDER_SHIPPED preference
- **sendItemSoldEmail** - checks ITEM_SOLD preference
- **sendPasswordResetEmail** - NO preference check (security-critical, always sends)

### 5. Integration Hooks
- **Auth (signup)**: `void sendWelcomeEmail()` after user creation and notification
- **Auth (password reset)**: `void sendPasswordResetEmail()` replacing the console.log placeholder with actual email (logger.info kept for dev)
- **Orders (createOrder)**: `void sendItemSoldEmail()` to each unique seller with item title, price, and seller net
- **Orders (updateOrderItemStatus)**: `void sendOrderShippedEmail()` when status becomes SHIPPED and tracking code exists
- **Payments (processPaymentConfirmation)**: `void sendPaymentConfirmedEmail()` with order total and item count

### 6. Infrastructure Changes
- Installed `resend@^6.9.3` in `apps/api/package.json`
- Added `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `.env.example` with documentation
- Exported `isNotificationEnabled` from `notifications.service.ts` (was private)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma select+include conflict in payments.service.ts**
- **Found during:** Task 3
- **Issue:** Initial implementation used both `select` and `include` in the same Prisma query which is not allowed
- **Fix:** Removed `select` clause, used only `include` with nested selects
- **Files modified:** `apps/api/src/modules/payments/payments.service.ts`

**2. [Rule 2 - Missing Critical Functionality] Exported isNotificationEnabled**
- **Found during:** Task 3
- **Issue:** `isNotificationEnabled` was a private function in notifications.service.ts but email.service.ts needs it for preference gate
- **Fix:** Changed from `async function` to `export async function`
- **Files modified:** `apps/api/src/modules/notifications/notifications.service.ts`

## Verification

- `pnpm build` succeeds across all 3 packages (contracts, api, web)
- `pnpm --filter api type-check` passes
- Resend SDK lib at `shared/lib/resend.ts` follows the mercadopago/stripe abstraction pattern
- With RESEND_API_KEY unset: all operations complete normally, console logs "[EMAIL] Resend not configured, skipping: ..."
- Five email templates each produce `{ subject, html }` with valid responsive HTML in PT-BR
- sendWelcomeEmail checks WELCOME preference before sending
- sendPasswordResetEmail always sends (no preference check)
- Email failures are caught and logged, never thrown
- Signup flow triggers welcome email (fire-and-forget)
- Order creation triggers item sold email to each seller
- Order item shipped triggers shipping email to buyer (when tracking code present)
- Payment confirmation triggers payment confirmed email to buyer
