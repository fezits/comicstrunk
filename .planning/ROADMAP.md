# Roadmap: Comics Trunk

## Overview

Comics Trunk is built in 10 phases, ordered by the hard dependency chain that underpins the platform: infrastructure must come before anything runs, catalog must exist before collections have meaning, collections must exist before the marketplace can reference them, and the marketplace must be live before payments, commissions, subscriptions, disputes, and community features can stand on top of it. Affiliate deals and admin/legal close out the build by consolidating revenue tooling and compliance requirements before public launch. Each phase delivers a coherent, independently testable capability — backend first, then frontend consuming that backend.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Infrastructure** - Monorepo scaffold, cPanel deployment validated, JWT auth endpoints, full Prisma schema, shared contracts package, i18n and theme system
- [ ] **Phase 2: Catalog and Taxonomy** - Curated catalog CRUD with editorial approval workflow, series/category/character taxonomy, full-text search with filters and pagination
- [ ] **Phase 3: Collection Management** - Personal collection CRUD, read status, condition grading, series progress tracking, CSV import/export, plan-enforced collection limits
- [ ] **Phase 4: Marketplace and Orders** - Mark copies for sale, marketplace listings, shopping cart with 24h atomic reservation, order creation with price/commission snapshots, shipping address management
- [ ] **Phase 5: Payments and Commissions** - PIX QR code via Mercado Pago, webhook idempotency, order status lifecycle, commission calculation and transparency, seller bank account registration
- [ ] **Phase 6: Subscriptions** - FREE and BASIC plans via Stripe, recurring billing, plan enforcement on collection limits and commission rates, automatic downgrade worker
- [ ] **Phase 7: Community and Notifications** - Catalog reviews and comments, seller ratings, favorites, in-app notification bell, transactional emails, notification preferences
- [ ] **Phase 8: Disputes** - Dispute opening, seller response, admin mediation, resolution and refund flow, payout hold during dispute
- [ ] **Phase 9: Affiliate Deals and Homepage** - Admin deal CRUD, /deals page with filters, affiliate tag composition, click tracking, admin analytics, configurable homepage sections
- [ ] **Phase 10: Admin Panel, Legal, and Production Hardening** - Unified admin dashboard, legal documents with versioning, LGPD compliance flows, contact form, HTTPS, monitoring, automated backups

## Phase Details

### Phase 1: Foundation and Infrastructure
**Goal**: The platform skeleton is running in production on cPanel with a validated deployment pipeline, all developers authenticated, and the full database schema defined — so no phase ever needs a destructive migration
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-10, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. A user can sign up with name, email, and password, receive a welcome response, log in, and remain logged in across browser refreshes
  2. A user can request a password reset email and use the link (valid for 1 hour) to set a new password
  3. The API is reachable at its production cPanel URL with HTTPS and returns a healthy status from the /health endpoint
  4. The Next.js frontend loads in production on cPanel with dark mode active by default, a theme toggle that persists across sessions, and text rendered in PT-BR
  5. A developer can run `pnpm migrate` to apply all database migrations to the production MySQL instance without errors
**Plans**: 8 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold: pnpm workspaces, Turborepo, TypeScript/ESLint/Prettier, apps/api + apps/web + packages/contracts (Wave 1)
- [x] 01-02-PLAN.md — Full Prisma schema: all tables for all 10 phases, initial migration, seed script (Wave 2)
- [x] 01-03-PLAN.md — cPanel deployment validation: Passenger config, health check, HTTPS, backups, deployment scripts (Wave 2)
- [ ] 01-04-PLAN.md — Authentication API: signup, login, refresh, logout, password reset, profile with social links, rate limiting (Wave 3)
- [ ] 01-05-PLAN.md — Shared contracts: Zod schemas + TypeScript types for auth, users, common (Wave 2)
- [ ] 01-06-PLAN.md — Frontend config: Next.js + next-intl + next-themes + Tailwind + shadcn/ui initialization (Wave 3)
- [ ] 01-06b-PLAN.md — Frontend layout: responsive sidebar, header, route groups, theme toggle, API client (Wave 3)
- [ ] 01-07-PLAN.md — Auth UI: signup, login, forgot-password, reset-password forms + auth context (Wave 4)

