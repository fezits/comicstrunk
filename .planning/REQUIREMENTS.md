# Requirements: Comics Trunk

**Defined:** 2026-02-21
**Core Value:** Collectors can catalog, track, and organize their physical comic book collection — knowing exactly what they have, what they've read, and what's missing from their series.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation & Infrastructure

- [x] **INFRA-01**: cPanel deployment validated with Node.js backend + Next.js frontend running (go/no-go gate)
- [x] **INFRA-02**: Monorepo structure initialized (apps/api, apps/web, packages/contracts) with pnpm workspaces
- [x] **INFRA-03**: MySQL database provisioned with Prisma ORM and migration pipeline
- [x] **INFRA-04**: HTTPS enforced in production
- [x] **INFRA-05**: Automated daily database backups
- [x] **INFRA-06**: Health check endpoints with basic monitoring
- [x] **INFRA-07**: i18n architecture in place (PT-BR at launch, extensible for new languages without code changes)
- [x] **INFRA-08**: Responsive layout system (mobile < 768px, tablet 768-1023px, desktop 1024px+)
- [x] **INFRA-09**: Dark/light theme with toggle, dark as default, persisted across sessions
- [x] **INFRA-10**: Shared contracts package (TypeScript types + Zod schemas) consumed by both apps

### Authentication & Users

- [x] **AUTH-01**: User can sign up with name, email, and password (with complexity requirements)
- [x] **AUTH-02**: User can log in securely with rate limiting against brute force
- [x] **AUTH-03**: User can recover password via email with temporary link (expires in 1h)
- [x] **AUTH-04**: User session persists across browser refresh (JWT + refresh token)
- [x] **AUTH-05**: User can view and edit profile (avatar, personal info, social links)
- [x] **AUTH-06**: Three access levels enforced: User, Subscriber, Administrator
- [x] **AUTH-07**: User must accept Terms of Use and Privacy Policy to complete registration

### Catalog

- [ ] **CATL-01**: Catalog entry has: title, author, publisher, imprint, barcode/ISBN, cover image, description
- [ ] **CATL-02**: Catalog entries can belong to a series (with volume and edition number)
- [ ] **CATL-03**: Catalog entries classified by categories (e.g., superhero, manga, horror) and free-form tags
- [ ] **CATL-04**: Catalog entries associated with characters/heroes (e.g., Batman, Goku)
- [ ] **CATL-05**: New catalog entries pass through editorial approval before appearing publicly
- [ ] **CATL-06**: Admin can approve or reject catalog entries with a reason
- [ ] **CATL-07**: Search with combined filters: publisher, character, series, category, price range, condition, year
- [ ] **CATL-08**: Search results sortable by price, date, rating, title
- [ ] **CATL-09**: All catalog listings paginated
- [ ] **CATL-10**: Average rating (1-5 stars) displayed on each catalog entry
- [ ] **CATL-11**: Admin can bulk import catalog entries via CSV
- [ ] **CATL-12**: Admin can export catalog data as CSV
- [ ] **CATL-13**: Catalog schema includes barcode/ISBN fields and high-quality cover image storage (future-ready for AI recognition)

### Series & Tracking

- [ ] **SERI-01**: Each series has: title, description, total number of editions
- [ ] **SERI-02**: Catalog entries linked to series with volume and edition number
- [ ] **SERI-03**: Series listing page with search
- [ ] **SERI-04**: Series detail page showing all editions
- [ ] **SERI-05**: User can see series progress ("15 of 42 editions") when logged in
- [ ] **SERI-06**: Dedicated series progress page: all series the user collects, with progress bars and missing editions
- [ ] **SERI-07**: Link from missing editions to catalog/marketplace search

### Collection Management

- [ ] **COLL-01**: User can add copies to collection specifying: quantity, price paid, condition (New/Very Good/Good/Fair/Poor), personal notes
- [ ] **COLL-02**: User can mark a copy as read (with reading date)
- [ ] **COLL-03**: User can mark a copy as for sale (sets price; commission preview shown in real-time)
- [ ] **COLL-04**: User can upload photos of their copy
- [ ] **COLL-05**: User can import collection via CSV (with downloadable template and error report)
- [ ] **COLL-06**: User can export collection as CSV
- [ ] **COLL-07**: Collection size enforced per subscription plan (FREE: 50, BASIC: 200) with clear message and upgrade suggestion when limit is reached
- [ ] **COLL-08**: Existing copies are never removed on downgrade — only new additions blocked
- [ ] **COLL-09**: Collection limit enforcement uses atomic database operations (prevents race condition)

