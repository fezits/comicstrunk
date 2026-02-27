# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Collectors can catalog, track, and organize their physical comic book collection — knowing exactly what they have, what they've read, and what's missing from their series.
**Current focus:** Phase 4 — Marketplace and Orders

## Current Position

Phase: 4 of 10 (Marketplace and Orders)
Plan: 7 of 7 in current phase
Status: PHASE 04 COMPLETE
Last activity: 2026-02-27 — Completed 04-07 (order management UI for buyers and sellers)

Progress: [████████████████████████████████] 35%

## Performance Metrics

**Velocity:**
- Total plans completed: 25
- Average duration: 8 min
- Total execution time: 3.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 7/8 | 80 min | 11 min |
| 2. Catalog | 7/7 | 37 min | 5 min |
| 3. Collection | 4/4 | 29 min | 7 min |
| 4. Marketplace | 7/7 | 70 min | 10 min |

**Recent Trend:**
- Last 5 plans: 03-02 (10 min), 03-03 (6 min), 03-04 (4 min), 04-01 (10 min), 04-04 (7 min)
- Trend: Steady

*Updated after each plan completion*
| Phase 01 P01 | 16min | 2 tasks | 22 files |
| Phase 01 P02 | 12min | 2 tasks | 7 files |
| Phase 01 P03 | 15min | 2 tasks | 8 files |
| Phase 01 P05 | 8min | 1 task | 5 files |
| Phase 01 P04 | 8min | 2 tasks | 15 files |
| Phase 01 P06 | 13min | 1 task | 31 files |
| Phase 01 P06b | 8min | 1 task | 17 files |
| Phase 02 P01 | 6min | 2 tasks | 11 files |
| Phase 02 P02 | 7min | 3 tasks | 10 files |
| Phase 02 P03 | 5min | 2 tasks | 3 files |
| Phase 02 P04 | 4min | 2 tasks | 2 files |
| Phase 02 P05 | 5min | 2 tasks | 6 files |
| Phase 02 P06 | 4min | 2 tasks | 10 files |
| Phase 02 P07 | 6min | 2 tasks | 12 files |
| Phase 03 P01 | 9min | 2 tasks | 7 files |
| Phase 03 P02 | 10min | 2 tasks | 4 files |
| Phase 03 P03 | 6min | 2 tasks | 4 files |
| Phase 03 P04 | 4min | 2 tasks | 4 files |
| Phase 04 P01 | 10min | 2 tasks | 16 files |
| Phase 04 P02 | 5min | 2 tasks | 3 files |
| Phase 04 P03 | 9min | 2 tasks | 4 files |
| Phase 04 P04 | 7min | 2 tasks | 4 files |
| Phase 04 P05 | 13min | 2 tasks | 15 files |
| Phase 04 P06 | 14min | 2 tasks | 17 files |
| Phase 04 P07 | 12min | 2 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phase 9 (Affiliate Deals) depends only on Phase 2 and can be pulled forward if early revenue is needed — currently placed at Phase 9 to maximize audience reach at launch
- [Roadmap]: Phase 7 (Community) and Phase 8 (Disputes) both depend on Phase 5; either can run second if sequencing needs to change
- [Infra]: cPanel deployment must be validated in Phase 1 before any application code beyond the scaffold — it is a go/no-go gate (research flag)
- [Payments]: Mercado Pago v2 SDK specifics for PIX QR generation should be verified against current developer docs before Phase 5 coding begins (research flag)
- [01-01]: API and contracts compile to CommonJS for Node.js/Passenger runtime compatibility
- [01-01]: Next.js standalone output disabled on Windows dev; will be enabled in cPanel plan (01-03)
- [01-01]: Turborepo v2 uses 'tasks' field not 'pipeline' (research doc had outdated example)
- [01-01]: Contracts package points main/types to dist/ (built CJS), not src/ (raw TS)
- [01-02]: Prisma 5.22.0 pinned (not latest) for Node.js 20.9.0 compatibility
- [01-02]: Migration generated offline via prisma migrate diff (no live DB required)
- [01-02]: All 40 models defined upfront so no destructive migrations in future phases
- [01-02]: Seed uses deterministic IDs and upsert for idempotent reruns
- [01-03]: Next.js standalone output enabled conditionally via CI or STANDALONE env var (avoids Windows symlink EPERM)
- [01-03]: Prisma client singleton created in shared/lib for reuse across API modules
- [01-03]: HTTPS enforcement handled by Apache .htaccess rewrite rules, not Express middleware
- [01-03]: cPanel production deployment deferred to later validation -- local dev confirmed working
- [01-05]: Contracts kept CJS build output (dist/) for Node.js runtime -- not switched to direct TS consumption
- [01-05]: Password schema reused between signup and reset-confirm via shared Zod constant
- [01-05]: Social handle transforms strip leading @ during Zod parse
- [01-04]: JWT secrets validated at module load via requireEnv() helper -- app fails fast if secrets missing
- [01-04]: Refresh token stored in httpOnly cookie scoped to /api/v1/auth/refresh path only
- [01-04]: Password reset uses console logger placeholder (email service deferred to Phase 7)
- [01-04]: Router exports need explicit Router type annotation due to pnpm strict isolation (TS2742)
- [01-04]: Added dotenv/config import at top of app.ts for env var loading
- [01-06]: Space Grotesk chosen as primary font for geometric/technical aesthetic fitting dark immersive vibe
- [01-06]: next-intl v4 used instead of v3 per research -- API compatible with plan patterns
- [01-06]: Purple primary CSS variable (263 84% 55%) with blue secondary (217 91% 60%) in both light/dark themes
- [01-06]: Sonner used for toasts positioned bottom-right; globals.css moved from src/app/ to src/styles/
- [01-06b]: Navigation organized into 5 groups (Explorar, Colecao, Pedidos, Conta, Admin) with collapsible sections
- [01-06b]: Admin nav group filtered by default -- role-based visibility deferred to Phase 10
- [01-06b]: API client uses coordinated single-promise pattern for 401 token refresh to prevent race conditions
- [01-06b]: Auth layout uses centered card (no sidebar/header); all other route groups use sidebar+header shell
- [01-06b]: Landing page moved to (public) route group with feature highlight cards
- [02-01]: Cloudinary returns empty URL/publicId when unconfigured (dev fallback, no crash)
- [02-01]: Upload middleware uses explicit RequestHandler return type for pnpm strict isolation TS2742 compat
- [02-01]: Slug uniqueSlug uses unknown intermediate cast for Prisma dynamic model delegate access
- [02-01]: CSV MIME filter accepts text/csv, application/vnd.ms-excel, and .csv extension fallback
- [02-02]: req.params.id cast to string via 'as string' for Express qs v2 typing compatibility (params are string|string[])
- [02-02]: Taxonomy seed script runs standalone via npx tsx, uses upsert on unique slug for idempotent re-runs
- [02-02]: Delete operations check _count.catalogEntries > 0 before allowing taxonomy entity removal
- [02-03]: Interactive $transaction used for junction table updates (batched array overload has TypeScript generic incompatibility)
- [02-03]: Public catalog endpoints return 404 for non-APPROVED entries to prevent draft content leakage
- [02-03]: Admin list route (/admin/list) placed before /:id in Express router to prevent path collision
- [02-03]: Cloudinary old image cleanup extracts publicId via regex URL pattern match
- [02-04]: GET / root path delegates to searchCatalog for both unfiltered browsing and filtered search
- [02-04]: CSV import creates entries as DRAFT status, not PENDING or APPROVED
- [02-04]: Series lookup during CSV import uses case-insensitive contains match on title
- [02-04]: Import capped at 1000 rows per CSV file to prevent memory issues
- [02-05]: Series listing uses client-side fetching with URL search params for search state persistence
- [02-05]: Edition ratings display star icon with numeric rating and count, fallback to 'Sem avaliacoes'
- [02-05]: Progress indicator shows 'X de Y edicoes' when totalEditions known, otherwise just count
- [02-06]: URL search params sync for filter state persistence, enabling shareable/bookmarkable catalog URLs
- [02-06]: Grid/list view toggle with separate CatalogCard and CatalogListItem components
- [02-06]: Collapsible filter panel on desktop (toggle button) with Sheet drawer on mobile
- [02-06]: Half-star rating via CSS overflow clipping on lucide Star icon
- [02-06]: 400ms debounce on search input to reduce API calls during typing
- [02-07]: Admin taxonomy CRUD uses inline dialog pattern (create/edit in same modal) for consistency
- [02-07]: Delete blocked when catalog entry count > 0 with disabled button and tooltip hint
- [02-07]: ApprovalBadge uses shadcn Badge variant mapping: DRAFT=outline, PENDING=secondary, APPROVED=default, REJECTED=destructive
- [03-01]: BadRequestError details typed as unknown to support both object and array payloads
- [03-01]: Photo cleanup on removePhoto silently continues if Cloudinary/local deletion fails
- [03-01]: photoUrls stored as Json? field set to Prisma.JsonNull when empty instead of empty array
- [03-02]: Quick add button on catalog detail uses default values for fast workflow; 'Add with details' link provides full form
- [03-02]: Missing editions fetched lazily on expand to prevent N+1 queries on page load
- [03-02]: Missing editions link to individual catalog detail pages, not to search results
- [Phase 03]: [03-03]: BadRequestError for photo limit uses inline message (constructor only accepts 1 arg)
- [Phase 03]: [03-03]: Migration marked as already applied via prisma migrate resolve since photo_urls column existed from dist
- [Phase 03]: [03-04]: Plan limit detection uses axios error status 400 + message.includes('Collection limit reached') pattern
- [Phase 03]: [03-04]: Photo section only rendered in non-editing view to avoid layout conflicts with edit form
- [Phase 04]: [04-01]: Commission auto-seed on first getCommissionRate call ensures configs exist without manual migration
- [Phase 04]: [04-01]: Marketplace endpoints are fully public (no auth middleware) for unauthenticated browsing
- [Phase 04]: [04-01]: commissionPreviewSchema uses z.coerce.number() for query param parsing
- [Phase 04]: [04-01]: Cron jobs registered in createApp() after route registration but before error handler
- [Phase 04]: [04-02]: Interactive $transaction for addToCart prevents race conditions on unique physical items
- [Phase 04]: [04-02]: Cart items include remainingMs for frontend countdown display
- [Phase 04]: [04-02]: Static route /summary placed before /:id in Express router to prevent path collision
- [Phase 04]: [04-03]: updateShippingMethodSchema added as partial of createShippingMethodSchema for consistent CRUD validation
- [Phase 04]: [04-03]: Default address auto-promotion on delete uses most recent (createdAt desc) remaining address
- [Phase 04]: [04-03]: Tracking update only allowed in PROCESSING status to enforce correct order lifecycle
- [Phase 04]: [04-04]: Order state machine defined as separate utility for reuse across services, cron, and dispute resolution
- [Phase 04]: [04-04]: createOrder uses interactive $transaction for atomicity across cart read, address validation, order creation, and cart clear
- [Phase 04]: [04-04]: Shipping address snapshot captures all fields as JSON at order creation for immutable audit trail
- [Phase 04]: [04-04]: syncOrderStatus auto-promotes order to COMPLETED/CANCELLED when all items reach terminal state
- [Phase 04]: [04-04]: Buyer restricted to COMPLETED/DISPUTED transitions; seller handles all other item status advancement
- [Phase 04]: MarketplaceCard uses single component with variant prop (grid/list) instead of separate components
- [Phase 04]: Seller profile page derived from marketplace listings by sellerId filter (no dedicated profile API)
- [Phase 04]: Added sellerId filter to marketplace contract and service for seller profile page
- [Phase 04]: Commission transparency only shown to authenticated users (previewCommission requires auth)
- [Phase 04]: CartProvider wraps locale layout inside AuthProvider for shared cart state across header, sidebar, and listing detail
- [Phase 04]: Cart badge uses optimistic count updates (increment/decrement) for instant UI feedback
- [Phase 04]: Address selector uses custom radio-style cards (not radix RadioGroup) for richer layout
- [Phase 04]: CEP masking via simple onChange handler rather than mask library dependency

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] cPanel production deployment not yet validated — deployment scripts and config ready, awaiting hosting environment setup (user approved deferral)
- [Phase 5] Mercado Pago v2 webhook payload structure may have changed; verify at developers.mercadopago.com before coding
- [Phase 2] Initial catalog seed data resolved -- 12 categories, 13 publisher tags, 9 characters seeded via seed-taxonomy.ts

## Session Continuity

Last session: 2026-02-27
Stopped at: Phase 04 COMPLETE — all 7 plans executed (marketplace, cart, shipping, orders, UI)
Resume file: .planning/phases/04-marketplace-and-orders/04-07-SUMMARY.md
