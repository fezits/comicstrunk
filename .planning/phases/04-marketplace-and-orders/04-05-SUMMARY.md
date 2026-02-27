---
phase: 04-marketplace-and-orders
plan: 05
subsystem: ui
tags: [next.js, react, marketplace, i18n, shadcn-ui, tailwind, axios]

# Dependency graph
requires:
  - phase: 04-marketplace-and-orders
    provides: Commission API, marketplace search API, cart API endpoints
  - phase: 02-catalog
    provides: Catalog browse UI patterns (card, filters, listing page, URL params sync)
  - phase: 03-collection-management
    provides: ItemCondition type, collection item model with isForSale/salePrice
provides:
  - Marketplace browse page with search, filters, grid/list view, and URL param sync
  - Listing detail page with commission transparency and add-to-cart
  - Seller public profile page with their active listings
  - 5 frontend API client modules (marketplace, cart, shipping, orders, commission)
  - PT-BR translations for marketplace section
affects: [04-06-cart-ui, 04-07-orders-ui, 05-payments]

# Tech tracking
tech-stack:
  added: []
  patterns: [marketplace-card-dual-variant, commission-transparency, seller-profile-from-listings]

key-files:
  created:
    - apps/web/src/lib/api/marketplace.ts
    - apps/web/src/lib/api/cart.ts
    - apps/web/src/lib/api/shipping.ts
    - apps/web/src/lib/api/orders.ts
    - apps/web/src/lib/api/commission.ts
    - apps/web/src/components/features/marketplace/marketplace-listing-page.tsx
    - apps/web/src/components/features/marketplace/marketplace-card.tsx
    - apps/web/src/components/features/marketplace/marketplace-filters.tsx
    - apps/web/src/components/features/marketplace/listing-detail.tsx
    - apps/web/src/app/[locale]/(public)/marketplace/page.tsx
    - apps/web/src/app/[locale]/(public)/marketplace/[id]/page.tsx
    - apps/web/src/app/[locale]/(public)/seller/[id]/page.tsx
  modified:
    - apps/web/src/messages/pt-BR.json
    - packages/contracts/src/marketplace.ts
    - apps/api/src/modules/marketplace/marketplace.service.ts

key-decisions:
  - "MarketplaceCard uses single component with variant prop (grid/list) instead of separate components"
  - "Seller profile page derived from marketplace listings by sellerId filter (no dedicated profile API)"
  - "Added sellerId filter to marketplace contract and service (Rule 3: blocking for seller profile)"
  - "Commission transparency only shown to authenticated users (previewCommission requires auth)"

patterns-established:
  - "Dual-variant card pattern: single component with 'grid'|'list' variant prop for marketplace items"
  - "Seller profile via marketplace listings: fetch sellerId-filtered listings to show seller info + items"
  - "BRL price formatting: Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })"

requirements-completed: [CART-03, CART-06, COMM-04]

# Metrics
duration: 13min
completed: 2026-02-27
---

# Phase 4 Plan 05: Marketplace Frontend Summary

**Marketplace browse UI with condition/price filters, listing detail with commission transparency, seller profile page, and 5 typed API client modules for cart/orders/shipping/commission/marketplace**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-27T18:25:11Z
- **Completed:** 2026-02-27T18:38:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created 5 frontend API client modules (marketplace, cart, shipping, orders, commission) with full TypeScript types following existing catalog.ts/collection.ts patterns
- Built marketplace browse page with search, condition/price/publisher filters, grid/list view toggle, URL search params sync for shareable filter URLs, and pagination
- Built listing detail page with commission transparency showing platform fee and seller net amount
- Built seller public profile page showing seller name, listing count, ratings placeholder, and their active listings with pagination
- Added comprehensive PT-BR translations for all marketplace strings including condition labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Create frontend API clients** - `d1958ad` (feat)
2. **Task 2: Build marketplace browse, listing detail, and seller profile pages** - `a1ee44c` (feat)