### Cart & Marketplace

- [ ] **CART-01**: Adding a copy to cart reserves it for 24 hours (no one else can buy it)
- [ ] **CART-02**: Maximum 50 items per cart
- [ ] **CART-03**: Cart persists across sessions
- [ ] **CART-04**: Expired reservations are automatically released
- [ ] **CART-05**: Abandoned carts cleaned up after 7 days
- [ ] **CART-06**: User cannot buy their own copy
- [ ] **CART-07**: Each copy can only be in one cart at a time
- [ ] **CART-08**: Cart reservation uses atomic UPDATE (prevents double-sell race condition on unique items)

### Orders

- [ ] **ORDR-01**: Each order has a unique identifier (e.g., ORD-20260221-A1B2C3)
- [ ] **ORDR-02**: Prices are snapshot at order creation (immutable — never recalculated)
- [ ] **ORDR-03**: Order can contain items from multiple sellers (each ships separately)
- [ ] **ORDR-04**: Each item has individual shipping tracking
- [ ] **ORDR-05**: Order status flow: Pending → Paid → Processing → Shipped → Delivered → Completed
- [ ] **ORDR-06**: Orders can be cancelled or disputed at any stage
- [ ] **ORDR-07**: Items not shipped within 7 days are automatically cancelled
- [ ] **ORDR-08**: PIX payment expires in 24h

### Payments

- [ ] **PYMT-01**: PIX payment displays QR code and copia-e-cola code
- [ ] **PYMT-02**: PIX status verified automatically via webhook
- [ ] **PYMT-03**: Admin can manually approve/confirm a PIX payment when auto-verification fails
- [ ] **PYMT-04**: Webhook processing is idempotent (duplicate events ignored via event ID)
- [ ] **PYMT-05**: Refund support (total or partial)
- [ ] **PYMT-06**: Complete payment history accessible to user
- [ ] **PYMT-07**: PIX QR code expiry aligned with cart reservation time (prevents timer mismatch)
- [ ] **PYMT-08**: Admin payment approval dashboard (review and confirm/reject pending payments)

### Commissions

- [ ] **COMM-01**: Commission is a percentage of sale price, paid by seller
- [ ] **COMM-02**: Commission rate varies by seller plan: FREE 10%, BASIC 8%
- [ ] **COMM-03**: Rates are configurable by admin (with optional min/max values)
- [ ] **COMM-04**: Real-time net amount preview shown to seller when setting price ("You'll receive R$ X")
- [ ] **COMM-05**: Commission rate and net amount snapshot at order creation (immutable for audit)
- [ ] **COMM-06**: Admin commission dashboard: totals by period, by plan, transaction list

### Subscriptions

- [ ] **SUBS-01**: FREE plan (default) and BASIC paid plan available
- [ ] **SUBS-02**: Stripe recurring billing (monthly, quarterly, semi-annual, annual)
- [ ] **SUBS-03**: Configurable trial period
- [ ] **SUBS-04**: User can upgrade plan at any time
- [ ] **SUBS-05**: Cancellation marks end-of-period (not immediate); user keeps benefits until period ends
- [ ] **SUBS-06**: Auto-downgrade to FREE when subscription expires or payment fails definitively
- [ ] **SUBS-07**: Notification on payment failure
- [ ] **SUBS-08**: Admin can approve/activate subscription changes
- [ ] **SUBS-09**: Plan prices configurable by admin

### Shipping & Addresses

- [ ] **SHIP-01**: User can register multiple delivery addresses with one as default
- [ ] **SHIP-02**: Address fields: street, number, complement, neighborhood, city, state, ZIP (CEP)
- [ ] **SHIP-03**: Shipping methods configurable by admin (PAC, SEDEX, local pickup, etc.)
- [ ] **SHIP-04**: Seller updates tracking code and carrier for each item
- [ ] **SHIP-05**: Buyer notified of shipping updates

### Social & Community

- [ ] **SOCL-01**: User can rate a catalog entry (1-5 stars + text review, one per user per catalog)
- [ ] **SOCL-02**: User can edit their own review
- [ ] **SOCL-03**: Buyer can rate seller after completed purchase (1-5 stars + review, one per transaction)
- [ ] **SOCL-04**: Average rating displayed on catalog entries and seller profiles
- [ ] **SOCL-05**: User can favorite catalog entries and access favorites list
- [ ] **SOCL-06**: User can comment on catalog entries (with one level of reply nesting)
- [ ] **SOCL-07**: User can like comments

