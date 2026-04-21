---
phase: 04-marketplace-and-orders
plan: 07
subsystem: ui
tags: [next.js, react, orders, seller-dashboard, tracking, shadcn-ui, tailwind, i18n]

# Dependency graph
requires:
  - phase: 04-marketplace-and-orders
    provides: Orders API, shipping/tracking API, cart/checkout UI, marketplace UI patterns
  - phase: 01-foundation
    provides: AuthProvider context, authenticated layout shell, next-intl i18n
provides:
  - OrderStatusBadge component mapping all order/item statuses to colored Badge variants with PT-BR labels
  - OrderStatusTimeline vertical timeline showing order lifecycle progression with dates
  - BuyerOrdersPage with pagination and status filter dropdown
  - OrderDetailPage with timeline, per-item tracking, multi-seller grouping, cancel with confirmation
  - SellerOrdersPage dashboard listing orders containing seller's items
  - SellerOrderDetail with financial summary (commission, seller net) and inline tracking form
  - TrackingForm with carrier select (Correios PAC/SEDEX, Jadlog, Total Express, Loggi, Outro)
  - (orders) and (seller) route group layouts with auth protection
  - PT-BR translations for orders and seller sections
affects: [05-payments, 08-disputes]

# Tech tracking
tech-stack:
  added: []
  patterns: [order-status-badge-mapping, vertical-timeline, seller-order-filtering, tracking-form-inline]

key-files:
  created:
    - apps/web/src/components/features/orders/order-status-badge.tsx
    - apps/web/src/components/features/orders/order-status-timeline.tsx
    - apps/web/src/components/features/orders/buyer-orders-page.tsx
    - apps/web/src/components/features/orders/order-detail-page.tsx
    - apps/web/src/components/features/orders/seller-orders-page.tsx
    - apps/web/src/components/features/orders/seller-order-detail.tsx
    - apps/web/src/components/features/orders/tracking-form.tsx
    - apps/web/src/app/[locale]/(orders)/layout.tsx
    - apps/web/src/app/[locale]/(orders)/orders/page.tsx
    - apps/web/src/app/[locale]/(orders)/orders/[id]/page.tsx
    - apps/web/src/app/[locale]/(seller)/layout.tsx
    - apps/web/src/app/[locale]/(seller)/seller/orders/page.tsx
    - apps/web/src/app/[locale]/(seller)/seller/orders/[id]/page.tsx
  modified:
    - apps/web/src/messages/pt-BR.json

key-decisions:
  - "OrderStatusBadge uses Record<status, config> mapping for consistent styling across buyer and seller views"
  - "Timeline shows CANCELLED/DISPUTED as branch from the step where cancellation occurred"
  - "Seller order detail filters items by current user's sellerId to show only their items"
  - "Tracking form uses select with common Brazilian carriers (Correios PAC/SEDEX, Jadlog, Total Express, Loggi)"
  - "Route groups (orders) and (seller) have separate layouts with auth redirect protection"

patterns-established:
  - "OrderStatusBadge: reusable status-to-badge mapping for both OrderStatus and OrderItemStatus"
  - "Vertical timeline with CSS circles/lines for order lifecycle progression"
  - "Seller-side filtering: show only current user's items from multi-seller orders"

requirements-completed: [ORDR-04, ORDR-05, ORDR-06, ORDR-07, SHIP-04]

# Metrics
duration: ~12min
completed: 2026-02-27
---

# Phase 4 Plan 07: Order Management UI Summary

**Buyer order history/detail with status timeline, seller order dashboard with tracking code entry and financial transparency**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-27
- **Completed:** 2026-02-27
- **Tasks:** 2
- **Files created:** 13
- **Files modified:** 1

## Accomplishments
- Built buyer order history page with pagination and status filter (Pendente, Pago, Processando, Enviado, Entregue, Concluido, Cancelado)
- Created order detail page with vertical status timeline, per-item tracking with Correios tracking links, multi-seller grouping, and cancel functionality with confirmation dialog
- Built seller order dashboard listing orders containing their items with "Aguardando envio" badges for actionable items
- Created seller order detail showing only seller's items with financial summary (price, commission, seller-net)
- Built inline tracking form with carrier select (Correios PAC/SEDEX, Jadlog, Total Express, Loggi, Outro)
- Added comprehensive PT-BR translations for orders and seller sections

## Files Created/Modified
- `apps/web/src/components/features/orders/order-status-badge.tsx` - Badge mapping for all order/item statuses
- `apps/web/src/components/features/orders/order-status-timeline.tsx` - Vertical lifecycle timeline with dates
- `apps/web/src/components/features/orders/buyer-orders-page.tsx` - Order history with pagination and status filter
- `apps/web/src/components/features/orders/order-detail-page.tsx` - Full detail with timeline, tracking, cancel
- `apps/web/src/components/features/orders/seller-orders-page.tsx` - Seller order dashboard
- `apps/web/src/components/features/orders/seller-order-detail.tsx` - Seller detail with financial summary
- `apps/web/src/components/features/orders/tracking-form.tsx` - Tracking code + carrier entry form
- `apps/web/src/app/[locale]/(orders)/layout.tsx` - Orders route group layout with auth
- `apps/web/src/app/[locale]/(orders)/orders/page.tsx` - Buyer orders list route
- `apps/web/src/app/[locale]/(orders)/orders/[id]/page.tsx` - Order detail route
- `apps/web/src/app/[locale]/(seller)/layout.tsx` - Seller route group layout with auth
- `apps/web/src/app/[locale]/(seller)/seller/orders/page.tsx` - Seller orders list route
- `apps/web/src/app/[locale]/(seller)/seller/orders/[id]/page.tsx` - Seller order detail route
- `apps/web/src/messages/pt-BR.json` - Added orders and seller translation sections

## Decisions Made
- OrderStatusBadge uses a centralized Record mapping for consistent styling across all views
- Timeline component shows standard lifecycle steps with CANCELLED/DISPUTED as branches
- Seller views filter order items by current user's ID to show only their items
- Route groups use separate layouts with authentication redirect for clean separation
- Tracking form offers common Brazilian carriers as dropdown rather than free text

## Issues Encountered
None - both tasks executed cleanly.

## Next Phase Readiness
- All Phase 04 UI complete: marketplace browse, cart, checkout, buyer orders, seller orders
- Ready for Phase 05 (Payments) which will integrate PIX payment into the checkout and order flows
- Order status badge and timeline components reusable for Phase 08 (Disputes)

---
*Phase: 04-marketplace-and-orders*
*Completed: 2026-02-27*
