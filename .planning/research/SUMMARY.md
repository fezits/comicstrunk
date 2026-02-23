# Project Research Summary

**Project:** Comics Trunk
**Domain:** Comics collector platform — collection management + C2C marketplace + affiliate deals (Brazil)
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH

## Executive Summary

Comics Trunk is a Brazil-native comics collector platform occupying an uncontested niche: no existing product combines personal collection management, a C2C marketplace with PIX payments, and curated affiliate deals in Portuguese for the Brazilian market. The recommended approach is a pnpm monorepo with two decoupled apps — a Node.js/Express REST API and a Next.js 15 frontend — deployed to cPanel via PM2. MySQL with Prisma ORM handles persistence. The catalog is the central shared reference that underpins collections, marketplace listings, series tracking, and CSV import; it must be seeded and operational before most other features deliver value.

The key strategic insight from combined research is that this platform has three independent revenue streams (marketplace commissions, subscriptions, affiliate deals) and the affiliate deals stream has the fewest dependencies — it can go live before the marketplace is operational. This means revenue generation can begin early while the complex marketplace and payment infrastructure is being built. The feature dependency chain (Catalog → Collection → Marketplace → Payments → Subscriptions) defines a natural, non-negotiable build order, and the architecture research confirms this ordering with a concrete 11-phase build sequence.

The top risks are infrastructure and data integrity: cPanel deployment must be validated in Phase 1 before any application code is written (a failed deployment found late wastes months of work), and three concurrent-write race conditions (cart reservation, collection limit, webhook processing) must be solved with database-level atomicity from day one. These are not polish issues — they are correctness bugs that corrupt financial data and are extremely costly to remediate retroactively.

---

## Key Findings

### Recommended Stack

The stack is a well-integrated TypeScript-first monorepo. Express 4 (not 5, which is still in RC) serves as the API framework. Prisma 5 is the ORM — chosen over Drizzle for its migration tooling and Prisma Studio, which is especially valuable for an admin-heavy platform. On the frontend, Next.js 15 App Router with Tailwind CSS 3.4 and shadcn/ui is the dominant 2025 stack with zero runtime overhead from components. Custom JWT auth (not NextAuth/Auth.js) is required because the auth backend is a separate Express process — NextAuth is designed for Next.js-only projects and fights a separate API.

PIX payments use Mercado Pago (most trusted by Brazilian users, straightforward Node.js SDK) while Stripe handles subscription billing only. This clean separation avoids the complexity of Stripe Connect for marketplace payouts. Cloudinary free tier handles catalog cover images with CDN. Resend handles transactional email. The `packages/contracts` shared package (Zod schemas + TypeScript types) is the only thing shared between apps — never business logic or database clients.

**Core technologies:**
- Node.js 22 LTS / Express 4: API runtime — battle-tested, every cPanel tutorial uses Express, lowest-risk choice
- Next.js 15 App Router / React 19: Frontend — self-hosting improvements critical for cPanel; App Router is production-ready
- MySQL 8 / Prisma 5: Data layer — pre-decided; Prisma adds migrations, type-safe queries, and Prisma Studio
- TypeScript 5: End-to-end type safety across monorepo via shared `packages/contracts`
- pnpm 9 / Turborepo 2: Monorepo tooling — best workspace support and build caching
- Mercado Pago v2 SDK: PIX payments — most trusted Brazilian payment provider
- Stripe v17: Subscription billing — handles recurring billing cleanly in isolation
- TanStack Query v5: Server state management on frontend — replaces useEffect+fetch patterns
- Cloudinary SDK v2: Cover image storage — free tier sufficient for MVP, CDN included
- node-cron v3: Background workers (reservation expiry, subscription enforcement, deal expiry) — runs in-process on cPanel

### Expected Features

The competitive landscape analysis confirms Comics Trunk has no direct competitor in Brazil. Global platforms (CLZ Comics, League of Comic Geeks) are English-only with no PIX, no Brazilian publisher catalogs, and no C2C marketplace. Generic Brazilian marketplaces (OLX, Mercado Livre) have PIX but no comics-specific collection management. This gap is the structural moat.

