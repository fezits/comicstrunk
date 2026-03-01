---
phase: 04-marketplace-and-orders
plan: 06
subsystem: ui
tags: [next.js, react, cart, checkout, shadcn-ui, tailwind, i18n, context-api]

# Dependency graph
requires:
  - phase: 04-marketplace-and-orders
    provides: Cart API, shipping address API, orders API, marketplace frontend with API clients
  - phase: 01-foundation
    provides: AuthProvider context, authenticated layout shell, next-intl i18n
provides:
  - CartProvider context with shared cartCount, refreshCart, incrementCount, decrementCount
  - Cart sidebar sheet with 24-hour countdown timers, item management, and totals
  - Header cart icon with badge count (authenticated only)
  - Checkout page with address selection, inline address creation, and order placement
  - OrderReview component with multi-seller grouping and per-group subtotals
  - AddressForm with CEP masking and Brazilian state dropdown
  - Standalone address management page with CRUD operations
  - PT-BR translations for cart, checkout, and addresses sections
affects: [04-07-orders-ui, 05-payments]

# Tech tracking
tech-stack:
  added: [@radix-ui/react-scroll-area]
  patterns: [cart-context-provider, optimistic-count-updates, countdown-timer-hook, multi-seller-grouping]

key-files:
  created:
    - apps/web/src/contexts/cart-context.tsx
    - apps/web/src/components/features/cart/cart-sidebar.tsx
    - apps/web/src/components/features/cart/cart-item-card.tsx
    - apps/web/src/components/features/cart/cart-countdown.tsx
    - apps/web/src/components/features/cart/cart-summary.tsx
    - apps/web/src/components/features/checkout/checkout-page.tsx
    - apps/web/src/components/features/checkout/address-selector.tsx
    - apps/web/src/components/features/checkout/address-form.tsx
    - apps/web/src/components/features/checkout/order-review.tsx
    - apps/web/src/app/[locale]/(collector)/checkout/page.tsx
    - apps/web/src/app/[locale]/(collector)/addresses/page.tsx
    - apps/web/src/components/ui/scroll-area.tsx
  modified:
    - apps/web/src/components/layout/header.tsx
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/components/features/marketplace/listing-detail.tsx
    - apps/web/package.json

key-decisions:
  - "CartProvider wraps app at locale layout level (inside AuthProvider) for shared state across header, sidebar, and listing detail"
  - "Cart badge uses optimistic count updates (incrementCount/decrementCount) for instant UI feedback without API round-trip"
  - "Countdown timer uses setInterval(1000ms) with yellow warning < 1 hour and red expired state"
  - "Address selector uses radio-style card selection with default address pre-selected"
  - "CEP masking applied via onChange handler on native input (not third-party mask library)"
  - "Order review groups items by seller with separate subtotals and 'ships separately' notice"

patterns-established:
  - "CartProvider pattern: shared context for cart count with optimistic updates across distant components"
  - "useCartCountdown hook: reusable countdown timer returning hours/minutes/seconds/isExpired"
  - "Brazilian address form: CEP mask, state dropdown with 27 UF codes, zod validation"
  - "Multi-seller grouping: Map-based seller grouping for order review display"

requirements-completed: [CART-01, CART-02, CART-03, CART-07, ORDR-01, ORDR-02, ORDR-03]

# Metrics
duration: 14min
completed: 2026-02-27
---

# Phase 4 Plan 06: Cart and Checkout UI Summary

**Cart sidebar with 24h countdown timers, CartProvider shared state, checkout flow with Brazilian address management and multi-seller order review**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-27T18:43:49Z
- **Completed:** 2026-02-27T18:57:49Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Built CartProvider context with shared cartCount state, optimistic increment/decrement, and full cart refresh -- wired into header badge, cart sidebar, and listing detail add-to-cart
- Created cart sidebar sheet with countdown timers per item (yellow < 1h, red expired), remove/clear actions, empty state, and checkout link that disables when items are expired
- Built complete checkout flow: 3-section page (cart review, address selection, order summary) with multi-seller grouping, expired item validation, and 409/400 error handling
- Created address management with CEP masking, Brazilian state dropdown, default address selection, and standalone CRUD page with edit/delete/set-default actions
- Added comprehensive PT-BR translations for cart, checkout, and addresses sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Build cart sidebar with countdown and item management** - `e44556f` (feat)
2. **Task 2: Build checkout page with address selection and order creation** - `389a665` (feat)