### Notifications

- [ ] **NOTF-01**: In-app notification bell icon with unread badge and dropdown preview
- [ ] **NOTF-02**: Full notifications page
- [ ] **NOTF-03**: Email: welcome on signup
- [ ] **NOTF-04**: Email: payment confirmation with order details
- [ ] **NOTF-05**: Email: shipping notification with tracking code
- [ ] **NOTF-06**: Email: sale notification to seller
- [ ] **NOTF-07**: Email: password reset link
- [ ] **NOTF-08**: Simple notification preferences (on/off per type)
- [ ] **NOTF-09**: All emails with responsive layout and consistent branding

### Admin

- [ ] **ADMN-01**: Dashboard with real-time metrics: users, sales, revenue, pending approvals
- [ ] **ADMN-02**: Catalog management: list pending/approved/rejected, approve/reject with reason
- [ ] **ADMN-03**: User management: paginated list with search and filters
- [ ] **ADMN-04**: Content management: categories, tags, characters/heroes, series — full CRUD
- [ ] **ADMN-05**: Commission configuration: edit rates per plan, set min/max, preview impact
- [ ] **ADMN-06**: Plan management: create/edit/deactivate subscription plans
- [ ] **ADMN-07**: Contact panel: messages received via contact form, mark as read/resolved
- [ ] **ADMN-08**: Payments due: sellers with pending payout amounts
- [ ] **ADMN-09**: Bulk catalog import via CSV
- [ ] **ADMN-10**: Confirmation required for destructive actions

### Affiliate Deals

- [ ] **DEAL-01**: Admin can create offers: coupon (code, store, description, discount, expiry, affiliate link) and promotion (title, description, store, banner, affiliate link, dates, category)
- [ ] **DEAL-02**: Each partner store has its affiliate tag configured in admin (e.g., ?tag=comicstrunk-20)
- [ ] **DEAL-03**: Affiliate links generated automatically with correct tag when creating offers
- [ ] **DEAL-04**: Dedicated /deals page with all active offers
- [ ] **DEAL-05**: Filter by store, category, expiry; sort by newest, biggest discount, expiring soon
- [ ] **DEAL-06**: Homepage "Deals of the Day" section with high visibility
- [ ] **DEAL-07**: Expired offers automatically hidden
- [ ] **DEAL-08**: Affiliate transparency disclosure on all pages with affiliate links (CONAR/FTC compliance)
- [ ] **DEAL-09**: Admin analytics: clicks per offer, per store, per category, per period
- [ ] **DEAL-10**: Export analytics data for cross-referencing with affiliate program reports

### Homepage

- [ ] **HOME-01**: Public homepage with configurable sections: banner carousel, catalog highlights, deals of the day, featured coupons
- [ ] **HOME-02**: Section order and visibility configurable by admin

### Legal & Compliance

- [ ] **LEGL-01**: Terms of Use with mandatory acceptance at signup
- [ ] **LEGL-02**: Privacy Policy with mandatory acceptance at signup
- [ ] **LEGL-03**: Seller Terms with mandatory acceptance before first listing
- [ ] **LEGL-04**: Informational policies: Payment, Returns/Refunds, Shipping, Account Cancellation, Cookies
- [ ] **LEGL-05**: All documents versioned with date of effect; previous versions accessible
- [ ] **LEGL-06**: User notified and must re-accept when mandatory terms are updated
- [ ] **LEGL-07**: Admin can edit legal documents via panel (text editor)
- [ ] **LEGL-08**: Acceptance audit log: date, version, user IP
- [ ] **LEGL-09**: Cookie consent banner

### Disputes

- [ ] **DISP-01**: Buyer can open dispute within 7 days after delivery (or 30 days if not delivered)
- [ ] **DISP-02**: Dispute reasons: not received, different from listing, damaged in transit, not shipped on time
- [ ] **DISP-03**: Buyer submits evidence (photos) when opening dispute
- [ ] **DISP-04**: Seller has 48h to respond with their version
- [ ] **DISP-05**: Admin mediates if no agreement: evaluates evidence and decides
- [ ] **DISP-06**: Resolution: full refund, partial refund, or closed without refund
- [ ] **DISP-07**: Refund via same original payment method
- [ ] **DISP-08**: Dispute status flow: OPEN → IN_MEDIATION → RESOLVED_REFUND / RESOLVED_NO_REFUND / CANCELLED
- [ ] **DISP-09**: Dispute history accessible to buyer, seller, and admin
- [ ] **DISP-10**: Seller payout retained while dispute is open
- [ ] **DISP-11**: All mediation decisions logged with justification