**Must have (table stakes):**
- User auth (signup, login, password recovery) — gate for all personalized features
- Curated catalog with admin approval — must be seeded at launch; everything else depends on it
- Personal collection CRUD — core retention hook; reason collectors register
- Series tracking with progress — "15 of 42" is what makes collectors return
- PIX payment with QR code + copia-e-cola — Brazil: no PIX = platform is unusable
- Shopping cart with 24h reservation — correct UX for unique physical items
- Order system with full status lifecycle — fulfillment tracking
- Seller/buyer ratings (post-purchase only) — trust prerequisite for Brazilian C2C
- Dispute system with buyer→seller→admin mediation — OLX/Facebook have zero buyer protection; this is the differentiator
- Admin panel (catalog, users, commission config, affiliate deals) — operational necessity
- Subscription plans FREE + BASIC with collection limits — validates monetization
- CSV import/export — lowers switching cost from spreadsheets (current Brazilian status quo)
- Affiliate deals page (/deals) with curated offers — primary early revenue, minimal dependencies
- Transactional emails (welcome, payment, shipping, sale, reset) — user expectation
- Legal pages + LGPD compliance (delete, export) — legally required in Brazil
- Responsive layout + dark/light theme — mobile-first Brazil; dark default
- In-app notifications (polling) — minimum notification awareness

**Should have (competitive advantage):**
- Commission transparency at listing time — show seller net amount in BRL before they post (rare in niche C2C)
- PT-BR native — not a translation; Brazilian publishers, manga as first-class, BRL currency throughout
- Series missing-issues finder — link from collection gaps to marketplace listings (no Brazilian platform does this)
- Homepage configurable sections with "deals of the day" — drives affiliate clicks and repeat visits
- Affiliate click analytics for admin — clean data from day one

**Defer (v2+):**
- Trade system between users — requires structured messaging; complex trust model
- Barcode scan / AI cover recognition — catalog must have barcode data first
- Credit card payments (Stripe) — PIX covers ~70% of Brazilian digital payments; validate PIX first
- Real-time notifications (SSE) — polling is imperceptible for non-critical events at MVP scale
- Native mobile app — responsive web sufficient; app doubles infrastructure cost
- Spending reports and reading timelines — requires purchase history data to exist first
- Miniblog / news aggregation — editorial identity should be established before content investment

### Architecture Approach

The architecture is a clean three-layer monorepo: the Next.js frontend communicates exclusively with the Express API via typed REST endpoints; the API owns all business logic, database access, and external service integrations; `packages/contracts` holds only TypeScript types and Zod schemas — no runtime code, no database clients, no business logic. This strict boundary means the apps remain independently deployable. Background workers (cron jobs) run in-process via node-cron in MVP and share the same service layer as HTTP routes — they are not separate processes. Webhooks (Stripe, PIX) are isolated in their own handlers with mandatory idempotency checks before any business logic runs.

**Major components:**
1. `apps/api` — Feature modules (auth, catalog, collection, cart, orders, payments, subscriptions, deals, admin, users, notifications), each owning routes + service + schema; shared middleware layer (auth, rate-limit, validation); workers; webhooks
2. `apps/web` — Next.js App Router with route groups by access level: (public), (auth), (collector), (seller), (orders), (admin); typed API client in `lib/api/`; i18n in `i18n/`
3. `packages/contracts` — Single source of truth for API request/response shapes; eliminates type drift between API and frontend
4. MySQL / Prisma — Full schema defined upfront (all tables, even unused ones) to prevent migrations chaos; Prisma Studio for admin inspection
5. External services — Stripe (subscriptions), Mercado Pago (PIX), Cloudinary (images), Resend (email); all integrations owned exclusively by `apps/api`

### Critical Pitfalls

1. **Cart reservation race condition (double-sell)** — Use a single atomic `UPDATE ... WHERE status = 'available'` and check `affectedRows === 1`. Never do SELECT-then-UPDATE without a transaction. Add a unique constraint on `comic_id` in `cart_reservations`. This must be solved before any seller lists items. Recovery cost: HIGH (manual investigation, refunds, seller trust damage).