## Files Created/Modified
- `apps/web/src/contexts/cart-context.tsx` - CartProvider with shared cartCount, refreshCart, increment/decrement
- `apps/web/src/components/features/cart/cart-countdown.tsx` - useCartCountdown hook + CartCountdown display component
- `apps/web/src/components/features/cart/cart-item-card.tsx` - Cart item with cover, condition, price, seller, countdown, remove
- `apps/web/src/components/features/cart/cart-summary.tsx` - Totals, clear cart, checkout button (disabled when expired)
- `apps/web/src/components/features/cart/cart-sidebar.tsx` - Right-side Sheet with item list, empty state, summary footer
- `apps/web/src/components/features/checkout/checkout-page.tsx` - 3-section checkout with address + order review + placement
- `apps/web/src/components/features/checkout/address-selector.tsx` - Radio-style address cards with inline form toggle
- `apps/web/src/components/features/checkout/address-form.tsx` - Address form with CEP masking, state dropdown, zod validation
- `apps/web/src/components/features/checkout/order-review.tsx` - Multi-seller item grouping with subtotals and grand total
- `apps/web/src/app/[locale]/(collector)/checkout/page.tsx` - Checkout route (requires auth via collector layout)
- `apps/web/src/app/[locale]/(collector)/addresses/page.tsx` - Standalone address management page
- `apps/web/src/components/ui/scroll-area.tsx` - ScrollArea shadcn/ui component for sidebar scroll
- `apps/web/src/components/layout/header.tsx` - Added cart icon with count badge (authenticated only)
- `apps/web/src/app/[locale]/layout.tsx` - Wrapped app with CartProvider inside AuthProvider
- `apps/web/src/messages/pt-BR.json` - Added cart, checkout, addresses translation sections
- `apps/web/src/components/features/marketplace/listing-detail.tsx` - Wired addToCart to CartProvider incrementCount
- `apps/web/package.json` - Added @radix-ui/react-scroll-area dependency

## Decisions Made
- CartProvider wraps at locale layout level inside AuthProvider so all components (header, sidebar, listing detail) share the same cart state without prop drilling
- Cart badge uses optimistic count updates for instant feedback -- incrementCount called after successful addToCart, decrementCount after removeFromCart, full refreshCart on sidebar open
- Countdown timer runs with 1-second interval and auto-clears when expired; displays yellow warning under 1 hour, red "Reserva expirada" when countdown reaches zero
- Address selector uses custom radio-style cards (not radix RadioGroup) for richer layout with address details, labels, and default badge
- CEP masking implemented via simple onChange handler formatting to XXXXX-XXX pattern rather than adding a mask library dependency
- Order review groups by seller using Map-based grouping; shows "Cada vendedor envia separadamente" notice when multiple sellers involved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ScrollArea shadcn/ui component**
- **Found during:** Task 1 (cart sidebar)
- **Issue:** Cart sidebar needs scrollable item list; ScrollArea component not yet installed
- **Fix:** Installed @radix-ui/react-scroll-area and created ScrollArea component
- **Files modified:** apps/web/package.json, apps/web/src/components/ui/scroll-area.tsx
- **Verification:** Build passes, sidebar scrolls correctly
- **Committed in:** e44556f (Task 1 commit)

**2. [Rule 1 - Bug] Fixed zodResolver type mismatch with boolean default**
- **Found during:** Task 2 (address form)
- **Issue:** `z.boolean().default(false)` creates input type `boolean | undefined` but output type `boolean`, causing zodResolver type incompatibility with react-hook-form
- **Fix:** Changed to `z.boolean()` and set default value via useForm defaultValues instead
- **Files modified:** apps/web/src/components/features/checkout/address-form.tsx
- **Verification:** Build passes, form validates correctly
- **Committed in:** 389a665 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for functionality. No scope creep.

## Issues Encountered
None - both tasks executed cleanly after auto-fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cart UI complete and ready for end-to-end testing with real data
- Checkout flow wired to createOrder API, will navigate to order confirmation (orders/:id) which will be built in plan 04-07
- Address management available standalone at /addresses and inline during checkout
- CartProvider state shared across all components, ready for future marketplace interactions

---
*Phase: 04-marketplace-and-orders*
*Completed: 2026-02-27*