### LGPD Compliance

- [ ] **LGPD-01**: User can request access to all personal data
- [ ] **LGPD-02**: User can request data correction
- [ ] **LGPD-03**: User can request account deletion (data removed within 30 days, except legal/fiscal obligations)
- [ ] **LGPD-04**: User can export personal data (portability)
- [ ] **LGPD-05**: Transaction data retained for 5 years (fiscal obligation) but anonymized after account deletion
- [ ] **LGPD-06**: Explicit consent for marketing communications (separate from terms acceptance)

### Seller Banking

- [ ] **BANK-01**: Seller can register bank account details (bank, branch, account, CPF, holder, type)
- [ ] **BANK-02**: Multiple accounts supported with one marked as primary
- [ ] **BANK-03**: Admin can view seller bank data for payout processing

### Contact

- [ ] **CONT-01**: Public contact form (categories: suggestion, problem, partnership, other)
- [ ] **CONT-02**: Spam protection (rate limiting per hour)
- [ ] **CONT-03**: Admin panel to manage received messages (mark read/resolved)

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Payments

- **PYMT-V2-01**: Credit card payment via Stripe checkout
- **PYMT-V2-02**: 3DS2 support for card payments

### Subscriptions

- **SUBS-V2-01**: STANDARD plan (500 comics, 5% commission)
- **SUBS-V2-02**: PREMIUM plan (unlimited, 2% commission)

### Notifications

- **NOTF-V2-01**: Real-time notifications via SSE (no page reload)
- **NOTF-V2-02**: Web Push notifications
- **NOTF-V2-03**: Digest emails (daily/weekly summary)
- **NOTF-V2-04**: Quiet hours configuration
- **NOTF-V2-05**: Notification analytics (sent, opened, clicked)
- **NOTF-V2-06**: Admin broadcast notifications
- **NOTF-V2-07**: Granular per-category per-channel preferences

### Content

- **CONT-V2-01**: Admin miniblog (create, edit, publish posts with rich text/markdown)
- **CONT-V2-02**: Blog post scheduling
- **CONT-V2-03**: SEO: meta descriptions, Open Graph tags

### News Feed

- **NEWS-V2-01**: Aggregation from external sources (Twitter/X, YouTube, Instagram, RSS)
- **NEWS-V2-02**: Native embeds for external content
- **NEWS-V2-03**: Admin manages sources (add/remove/toggle)

### Trades

- **TRAD-V2-01**: User can propose trade of copies with another user
- **TRAD-V2-02**: Messages per trade
- **TRAD-V2-03**: Accept, reject, conclude, or cancel trades
- **TRAD-V2-04**: Rating after completed trade

### Reports & Timelines

- **REPT-V2-01**: Spending report by period with charts and breakdown by publisher/category/series
- **REPT-V2-02**: Purchase timeline (chronological with images, prices, sellers)
- **REPT-V2-03**: Reading timeline (chronological with cover and date)
- **REPT-V2-04**: Register external purchases (outside platform)
- **REPT-V2-05**: Export reports as CSV/PDF

### Goals

- **GOAL-V2-01**: Reading goals ("Read X comics by date")
- **GOAL-V2-02**: Spending goals ("Max R$ X per month")
- **GOAL-V2-03**: Collection goals ("Complete series X")
- **GOAL-V2-04**: Progress bars and notifications for goals

### Fraud Protection

- **FRAD-V2-01**: Account age limits on transactions
- **FRAD-V2-02**: Velocity alerts for suspicious transaction patterns
- **FRAD-V2-03**: Seller trust score
- **FRAD-V2-04**: Preventive transaction holds
- **FRAD-V2-05**: Admin fraud panel

### AI Recognition (future vision)