2. **PIX webhook without idempotency guard** — PIX providers send the same webhook multiple times. Without a `webhook_events` table with a unique constraint on `(provider, event_id)`, duplicate events create double commissions, duplicate emails, and corrupted audit logs. Build the idempotency layer first in the payments phase, before any PIX integration code. Recovery cost: MEDIUM-HIGH (financial reconciliation).

3. **PIX QR code expiration not synchronized with cart reservation** — Generate PIX QR only at checkout, set its TTL to `MIN(remaining_cart_time - 5min, 30min)`. A PIX code generated 23h into a 24h reservation that expires 10 minutes after the QR code is a real scenario. Add a grace-period hold for orphaned payments. Recovery cost: MEDIUM (refunds + manual admin review).

4. **Commission rate not snapshotted at order creation** — Store `price_snapshot`, `commission_rate_snapshot`, and `seller_net_snapshot` as NOT NULL columns on `order_items` at creation time. Never join to the current plan rate for historical orders. Forgetting to snapshot the commission while snapshotting the price is the most common missed case. Recovery cost: HIGH (schema migration + financial audit of all past orders).

5. **cPanel deployment not validated in Phase 1** — cPanel/Passenger has different restart mechanics (`touch tmp/restart.txt`), different environment variable loading, and different process lifecycle than PM2 on a VPS. Validate the full deployment pipeline with a trivial "hello world" app before writing any application code. This is a go/no-go gate for the entire stack. Recovery cost: can derail the project timeline if discovered mid-development.

---

## Implications for Roadmap

Based on research, the feature dependency chain and architecture build order together suggest an 8-phase roadmap. Architecture research documents an 11-step build sequence; the roadmap collapses related steps into cohesive phases that each deliver independently testable value.

### Phase 1: Foundation and Infrastructure
**Rationale:** Everything depends on this. Auth is a prerequisite for every personalized feature. The database schema must be defined fully upfront to prevent costly migrations. Most critically, the cPanel deployment pipeline must be validated before any application code is written — it is a go/no-go gate for the entire technical approach.
**Delivers:** Working monorepo scaffold, TypeScript/ESLint/Prettier config, full Prisma schema with all tables, API skeleton with middleware chain, JWT auth endpoints (register, login, refresh, logout, password reset), cPanel deployment pipeline validated end-to-end with health check endpoint.
**Addresses:** User authentication (table stakes), password recovery (table stakes), legal/LGPD foundation (data model).
**Avoids:** Pitfall 5 (cPanel deployment instability) — validate first, build second.
**Research flag:** NEEDS RESEARCH — cPanel-specific Node.js hosting behavior, Passenger restart mechanics, PM2 vs. Passenger decision. Validate with actual hosting provider before finalizing.

### Phase 2: Catalog Foundation
**Rationale:** The catalog is the backbone — collection management, marketplace listings, series tracking, CSV import, and reviews all depend on catalog entries existing. It must be built and seeded before any downstream feature delivers value. Admin approval workflow must be in place before catalog is opened to submissions.
**Delivers:** Catalog CRUD with admin approval queue (submit → review → approve/reject with reason), series/publisher/category/character taxonomy (admin-managed), full-text search with faceted filters and pagination, initial seed data (Brazilian publishers: Panini Brasil, Mythos, Devir; manga as first-class category).
**Addresses:** Curated catalog (table stakes), search and filter (table stakes), admin catalog approval (table stakes), admin panel — catalog section.
**Avoids:** User-generated catalog without approval (anti-feature — leads to duplicate/spam entries impossible to recover from).
**Research flag:** Standard patterns — admin CRUD with approval workflow is well-documented.