### Phase 2: Catalog and Taxonomy
**Goal**: A curated, searchable public catalog of comic books exists, seeded with Brazilian publishers, with an admin approval workflow ensuring editorial quality before any entry goes live
**Depends on**: Phase 1
**Requirements**: CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06, CATL-07, CATL-08, CATL-09, CATL-10, CATL-11, CATL-12, CATL-13, SERI-01, SERI-02, SERI-03, SERI-04
**Success Criteria** (what must be TRUE):
  1. A visitor can browse the catalog, apply combined filters (publisher, character, series, category), sort results, and paginate through them without logging in
  2. A catalog entry shows its title, cover image, author, publisher, series membership, average star rating, categories, tags, and associated characters
  3. An admin can submit a new catalog entry that appears in the approval queue, then approve or reject it with a reason — approved entries appear publicly, rejected entries do not
  4. An admin can bulk-import catalog entries from a CSV file and export the catalog as CSV
  5. A visitor can browse a series detail page listing all editions with their volume and edition numbers
**Plans**: 7 plans

Plans:
- [ ] 02-01-PLAN.md — Contracts schemas + shared API utilities (Cloudinary, multer, CSV, slug) (Wave 1)
- [ ] 02-02-PLAN.md — Taxonomy API: series, categories, tags, characters CRUD (Wave 2)
- [ ] 02-03-PLAN.md — Catalog API: CRUD, approval state machine, cover image upload (Wave 2)
- [ ] 02-04-PLAN.md — Catalog search with combined filters + CSV import/export (Wave 3)
- [ ] 02-05-PLAN.md — Series browse UI: listing with search, detail with editions (Wave 3)
- [ ] 02-06-PLAN.md — Catalog browse UI: filter sidebar, sort, pagination, detail page (Wave 3)
- [ ] 02-07-PLAN.md — Admin catalog management UI: approval queue, forms, CSV, taxonomy CRUD (Wave 4)

### Phase 3: Collection Management
**Goal**: Authenticated users can build and manage their personal comic book collection, track reading progress, monitor series completion, and import/export data — making the platform worth returning to before the marketplace exists
**Depends on**: Phase 2
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06, COLL-07, COLL-08, COLL-09, SERI-05, SERI-06, SERI-07
**Success Criteria** (what must be TRUE):
  1. A logged-in user can add a catalog entry to their collection with quantity, price paid, condition, and notes; edit those fields; and remove the copy
  2. A user can mark a copy as read (with a reading date) and mark a copy as for sale with a price
  3. A user can see their series progress — "15 of 42 editions" — and a dedicated page shows all their series with progress bars and a list of missing editions that links to catalog search
  4. A user on the FREE plan cannot add more than 50 copies and sees a clear message with an upgrade suggestion when they hit the limit; a BASIC user can add up to 200
  5. A user can download a CSV template, fill it, import it to populate their collection with error reporting for invalid rows, and export their collection to CSV
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Collection API: CRUD, read/sale status, CSV import/export, series progress, plan limits
- [x] 03-02-PLAN.md — Collection UI polish: add-to-collection on catalog detail, missing editions on series progress
- [ ] 03-03-PLAN.md — Gap closure: API source sync (missing-editions endpoint, photo upload routes/service, atomic $transaction) (Wave 1)
- [ ] 03-04-PLAN.md — Gap closure: Frontend plan limit UX + photo upload UI (Wave 2)

### Phase 4: Marketplace and Orders
**Goal**: Sellers can list copies for sale and buyers can discover them, add them to a cart with a 24-hour reservation, and create an order — with price, commission, and seller-net amounts all permanently snapshotted at order creation
**Depends on**: Phase 3
**Requirements**: CART-01, CART-02, CART-03, CART-04, CART-05, CART-06, CART-07, CART-08, ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, ORDR-08, SHIP-01, SHIP-02, SHIP-03, SHIP-04, SHIP-05, COMM-01, COMM-02, COMM-03, COMM-04, COMM-05
**Success Criteria** (what must be TRUE):
  1. A seller can mark a copy as for sale with a price and immediately sees the commission amount and net payout in BRL in real time; the listing appears in marketplace search
  2. A buyer can add a copy to their cart, see the 24-hour reservation countdown, and cannot add a copy already reserved by another buyer or listed by themselves
  3. A buyer can manage multiple delivery addresses and select one during checkout; the order is created with a unique identifier and all prices/commission/seller-net permanently snapshotted
  4. An order containing items from multiple sellers shows each item's shipping tracking separately; each item has its own status in the PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED flow
  5. A seller can enter a tracking code and carrier for a shipped item; items not shipped within 7 days are automatically cancelled
**Plans**: TBD

