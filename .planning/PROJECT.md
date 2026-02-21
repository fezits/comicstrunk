# Comics Trunk

## What This Is

A specialized platform for comic book collectors in Brazil that unifies collection management, a secure marketplace between collectors, and curated affiliate deals from partner stores — all in one place. It replaces the scattered experience of social media groups, generic marketplaces, and personal spreadsheets with a purpose-built tool that understands the comics universe.

## Core Value

Collectors can catalog, track, and organize their physical comic book collection — knowing exactly what they have, what they've read, and what's missing from their series.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User authentication (signup, login, password recovery)
- [ ] Responsive layout with dark/light theme toggle
- [ ] i18n architecture (PT-BR at launch, extensible)
- [ ] Curated comic catalog with search, filters, pagination, and editorial approval
- [ ] Personal collection management (add, edit, remove, read status, condition, notes)
- [ ] Collection import/export via CSV with templates and error reporting
- [ ] Series tracking with progress (e.g., "15 of 42 editions")
- [ ] Categories, tags, and character/hero associations
- [ ] Shopping cart with 24h reservation for unique items
- [ ] Unified order system with order numbers and price snapshots
- [ ] PIX payment with QR code and automatic status verification
- [ ] Shipping tracking with seller-updated codes
- [ ] Address management (multiple addresses, default selection)
- [ ] Automatic commission calculation per seller plan (FREE: 10%, BASIC: 8%)
- [ ] Subscription plans: FREE + BASIC with collection limits enforcement
- [ ] Stripe integration for subscription billing
- [ ] Catalog reviews (1-5 stars + text, one per user per catalog)
- [ ] Seller reviews (post-purchase only)
- [ ] Favorites list
- [ ] Comments on catalogs (one level of nesting, likes)
- [ ] In-app notifications (bell icon, dropdown, full page)
- [ ] Essential transactional emails (welcome, payment, shipping, sale, password reset)
- [ ] Simple notification preferences (on/off per type)
- [ ] Admin dashboard with key metrics
- [ ] Catalog approval/rejection workflow
- [ ] Admin management: users, categories, series, characters, tags
- [ ] Admin commission and plan configuration
- [ ] Affiliate offers: admin-curated deals with affiliate links (Amazon, Mercado Livre, eBay, etc.)
- [ ] Affiliate tag configuration per partner store
- [ ] /deals page with filters by store/category and auto-expiration
- [ ] Admin affiliate analytics (clicks, per store, per category, per period)
- [ ] Public homepage with configurable sections (banner, highlights, deals of the day, coupons)
- [ ] Legal documents: Terms of Use, Privacy Policy, Seller Terms (mandatory acceptance)
- [ ] Informational policies: Payment, Returns, Shipping, Account Cancellation, Cookies
- [ ] Dispute flow: buyer opens dispute, seller responds, admin mediates, resolution
- [ ] LGPD basic compliance (account deletion, data access/export)
- [ ] Contact form with admin management panel
- [ ] Seller bank account registration for payouts
- [ ] Production deploy with HTTPS, monitoring, and automated backups

### Out of Scope

- Native mobile app (iOS/Android) — web-first, mobile responsive
- Non-comic products — platform is comics-only
- Auction system — not aligned with collector marketplace model
- Real-time chat between users — outside trade context
- Social login (Google, Facebook, Apple) — email/password sufficient for v1
- Multi-tenancy — single platform
- Automatic content translation — admin responsibility
- Own logistics — platform connects buyer and seller, doesn't ship
- Credit card payments — PIX covers majority of Brazilian payments, card comes post-MVP
- STANDARD and PREMIUM subscription plans — one paid plan validates monetization
- Real-time notifications (SSE/WebSocket) — polling for MVP
- Web Push notifications — post-MVP
- Notification digests, quiet hours, analytics — post-MVP
- Miniblog — post-MVP
- News feed aggregation — post-MVP
- Trade system between users — post-MVP
- Spending reports and timelines — post-MVP
- Reading and purchase goals — post-MVP
- Automated fraud protection — manual admin monitoring for MVP
- API documentation (Swagger) — post-MVP

## Context

- **Market:** Brazilian comic book collectors have no dedicated platform. Current alternatives are social media groups (no guarantees), generic marketplaces (no comic expertise), or personal spreadsheets (no community).
- **Revenue model:** Affiliate links from partner stores (primary), marketplace commissions (secondary), subscriptions (complementary to cover operational costs).
- **Payment landscape:** PIX dominates Brazilian digital payments — it's the right first payment method. Credit card via Stripe follows post-MVP.
- **PRD:** Full product requirements documented in `docs/PRD.md` (v3.0). The PRD covers the complete vision including post-MVP features. This project tracks the MVP scope.
- **Post-MVP sequence:** Credit card + full plans → Miniblog → Fraud protection → Advanced notifications → Reports/timelines/goals → News feed + trades → Polish.

## Constraints

- **Tech stack:** Node.js backend, Next.js frontend, MySQL database — already decided
- **Architecture:** Monorepo with decoupled apps (`apps/api`, `apps/web`), communication via REST API. Shared packages allowed if they maintain decoupling (contracts/types, not implementation)
- **Hosting:** cPanel deployment
- **Language:** Interface in PT-BR for v1, i18n architecture extensible for future languages
- **Currency:** BRL only
- **Payment:** PIX only for MVP (Stripe for subscriptions only)
- **Git workflow:** GitHub Projects with issues from PRD, `develop` as integration branch, feature branches per issue, PR review cycle

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Collection management as core hook | Collectors come for organizing, stay for marketplace | — Pending |
| Decoupled frontend/backend in monorepo | Independence between apps, clear API contract, separate deployment | — Pending |
| PIX-first, no credit card in MVP | PIX covers majority of BR payments, reduces Stripe complexity in MVP | — Pending |
| Affiliate deals as primary revenue | Lower barrier than marketplace commissions, revenue from day one | — Pending |
| Single paid plan (BASIC) in MVP | Validates subscription monetization without over-engineering tiers | — Pending |
| cPanel deployment | Existing infrastructure constraint | — Pending |
| MySQL over PostgreSQL | Already decided by team | — Pending |

---
*Last updated: 2026-02-21 after initialization*