### Phase 3: Collection Management
**Rationale:** The collection is the core user retention hook — it is why collectors register. Series progress tracking and CSV import both depend on the collection existing. This phase unlocks the platform's primary value proposition before any marketplace or payment complexity is introduced.
**Delivers:** Personal collection CRUD (add/edit/remove physical copies linked to catalog entries), read status per copy (with date), condition grading (5-tier), series progress tracking with "missing issues" view, collection CSV import with error reporting and template download, collection CSV export, collection limit enforcement (atomic, server-side, with upgrade suggestion UX).
**Addresses:** Personal collection CRUD (table stakes), series tracking (table stakes), read status (table stakes), CSV import/export (differentiator), collection limits (subscription foundation).
**Avoids:** Pitfall 6 (collection limit race condition) — atomic INSERT with transaction; enforce server-side not frontend-only.
**Research flag:** Standard patterns.

### Phase 4: Marketplace Core and PIX Payments
**Rationale:** This phase is the highest technical risk and highest user value phase. Cart reservation, order creation, and PIX payment must be built together because the three systems are tightly coupled (PIX expiry must be synchronized with cart expiry). Idempotency infrastructure must be built before any payment code. All three critical data-integrity pitfalls (race condition, idempotency, commission snapshot) must be addressed in this single phase.
**Delivers:** Mark copy as for sale (with price, condition), marketplace listings page with search/filter, shopping cart with 24h atomic reservation (database-level lock), order creation with price+commission+seller-net snapshot, PIX QR code generation via Mercado Pago SDK with copia-e-cola text, PIX payment confirmation webhook with idempotency guard, order status lifecycle (PENDING → PAID → IN_PROCESSING → SHIPPED → DELIVERED), seller-updated shipping tracking codes, seller/buyer ratings (post-purchase only).
**Addresses:** Marketplace listings (table stakes), shopping cart (table stakes), PIX payment (table stakes), order tracking (table stakes), seller/buyer ratings (table stakes).
**Avoids:** Pitfall 1 (cart race condition), Pitfall 2 (webhook idempotency), Pitfall 3 (PIX/cart expiry mismatch), Pitfall 4 (commission snapshot).
**Research flag:** NEEDS RESEARCH — Mercado Pago v2 SDK specifics for PIX QR generation and webhook verification. Verify current sandbox credentials flow and production HMAC validation requirements before coding.

### Phase 5: Subscriptions and Plan Enforcement
**Rationale:** Subscription infrastructure (Stripe Checkout Sessions + webhooks) builds on the webhook idempotency layer established in Phase 4. Plan enforcement (collection limits, commission rates) requires both the collection (Phase 3) and payment infrastructure (Phase 4) to be in place. The automatic downgrade worker closes the loop on subscription lifecycle.
**Delivers:** FREE and BASIC subscription plans, Stripe Checkout Session integration for BASIC plan purchase, Stripe webhook handler (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted) with idempotency guard, commission rate differentiation at order creation (BASIC: 8%, FREE: 10%), automatic subscription downgrade worker (daily reconciliation job), Stripe Customer Portal integration for self-service management, commission transparency UI (list price + commission amount + seller net — all three in BRL).
**Addresses:** Subscription plans (table stakes), commission differentiation (differentiator), plan-differentiated commissions (differentiator).
**Avoids:** Pitfall (subscription downgrade not applied) — Stripe webhook + daily reconciliation background job cross-check.
**Research flag:** Standard patterns — Stripe Checkout Sessions and webhook lifecycle are well-documented.

### Phase 6: Community, Notifications, and Trust
**Rationale:** Community features (reviews, comments, favorites) and the dispute system build on top of completed orders. They cannot be built before the order lifecycle is complete. The dispute system is a prerequisite for marketplace trust in Brazil — it should be in the same general phase as community rather than deferred, because Brazilian users have strong negative associations with the fraud patterns of OLX and Facebook groups.
**Delivers:** Catalog reviews (1-5 stars + text, one per user), catalog comments (single nesting level), seller profile pages (ratings, history, member since), dispute system (buyer opens → seller responds → admin mediates), favorites/wishlist, in-app notifications (bell icon, polling every 30-60 seconds), notification data model and preferences, transactional emails (welcome, payment confirmed, order shipped, item sold, password reset).
**Addresses:** Catalog reviews (table stakes), seller ratings (table stakes), dispute system (differentiator), in-app notifications (table stakes), transactional emails (table stakes), favorites (table stakes).
**Avoids:** Anti-feature: real-time chat (WebSocket complexity, moderation surface, liability).
**Research flag:** Standard patterns — Resend SDK is well-documented; dispute state machines are standard.