Plans:
- [ ] 04-01: Cart API — atomic cart reservation (UPDATE ... WHERE status = 'available', check affectedRows === 1), 24h expiry, max 50 items, session persistence, self-purchase prevention, expiry release cron, 7-day abandoned cart cleanup cron
- [ ] 04-02: Order API — order creation with unique identifier generation (ORD-YYYYMMDD-XXXXXX), price snapshot, commission snapshot (rate from seller's current plan), seller-net snapshot as NOT NULL columns; multi-seller order splitting; order status state machine
- [ ] 04-03: Shipping and address API — address CRUD (multiple addresses, default selection), admin-configurable shipping methods, seller tracking code update endpoint, shipping status notifications trigger, auto-cancel cron for unshipped items after 7 days
- [ ] 04-04: Commission API — commission rate lookup by seller plan (FREE: 10%, BASIC: 8%), admin rate configuration with min/max, real-time net amount calculation endpoint
- [ ] 04-05: Marketplace UI — marketplace listing page (search, filter by condition/price/publisher/character), seller profile public page, listing detail page with commission transparency display
- [ ] 04-06: Cart and checkout UI — cart sidebar/page with reservation countdown, multi-seller grouping, address selection at checkout, order summary with price + commission + seller-net per item
- [ ] 04-07: Order management UI — buyer order history page, order detail page (status timeline, per-item tracking), seller dashboard orders page, seller tracking code entry form

### Phase 5: Payments and Commissions
**Goal**: Buyers can pay for orders with PIX (QR code and copia-e-cola), payment status is confirmed automatically via webhook with idempotency protection, and sellers have a clear view of their payouts pending admin processing
**Depends on**: Phase 4
**Requirements**: PYMT-01, PYMT-02, PYMT-03, PYMT-04, PYMT-05, PYMT-06, PYMT-07, PYMT-08, COMM-06, BANK-01, BANK-02, BANK-03
**Success Criteria** (what must be TRUE):
  1. A buyer at checkout sees a PIX QR code and copia-e-cola string; after paying in their banking app, the order status updates to Paid automatically within minutes
  2. The same PIX webhook event delivered twice by Mercado Pago does not create duplicate commissions, emails, or status transitions — the idempotency guard blocks the duplicate silently
  3. An admin can manually confirm a PIX payment from the admin payment dashboard when auto-verification has not triggered
  4. A user can view their complete payment history with amounts, dates, and order references
  5. A seller can register a bank account (bank, branch, account, CPF, holder, account type) and admin can view all sellers' bank data for payout processing
**Plans**: TBD

Plans:
- [ ] 05-01: PIX payment API — Mercado Pago v2 SDK integration, QR code generation aligned with cart reservation TTL (MIN(remaining_cart_time - 5min, 30min)), copia-e-cola string, PIX expiry set to match cart reservation
- [ ] 05-02: Webhook handler — idempotency table (webhook_events with unique constraint on provider + event_id), PIX payment confirmation flow, order status transition to PAID, commission recording, duplicate event silent discard
- [ ] 05-03: Payment management API — admin manual payment approval endpoint, refund endpoint (total and partial), payment history endpoint, admin payment dashboard data endpoint
- [ ] 05-04: Seller banking API — bank account CRUD (multiple accounts, primary flag), admin view endpoint for payout processing, BANK-01/02/03 fields
- [ ] 05-05: Commission reporting API — admin commission dashboard data: totals by period, by plan, transaction list export
- [ ] 05-06: PIX payment UI — checkout PIX page with QR code display, copia-e-cola copy button, countdown timer (aligned with QR expiry), status polling (every 5s), success/failure states
- [ ] 05-07: Payment history UI — user payment history page, order-linked receipts, payment status badges
- [ ] 05-08: Admin payments UI — admin payment dashboard (pending approvals, manual confirm/reject), commission dashboard (totals by period, by plan, transaction list), sellers with pending payouts, seller bank data view
- [ ] 05-09: Seller banking UI — seller bank account registration form, multiple accounts list, primary account selection

### Phase 6: Subscriptions
**Goal**: Users can subscribe to the BASIC paid plan via Stripe, enjoy higher collection limits and lower commission rates, and the system automatically enforces plan rules and downgrades accounts when payments lapse
**Depends on**: Phase 5
**Requirements**: SUBS-01, SUBS-02, SUBS-03, SUBS-04, SUBS-05, SUBS-06, SUBS-07, SUBS-08, SUBS-09
**Success Criteria** (what must be TRUE):
  1. A FREE user can click "Upgrade to BASIC" and complete a Stripe Checkout Session; after successful payment, their plan is immediately updated to BASIC with 200-copy collection limit and 8% commission rate
  2. A BASIC subscriber who cancels keeps their benefits until the end of the current billing period, then is automatically downgraded to FREE
  3. A subscriber whose Stripe payment fails receives a notification and, after Stripe's final retry, is automatically downgraded to FREE — their existing collection entries above 50 are preserved but no new additions are allowed
  4. An admin can configure plan prices, trial period length, and activate/deactivate plans; commission rates per plan are configurable in admin
  5. A user can manage their subscription (view status, cancel, see next billing date) from their account settings
**Plans**: TBD

Plans:
- [ ] 06-01: Subscription API — Stripe Checkout Session creation for BASIC plan, configurable billing intervals (monthly/quarterly/semi-annual/annual), trial period support, plan activation/deactivation, admin plan price configuration
- [ ] 06-02: Stripe webhook handler — checkout.session.completed, customer.subscription.updated, customer.subscription.deleted events with idempotency guard (reuse webhook_events pattern from Phase 5); end-of-period downgrade scheduling; payment failure notification trigger
- [ ] 06-03: Subscription enforcement — daily reconciliation background worker (node-cron) cross-checks Stripe subscription status against local plan, auto-downgrades expired/failed subscriptions; collection limit re-enforcement on downgrade (block adds, preserve existing)
- [ ] 06-04: Admin subscription management API — admin approve/activate subscription changes endpoint, commission rate per-plan configuration (reuses COMM-03 admin endpoint from Phase 4), plan CRUD
- [ ] 06-05: Subscription UI — upgrade flow (plan comparison page, Stripe Checkout redirect, success/cancel return pages), Stripe Customer Portal integration for self-service management, subscription status display in account settings
- [ ] 06-06: Admin subscription management UI — plan management panel (create/edit/deactivate plans, set prices and trial period), commission rate configuration UI with impact preview

### Phase 7: Community and Notifications
**Goal**: Users can engage with the catalog through reviews, comments, and favorites; buyers and sellers can rate each other after transactions; and the platform communicates proactively via in-app notifications and transactional emails
**Depends on**: Phase 5
**Requirements**: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05, SOCL-06, SOCL-07, NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06, NOTF-07, NOTF-08, NOTF-09
**Success Criteria** (what must be TRUE):
  1. A logged-in user can write a 1-5 star review with text on a catalog entry, edit it later, and see the updated average rating reflected on the entry; a buyer can rate a seller only after a completed order
  2. A user can comment on a catalog entry, reply to a comment (one nesting level), and like any comment; they can favorite a catalog entry and access all favorites from their profile
  3. The notification bell icon shows an unread count badge; clicking it reveals a dropdown of recent notifications; a full notifications page shows all history with mark-as-read
  4. After key events, the affected user receives an email: welcome on signup, payment confirmed on order paid, shipping update when tracking code is added, sale alert when their copy sells, and password reset link on request — all emails are responsive and branded
  5. A user can enable or disable each notification type (payment, shipping, sale, etc.) from their notification preferences page
**Plans**: TBD

Plans:
- [ ] 07-01: Reviews and ratings API — catalog review CRUD (one per user per catalog, edit own, 1-5 stars + text), seller review creation (post-purchase gate, one per transaction), average rating aggregation for catalog and seller profile
- [ ] 07-02: Comments and favorites API — catalog comment CRUD (one nesting level of replies), comment likes (toggle), favorites CRUD (add/remove catalog entry, list favorites)
- [ ] 07-03: Notification system API — notification creation service (called by other modules on events), in-app notification endpoints (unread count, dropdown list, full page, mark read), notification preferences CRUD
- [ ] 07-04: Transactional email service — Resend SDK integration, email templates (welcome, payment confirmed, order shipped, item sold, password reset) with responsive layout and PT-BR branding, notification preference gate before send
- [ ] 07-05: Reviews and comments UI — review form on catalog entry page, star rating component, review list, edit review flow, comment thread with nested replies, like button, seller profile page with rating history
- [ ] 07-06: Favorites UI — favorite button on catalog entry cards and detail pages, favorites list page
- [ ] 07-07: Notification UI — bell icon in navbar with unread badge (polling every 30–60s), notification dropdown (recent 5), full notifications page, mark-as-read interaction, notification preferences settings page

### Phase 8: Disputes
**Goal**: Buyers have a protected dispute channel when orders go wrong — they can open a dispute with evidence, sellers can respond, and admins mediate with a logged decision — giving the platform a trust foundation that generic Brazilian marketplaces lack
**Depends on**: Phase 5
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, DISP-07, DISP-08, DISP-09, DISP-10, DISP-11
**Success Criteria** (what must be TRUE):
  1. A buyer can open a dispute on a delivered order within 7 days (or within 30 days if not delivered), selecting a reason and uploading photo evidence
  2. A seller receives notification of the dispute and can submit their response with counter-evidence within 48 hours
  3. An admin can view all open and in-mediation disputes, review both parties' submissions, and record a resolution decision (full refund, partial refund, or closed without refund) with a written justification
  4. A resolved dispute with a refund triggers the refund back to the original payment method; the seller's payout for that item is withheld from the moment the dispute is opened until resolution
  5. Both buyer and seller can view the full dispute history including all messages, evidence, and the final admin decision
**Plans**: TBD

Plans:
- [ ] 08-01: Dispute API — dispute creation endpoint (time window validation: 7 days post-delivery or 30 days if not delivered), reason enum, evidence photo upload (Cloudinary), dispute status state machine (OPEN → IN_MEDIATION → RESOLVED_REFUND / RESOLVED_NO_REFUND / CANCELLED)
- [ ] 08-02: Dispute response and mediation API — seller 48h response endpoint with evidence upload, admin mediation endpoint (resolution decision + justification text), payout hold trigger on dispute open, payout release on resolution, refund trigger for RESOLVED_REFUND, all decisions logged with admin ID + timestamp + justification
- [ ] 08-03: Dispute notifications — notification events for: dispute opened (seller), seller responded (buyer + admin), admin decision recorded (both parties); integrate with notification service from Phase 7
- [ ] 08-04: Dispute UI — dispute opening form (reason select, evidence upload, description), dispute detail page (timeline view of all messages and evidence), seller response form, dispute history page for buyer/seller
- [ ] 08-05: Admin dispute UI — admin dispute queue (list by status, age, amount), dispute detail with both parties' evidence side-by-side, resolution form with decision and justification, decision audit log view

### Phase 9: Affiliate Deals and Homepage
**Goal**: The platform generates affiliate revenue from day one of public launch — admins can create curated deals, the /deals page drives clicks to partner stores with CONAR-compliant disclosure, and the homepage surfaces the best offers to drive repeat visits
**Depends on**: Phase 2
**Requirements**: DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DEAL-06, DEAL-07, DEAL-08, DEAL-09, DEAL-10, HOME-01, HOME-02
**Success Criteria** (what must be TRUE):
  1. An admin can create a coupon deal (code, store, discount, expiry, affiliate link) and a promotion deal (title, banner, dates, category) — each stored with the affiliate tag separate from the base URL
  2. The /deals page shows all active (non-expired) deals with filters by store and category, sortable by newest/biggest discount/expiring soon; expired deals are hidden automatically
  3. Every click on an affiliate deal link is tracked server-side with deduplication (1 click per user+offer per hour); the affiliate tag is composed at redirect time, not embedded in stored data
  4. The admin affiliate analytics dashboard shows clicks per offer, per store, per category, and per period; data can be exported as CSV
  5. The homepage renders with configurable sections (banner carousel, catalog highlights, deals of the day, featured coupons) whose order and visibility are controlled from the admin panel
**Plans**: TBD

Plans:
- [ ] 09-01: Affiliate deals API — deal CRUD (coupon and promotion types), partner store management with affiliate tag storage, affiliate link composition at redirect time (base URL + stored tag), deal expiry auto-hide (cron or query filter), open-redirect protection (domain allowlist), CONAR disclosure flag
- [ ] 09-02: Click tracking API — server-side click log endpoint (log before redirect), deduplication (1 per user+IP+offer per hour via Redis or DB unique constraint), bot filtering (user-agent check), click analytics aggregation endpoints (by offer, store, category, period), CSV export
- [ ] 09-03: Homepage configuration API — admin-configurable section definitions (type, order, visibility, content references), homepage data assembly endpoint (active sections with their content)
- [ ] 09-04: /deals page UI — deals listing page with store/category filter sidebar, sort controls, deal card components (coupon vs. promotion), affiliate disclosure notice, expiry countdown badges
- [ ] 09-05: Homepage UI — homepage with banner carousel, catalog highlights grid, deals of the day strip, featured coupons row; each section conditionally rendered based on admin config; affiliate disclosure on deal sections
- [ ] 09-06: Admin deals and homepage UI — deal create/edit form (both types), partner store and tag configuration panel, homepage section order/visibility control, affiliate analytics dashboard with charts and CSV export

### Phase 10: Admin Panel, Legal, and Production Hardening
**Goal**: The platform is legally compliant for Brazilian launch, users can exercise their LGPD rights, the admin has a unified dashboard and content management surface, and the production environment is hardened with monitoring and automated backups
**Depends on**: Phase 9
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, ADMN-07, ADMN-08, ADMN-09, ADMN-10, LEGL-01, LEGL-02, LEGL-03, LEGL-04, LEGL-05, LEGL-06, LEGL-07, LEGL-08, LEGL-09, LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06, CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. The admin dashboard shows real-time key metrics (total users, sales today, revenue to date, catalog size, pending approvals) on a single page without navigating away
  2. A new user must accept Terms of Use and Privacy Policy at signup; a seller must accept Seller Terms before their first listing; when a mandatory document is updated, all affected users see an acceptance gate on next login
  3. A user can submit a GDPR/LGPD request: access their data (download JSON), correct inaccuracies, delete their account (data removed within 30 days except fiscal obligations), or export their data — all from their account settings
  4. A visitor can submit a contact form message (with spam rate limiting); an admin can view, mark as read, and resolve all received messages from the admin contact panel
  5. The production environment has HTTPS enforced, a health monitoring endpoint, automated daily MySQL backups, and admin confirmation gates on all destructive actions
**Plans**: TBD

Plans:
- [ ] 10-01: Legal documents API — document versioning system (version number, date of effect, content, mandatory flag), acceptance recording (user ID, version ID, timestamp, IP), acceptance audit log, mandatory re-acceptance gate on version update, admin document editor endpoint
- [ ] 10-02: LGPD compliance API — data access request (assemble all user data as JSON), data correction request, account deletion request (scheduled anonymization worker, preserve fiscal transaction data), data portability export, marketing consent management (separate from terms)
- [ ] 10-03: Contact form API — public contact form submission with category enum, spam rate limiting (max N per IP per hour via rate limiter), admin message list/read/resolve endpoints
- [ ] 10-04: Admin dashboard and content management API — dashboard metrics aggregation endpoint (users, sales, revenue, catalog size, pending approvals), admin user management (paginated list, search, filters, plan adjustment, suspension), admin content management (categories/tags/characters/series CRUD), admin shipping method configuration, admin commission and plan config (consolidates Phase 4/5/6 admin endpoints with audit log)
- [ ] 10-05: Legal documents UI — Terms of Use, Privacy Policy, and Seller Terms pages with version history; acceptance modal at signup and first listing; re-acceptance gate on login when new mandatory version exists; cookie consent banner; informational policy pages (Payment, Returns, Shipping, Account Cancellation, Cookies)
- [ ] 10-06: LGPD and account settings UI — LGPD rights page in account settings (access data, request correction, export data, delete account), account deletion confirmation flow with consequences explained, marketing consent toggle
- [ ] 10-07: Contact form UI — public /contact page with category select and form fields, submission confirmation, spam feedback (rate limit message)
- [ ] 10-08: Unified admin dashboard UI — admin dashboard home with metrics cards and quick-action links, admin user management page (paginated table, search, filter, plan/suspension actions with confirmation dialogs), admin content management pages (categories, tags, characters, series — full CRUD with destructive action confirmations), admin shipping methods page, admin commission and plan configuration (consolidates and links to Phase 5/6 admin UIs), admin contact messages panel, admin document editor (rich text, publish with version bump)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
Note: Phase 7 (Community) and Phase 8 (Disputes) both depend on Phase 5 (Payments) and can be sequenced in either order. Phase 9 (Affiliate Deals) depends only on Phase 2 (Catalog) and could be pulled forward if revenue pressure requires it.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Infrastructure | 7/8 | In Progress | - |
| 2. Catalog and Taxonomy | 7/7 | Complete | 2026-02-23 |
| 3. Collection Management | 2/2 | Complete | 2026-02-23 |
| 4. Marketplace and Orders | 0/7 | Not started | - |
| 5. Payments and Commissions | 0/9 | Not started | - |
| 6. Subscriptions | 0/6 | Not started | - |
| 7. Community and Notifications | 0/7 | Not started | - |
| 8. Disputes | 0/5 | Not started | - |
| 9. Affiliate Deals and Homepage | 0/6 | Not started | - |
| 10. Admin Panel, Legal, and Production Hardening | 0/8 | Not started | - |