## Files Created/Modified
- `apps/web/src/lib/api/marketplace.ts` - Marketplace search, listing detail, seller listings, seller profile API functions
- `apps/web/src/lib/api/cart.ts` - Cart CRUD operations (add, get, summary, remove, clear)
- `apps/web/src/lib/api/shipping.ts` - Address CRUD, default address, shipping methods, tracking updates
- `apps/web/src/lib/api/orders.ts` - Order create, buyer/seller lists, detail by ID/number, cancel, status update
- `apps/web/src/lib/api/commission.ts` - Commission preview, admin config CRUD
- `apps/web/src/components/features/marketplace/marketplace-listing-page.tsx` - Main browse page with URL param sync
- `apps/web/src/components/features/marketplace/marketplace-card.tsx` - Dual-variant card (grid/list) with condition badges and BRL pricing
- `apps/web/src/components/features/marketplace/marketplace-filters.tsx` - Collapsible filter panel for condition, price range, publisher, sort
- `apps/web/src/components/features/marketplace/listing-detail.tsx` - Full listing page with commission transparency and add-to-cart
- `apps/web/src/app/[locale]/(public)/marketplace/page.tsx` - Marketplace browse route
- `apps/web/src/app/[locale]/(public)/marketplace/[id]/page.tsx` - Listing detail route
- `apps/web/src/app/[locale]/(public)/seller/[id]/page.tsx` - Seller public profile route
- `apps/web/src/messages/pt-BR.json` - Added marketplace section with all strings
- `packages/contracts/src/marketplace.ts` - Added sellerId filter to marketplaceSearchSchema
- `apps/api/src/modules/marketplace/marketplace.service.ts` - Added sellerId where clause to searchListings

## Decisions Made
- MarketplaceCard uses a single component with `variant` prop ('grid'|'list') instead of separate CatalogCard/CatalogListItem pattern -- simpler for marketplace where both variants share identical data shape
- Seller profile page fetches marketplace listings filtered by sellerId rather than a dedicated public profile endpoint -- avoids new API route while the seller info is embedded in listing data
- Commission transparency displayed only when user is authenticated (previewCommission endpoint requires auth to determine subscription plan rate)
- Added sellerId filter to marketplace contract schema and service as a Rule 3 auto-fix since the seller profile page cannot function without it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added sellerId filter to marketplace search**
- **Found during:** Task 1 (API client creation)
- **Issue:** The marketplace search schema and service did not support filtering by sellerId, which is required for the seller profile page to show only that seller's listings
- **Fix:** Added `sellerId: z.string().optional()` to marketplaceSearchSchema in contracts, added `where.userId = sellerId` filter in marketplace service
- **Files modified:** packages/contracts/src/marketplace.ts, apps/api/src/modules/marketplace/marketplace.service.ts
- **Verification:** API build passes, seller profile page can fetch seller-specific listings
- **Committed in:** d1958ad (Task 1 commit)

**2. [Rule 1 - Bug] Fixed lint errors preventing web build**
- **Found during:** Task 2 (build verification)
- **Issue:** Unused imports (Calendar, Badge, tCommon) and invalid ESLint rule reference (react-hooks/exhaustive-deps not configured)
- **Fix:** Removed unused imports from seller/[id]/page.tsx and listing-detail.tsx, removed eslint-disable comment
- **Files modified:** seller/[id]/page.tsx, listing-detail.tsx, marketplace-listing-page.tsx
- **Verification:** pnpm --filter web build passes clean
- **Committed in:** a1ee44c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Feature branches from plans 04-01 through 04-04 were not yet merged to develop -- resolved by merging feature/04-04-orders-api into the new feature branch to get backend API code

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All frontend API clients ready for cart UI (plan 04-06) and orders UI (plan 04-07)
- Marketplace pages ready for integration testing with real data
- Cart button on marketplace cards and listing detail ready for CartProvider context (to be wired in 04-06)
- Commission transparency component ready for display when users are authenticated

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (d1958ad, a1ee44c) verified in git history.

---
*Phase: 04-marketplace-and-orders*
*Completed: 2026-02-27*