### Phase 7: Affiliate Deals and Revenue
**Rationale:** The affiliate deals feature has the fewest external dependencies — it requires only an admin panel and the catalog category taxonomy (Phase 2). It has been deliberately positioned later in the roadmap because the affiliate audience is larger when collection and marketplace features are live and driving user registrations. However, if revenue pressure requires it, this phase could be moved to run in parallel with Phase 3. The click tracking integrity work must be done first.
**Delivers:** Admin affiliate deal CRUD (URL, affiliate tag stored separately, expiry date, category, active/inactive), deals page (/deals) with filters and auto-expiry, server-side click tracking with deduplication (1-hour window per user+offer), affiliate tag composed at redirect time (not embedded in stored URL), open-redirect protection (domain whitelist), affiliate click analytics dashboard for admin, CONAR-compliant disclosure notice on all deals pages, homepage configurable sections (banner, highlights, deals of the day).
**Addresses:** Affiliate deals page (differentiator — primary revenue), homepage with deals of the day (differentiator), affiliate click analytics (should-have).
**Avoids:** Pitfall 7 (affiliate tracking data corruption) — separate tag storage, deduplication, bot filtering, synchronous log-before-redirect.
**Research flag:** Standard patterns — affiliate redirect + click tracking is a well-understood pattern.

### Phase 8: Admin Panel, Legal, and Production Hardening
**Rationale:** The admin panel is partially built across all preceding phases (catalog approval in Phase 2, user management in Phase 1, commission config in Phase 5). This phase completes and unifies it. Legal pages and LGPD compliance are a legal requirement for a Brazilian platform handling financial data — they must be in place before the platform goes live in any public capacity.
**Delivers:** Unified admin dashboard (metrics: users, orders, revenue, catalog size), complete catalog approval queue UI, user management (view, suspend, adjust plan), commission and plan configuration with audit log, dispute management interface, legal document management with versioning (accept at signup, first listing), LGPD data deletion and export flows, contact form, seller bank account management (for admin payout processing), health check endpoint monitoring, production runbook documentation.
**Addresses:** Admin panel (table stakes), legal pages + LGPD (table stakes — legally required in Brazil), seller bank account (operational need).
**Avoids:** Security pitfall (commission changes without audit log), LGPD non-compliance (ANPD enforcement risk).
**Research flag:** Standard patterns — LGPD requirements are well-documented; admin CRUD is standard.

### Phase Ordering Rationale