- **AIRG-V2-01**: Cover image recognition to identify comics from photo
- **AIRG-V2-02**: Barcode/ISBN scan via camera to look up catalog entries

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app (iOS/Android) | Web-first with responsive design; doubles infrastructure cost |
| Non-comic products | Platform is comics-only by design |
| Auction/bidding system | Not aligned with fixed-price collector marketplace model |
| Real-time chat between users | Requires WebSocket infra, moderation, creates liability |
| Social login (Google, Facebook, Apple) | Email/password sufficient; adds OAuth complexity and LGPD surface |
| Multi-tenancy | Single platform |
| Automatic content translation | Admin responsibility to publish in desired languages |
| Own logistics/shipping | Platform connects buyer and seller, doesn't ship |
| Automated grading (CGC/PGX) | US-centric; Brazilian market trades mostly raw books |
| Multi-seller shipping calculator (Correios API) | Unreliable API; admin-configured methods are more predictable |
| User-generated catalog without approval | Leads to duplicates and spam; editorial quality control required |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| INFRA-08 | Phase 1 | Complete |
| INFRA-09 | Phase 1 | Complete |
| INFRA-10 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| CATL-01 | Phase 2 | Pending |
| CATL-02 | Phase 2 | Pending |
| CATL-03 | Phase 2 | Pending |
| CATL-04 | Phase 2 | Pending |
| CATL-05 | Phase 2 | Pending |
| CATL-06 | Phase 2 | Pending |
| CATL-07 | Phase 2 | Pending |
| CATL-08 | Phase 2 | Pending |
| CATL-09 | Phase 2 | Pending |
| CATL-10 | Phase 2 | Pending |
| CATL-11 | Phase 2 | Pending |
| CATL-12 | Phase 2 | Pending |
| CATL-13 | Phase 2 | Pending |
| SERI-01 | Phase 2 | Pending |
| SERI-02 | Phase 2 | Pending |
| SERI-03 | Phase 2 | Pending |
| SERI-04 | Phase 2 | Pending |
| SERI-05 | Phase 3 | Pending |
| SERI-06 | Phase 3 | Pending |
| SERI-07 | Phase 3 | Pending |
| COLL-01 | Phase 3 | Pending |
| COLL-02 | Phase 3 | Pending |
| COLL-03 | Phase 3 | Pending |
| COLL-04 | Phase 3 | Pending |
| COLL-05 | Phase 3 | Pending |
| COLL-06 | Phase 3 | Pending |
| COLL-07 | Phase 3 | Pending |
| COLL-08 | Phase 3 | Pending |
| COLL-09 | Phase 3 | Pending |
| CART-01 | Phase 4 | Pending |
| CART-02 | Phase 4 | Pending |
| CART-03 | Phase 4 | Pending |
| CART-04 | Phase 4 | Pending |
| CART-05 | Phase 4 | Pending |
| CART-06 | Phase 4 | Pending |
| CART-07 | Phase 4 | Pending |
| CART-08 | Phase 4 | Pending |
| ORDR-01 | Phase 4 | Pending |
| ORDR-02 | Phase 4 | Pending |
| ORDR-03 | Phase 4 | Pending |
| ORDR-04 | Phase 4 | Pending |
| ORDR-05 | Phase 4 | Pending |
| ORDR-06 | Phase 4 | Pending |
| ORDR-07 | Phase 4 | Pending |
| ORDR-08 | Phase 4 | Pending |
| SHIP-01 | Phase 4 | Pending |
| SHIP-02 | Phase 4 | Pending |
| SHIP-03 | Phase 4 | Pending |
| SHIP-04 | Phase 4 | Pending |
| SHIP-05 | Phase 4 | Pending |
| COMM-01 | Phase 4 | Pending |
| COMM-02 | Phase 4 | Pending |
| COMM-03 | Phase 4 | Pending |
| COMM-04 | Phase 4 | Pending |
| COMM-05 | Phase 4 | Pending |
| PYMT-01 | Phase 5 | Pending |
| PYMT-02 | Phase 5 | Pending |
| PYMT-03 | Phase 5 | Pending |
| PYMT-04 | Phase 5 | Pending |
| PYMT-05 | Phase 5 | Pending |
| PYMT-06 | Phase 5 | Pending |
| PYMT-07 | Phase 5 | Pending |
| PYMT-08 | Phase 5 | Pending |
| COMM-06 | Phase 5 | Pending |
| BANK-01 | Phase 5 | Pending |
| BANK-02 | Phase 5 | Pending |
| BANK-03 | Phase 5 | Pending |
| SUBS-01 | Phase 6 | Pending |
| SUBS-02 | Phase 6 | Pending |
| SUBS-03 | Phase 6 | Pending |
| SUBS-04 | Phase 6 | Pending |
| SUBS-05 | Phase 6 | Pending |
| SUBS-06 | Phase 6 | Pending |
| SUBS-07 | Phase 6 | Pending |
| SUBS-08 | Phase 6 | Pending |
| SUBS-09 | Phase 6 | Pending |
| SOCL-01 | Phase 7 | Pending |
| SOCL-02 | Phase 7 | Pending |
| SOCL-03 | Phase 7 | Pending |
| SOCL-04 | Phase 7 | Pending |
| SOCL-05 | Phase 7 | Pending |
| SOCL-06 | Phase 7 | Pending |
| SOCL-07 | Phase 7 | Pending |
| NOTF-01 | Phase 7 | Pending |
| NOTF-02 | Phase 7 | Pending |
| NOTF-03 | Phase 7 | Pending |
| NOTF-04 | Phase 7 | Pending |
| NOTF-05 | Phase 7 | Pending |
| NOTF-06 | Phase 7 | Pending |
| NOTF-07 | Phase 7 | Pending |
| NOTF-08 | Phase 7 | Pending |
| NOTF-09 | Phase 7 | Pending |
| DISP-01 | Phase 8 | Pending |
| DISP-02 | Phase 8 | Pending |
| DISP-03 | Phase 8 | Pending |
| DISP-04 | Phase 8 | Pending |
| DISP-05 | Phase 8 | Pending |
| DISP-06 | Phase 8 | Pending |
| DISP-07 | Phase 8 | Pending |
| DISP-08 | Phase 8 | Pending |
| DISP-09 | Phase 8 | Pending |
| DISP-10 | Phase 8 | Pending |
| DISP-11 | Phase 8 | Pending |
| DEAL-01 | Phase 9 | Pending |
| DEAL-02 | Phase 9 | Pending |
| DEAL-03 | Phase 9 | Pending |
| DEAL-04 | Phase 9 | Pending |
| DEAL-05 | Phase 9 | Pending |
| DEAL-06 | Phase 9 | Pending |
| DEAL-07 | Phase 9 | Pending |
| DEAL-08 | Phase 9 | Pending |
| DEAL-09 | Phase 9 | Pending |
| DEAL-10 | Phase 9 | Pending |
| HOME-01 | Phase 9 | Pending |
| HOME-02 | Phase 9 | Pending |
| ADMN-01 | Phase 10 | Pending |
| ADMN-02 | Phase 10 | Pending |
| ADMN-03 | Phase 10 | Pending |
| ADMN-04 | Phase 10 | Pending |
| ADMN-05 | Phase 10 | Pending |
| ADMN-06 | Phase 10 | Pending |
| ADMN-07 | Phase 10 | Pending |
| ADMN-08 | Phase 10 | Pending |
| ADMN-09 | Phase 10 | Pending |
| ADMN-10 | Phase 10 | Pending |
| LEGL-01 | Phase 10 | Pending |
| LEGL-02 | Phase 10 | Pending |
| LEGL-03 | Phase 10 | Pending |
| LEGL-04 | Phase 10 | Pending |
| LEGL-05 | Phase 10 | Pending |
| LEGL-06 | Phase 10 | Pending |
| LEGL-07 | Phase 10 | Pending |
| LEGL-08 | Phase 10 | Pending |
| LEGL-09 | Phase 10 | Pending |
| LGPD-01 | Phase 10 | Pending |
| LGPD-02 | Phase 10 | Pending |
| LGPD-03 | Phase 10 | Pending |
| LGPD-04 | Phase 10 | Pending |
| LGPD-05 | Phase 10 | Pending |
| LGPD-06 | Phase 10 | Pending |
| CONT-01 | Phase 10 | Pending |
| CONT-02 | Phase 10 | Pending |
| CONT-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 162 total (10 INFRA + 7 AUTH + 13 CATL + 7 SERI + 9 COLL + 8 CART + 8 ORDR + 8 PYMT + 6 COMM + 9 SUBS + 5 SHIP + 7 SOCL + 9 NOTF + 10 ADMN + 10 DEAL + 2 HOME + 9 LEGL + 11 DISP + 6 LGPD + 3 BANK + 3 CONT)
- Mapped to phases: 162
- Unmapped: 0

Note: The original count of "113" in the template was a placeholder. The actual count from the defined requirements is 162 v1 requirements across 21 categories, all mapped.

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation — traceability table fully populated*
