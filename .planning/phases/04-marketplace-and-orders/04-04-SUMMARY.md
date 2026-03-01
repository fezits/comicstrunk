---
phase: 04-marketplace-and-orders
plan: 04
subsystem: api
tags: [express, prisma, orders, state-machine, commission-snapshot, multi-seller]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Contract schemas (createOrderSchema, updateOrderItemStatusSchema, listOrdersSchema), commission service, order-number generator, currency utility"
  - phase: 04-02
    provides: "Cart service with reservation-based items and clearCart"
  - phase: 04-03
    provides: "Shipping address CRUD for order address snapshots"
provides:
  - "Order creation from cart with price/commission/sellerNet snapshots"
  - "Order state machine (ORDER_TRANSITIONS, ORDER_ITEM_TRANSITIONS)"
  - "Multi-seller order support with per-item status tracking"
  - "Buyer and seller order listing endpoints"
  - "Order cancellation with eligible-item filtering"
  - "Order item status update with role-based permissions"
  - "Orders routes mounted at /api/v1/orders"
affects: [04-05-checkout-flow, 04-06-cart-ui, 04-07-seller-dashboard, 05-payments, 08-disputes]

# Tech tracking
tech-stack:
  added: []
  patterns: [order-state-machine, price-snapshot-on-create, auto-sync-order-status]

key-files:
  created:
    - apps/api/src/shared/lib/order-state-machine.ts
    - apps/api/src/modules/orders/orders.service.ts
    - apps/api/src/modules/orders/orders.routes.ts
  modified:
    - apps/api/src/create-app.ts

key-decisions:
  - "Order state machine defined as separate utility with assertOrderTransition/assertOrderItemTransition for reuse across services"
  - "createOrder uses interactive $transaction for atomicity across cart read, address validation, order creation, and cart clear"
  - "Shipping address snapshot captures all fields as JSON at order creation time for immutable audit trail"
  - "syncOrderStatus auto-promotes order to COMPLETED/CANCELLED when all items reach terminal state"
  - "Buyer can only transition items to COMPLETED or DISPUTED; seller handles all other transitions"

patterns-established:
  - "State machine pattern: separate transitions record + assertion function that throws BadRequestError on invalid transition"
  - "Snapshot pattern: all financial values (price, commissionRate, commissionAmount, sellerNet) captured at order creation as NOT NULL Decimal fields"
  - "Auto-sync pattern: after each item status update, check if all items in order have reached terminal state and update order accordingly"
  - "Role-based item update: buyer confirms delivery (COMPLETED/DISPUTED), seller advances processing states"

requirements-completed: [ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, COMM-05]

# Metrics
duration: 7min
completed: 2026-02-27
---

# Phase 4 Plan 04: Orders API Summary

**Order creation from cart with immutable price/commission snapshots, ORD-YYYYMMDD-XXXXXX identifiers, multi-seller per-item status tracking, and state machine enforcement**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-27T18:13:40Z
- **Completed:** 2026-02-27T18:21:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built order state machine with separate ORDER_TRANSITIONS and ORDER_ITEM_TRANSITIONS maps including REFUNDED terminal state for items
- Created order service with full cart-to-order flow: fetch active cart items, validate address, generate unique order number with retry, snapshot all financial values per item, clear cart
- Implemented buyer/seller order listing with seller-filtered items (sellers only see their own items in multi-seller orders)
- Order item status update with role-based permissions and auto-sync to order-level COMPLETED/CANCELLED
- Order cancellation cancels all eligible items (excludes COMPLETED/SHIPPED/DELIVERED)
- Mounted 7 endpoints at /api/v1/orders with authenticate middleware

## Task Commits

All work committed as a single logical unit:

1. **Tasks 1-2: Order state machine + service + routes + app mount** - `e25ec02` (feat)

## Files Created/Modified
- `apps/api/src/shared/lib/order-state-machine.ts` - ORDER_TRANSITIONS, ORDER_ITEM_TRANSITIONS records with assertOrderTransition/assertOrderItemTransition functions
- `apps/api/src/modules/orders/orders.service.ts` - createOrder, getOrder, getOrderByNumber, listBuyerOrders, listSellerOrders, updateOrderItemStatus, cancelOrder
- `apps/api/src/modules/orders/orders.routes.ts` - 7 route handlers: POST /, GET /buyer, GET /seller, GET /number/:orderNumber, GET /:id, PATCH /:id/cancel, PATCH /items/:itemId/status
- `apps/api/src/create-app.ts` - Mounted ordersRoutes at /api/v1/orders

## Decisions Made
- Order state machine defined as separate utility (not inline in service) for reusability across order service, cron jobs, and future dispute resolution
- Interactive `$transaction` ensures atomicity: cart read + address validation + order creation + cart clear happen in single transaction
- Shipping address snapshot captures all address fields as JSON (id, label, street, number, complement, neighborhood, city, state, zipCode) at order time
- `syncOrderStatus` automatically promotes order to COMPLETED when all items complete, or CANCELLED when all items cancel
- Buyer role-restricted to only COMPLETED and DISPUTED transitions; seller handles PAID->PROCESSING->SHIPPED and other advancement
- When item reaches COMPLETED, collection item marked isForSale=false and salePrice=null (item sold)
- Order number generation uses 3-attempt retry loop for collision handling on unique constraint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Orders API complete and ready for checkout flow UI (04-05)
- Order creation endpoint ready for frontend cart-to-checkout integration (04-06)
- Seller order listing ready for seller dashboard (04-07)
- Order item status update ready for payment webhook status advancement (Phase 5)
- State machine ready for dispute resolution transitions (Phase 8)

## Self-Check: PASSED

All 3 created files verified on disk. 1 modified file verified. Commit e25ec02 verified in git history.

---
*Phase: 04-marketplace-and-orders*
*Completed: 2026-02-27*