- Auth and infrastructure must precede everything; cPanel validation is a go/no-go gate.
- Catalog must precede collection — users add copies of catalog items; without catalog data, collection has no value.
- Collection must precede subscriptions — limits cannot be enforced before collections exist.
- Marketplace and PIX must be built together — cart expiry and PIX expiry are tightly coupled; idempotency infrastructure established here is reused by subscriptions.
- Subscriptions build on the webhook pattern from marketplace payments — code reuse and pattern consistency.
- Community features require completed orders (ratings, disputes) — cannot be built before Phase 4 order lifecycle is complete.
- Affiliate deals are revenue-generating but audience-dependent — positioned after core retention features drive registrations, but can be parallelized with Phase 3 if revenue pressure requires it.
- Admin panel and legal are completed last because they consolidate admin surfaces built across all phases; legal must be complete before public launch.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** cPanel-specific deployment mechanics — Passenger vs. PM2, environment variable loading, `tmp/restart.txt` restart trigger. Validate with actual hosting provider account before finalizing the deployment runbook.
- **Phase 4:** Mercado Pago v2 SDK for PIX — QR code generation API, webhook payload structure, HMAC signature validation, sandbox vs. production credential differences. Verify against current MP developer documentation before coding.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Admin CRUD with approval workflow — well-documented Express + Prisma pattern.
- **Phase 3:** Collection management — standard CRUD with atomic counter pattern; no novel integrations.
- **Phase 5:** Stripe Checkout Sessions + webhooks — official Stripe documentation is comprehensive and authoritative.
- **Phase 6:** Email notifications (Resend SDK), dispute state machine — standard patterns.
- **Phase 7:** Affiliate redirect + click tracking — well-understood pattern.
- **Phase 8:** Admin dashboard, LGPD data export — standard patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core framework choices (Node.js, Next.js 15, Express, MySQL, Prisma, TypeScript) are HIGH confidence. PIX via Mercado Pago is MEDIUM — leading provider in Brazil, but SDK internals should be verified against current docs. Cloudinary and Resend free tier limits are LOW confidence (change frequently). |
| Features | MEDIUM | Competitive analysis is training-data based (no live web scraping). Table stakes features are HIGH confidence (first-party PRD). Brazil market gap and PIX adoption claim are MEDIUM (consistent with training data but not live-verified). |
| Architecture | HIGH | Structural patterns (service layer, module organization, snapshot pattern, webhook idempotency) are well-established in Node.js/Express ecosystems with strong consensus. cPanel-specific deployment behavior is MEDIUM. |
| Pitfalls | HIGH | All identified pitfalls are grounded in PRD business rules (RN01-RN19) and known ecosystem failure patterns. Race condition and idempotency pitfalls are especially well-documented in distributed systems literature. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Mercado Pago v2 SDK specifics:** Webhook payload structure and HMAC validation approach may have changed since training cutoff. Verify against current `https://developers.mercadopago.com` before Phase 4 coding begins.
- **Cloudinary / Resend free tier limits:** Both are LOW confidence and subject to change. Verify current limits at `cloudinary.com/pricing` and `resend.com/pricing` before launch planning.
- **cPanel hosting provider specifics:** Behavior varies by host. The PM2 vs. Passenger decision depends on whether the hosting plan uses cPanel's Node.js Selector (Passenger) or raw SSH + PM2. Confirm with the hosting provider before Phase 1 infra work.
- **Brazilian publisher catalog seed data:** The catalog must be seeded at launch for the platform to deliver value. The source and scope of initial seed data (Panini Brasil, Mythos, Devir titles) needs definition before Phase 2 begins.
- **Competitor feature verification:** CLZ Comics pricing tiers and LoCG recent feature additions are training-data-based. Recommend live verification before roadmap finalization if competitive positioning matters for launch messaging.

---

## Sources

### Primary (HIGH confidence)
- `docs/PRD.md` v3.0 — full product requirements, business rules RN01–RN19, feature specs §4.1–§4.24
- `.planning/PROJECT.md` — technical constraints (cPanel, MySQL, Node.js, Next.js, monorepo)
- Next.js 15 official blog (`https://nextjs.org/blog/next-15`) — Next.js version, React 19 support, self-hosting improvements

### Secondary (MEDIUM confidence)
- League of Comic Geeks, CLZ Comics, ComicBookRealm, MyComicShop — training knowledge of platforms as of mid-2025 (features may have changed)
- Mercado Pago developer documentation — PIX integration patterns in Brazil
- PIX adoption — Banco Central do Brasil reports (training knowledge)
- LGPD — Law 13.709/2018 (well-documented)
- Node.js LTS release schedule — LTS version dates
- Stripe Node.js SDK v17 — changelog and breaking changes
- next-intl GitHub — App Router compatibility
- shadcn/ui official site — component library approach
- TanStack Query v5 migration docs — React 19 support

### Tertiary (LOW confidence — verify before launch)
- Cloudinary free tier limits — 25GB storage, 25GB bandwidth/month — verify at `cloudinary.com/pricing`
- Resend free tier limits — 3,000 emails/month — verify at `resend.com/pricing`
- CONAR advertising standards — affiliate disclosure requirements (training knowledge)

---

*Research completed: 2026-02-21*
*Ready for roadmap: yes*
