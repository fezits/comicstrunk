# Feature Research

**Domain:** Comics collector platform — collection management + C2C marketplace + affiliate deals + community (Brazil)
**Researched:** 2026-02-21
**Confidence:** MEDIUM (training-data analysis of named competitors; no live web scraping available — see Sources)

---

## Competitive Landscape Overview

Platforms analyzed (training data, confidence MEDIUM):

| Platform | Primary Focus | Market | Notable Strength |
|----------|--------------|--------|-----------------|
| **League of Comic Geeks** | Collection + community | Global (EN) | Pull list, reading progress, community richness |
| **CLZ Comics** | Collection management | Global (EN) | Deep metadata, offline-capable app, barcode scan |
| **ComicBookRealm** | Price guide + collection | Global (EN) | Historical pricing data, grading value tracking |
| **MyComicShop** | Buy/sell marketplace | US-focused | Graded comics, store credibility, large catalog |
| **Catawiki** | Auction marketplace | EU-focused | Curated expert auctions, premium collectibles |
| **Omelete / HQ Colecionavel** | News + community | Brazil (PT-BR) | Editorial content, not a marketplace |
| **OLX / Mercado Livre** | Generic marketplace | Brazil | Scale, PIX integration, trust — not comics-specific |

**Key Brazil market gap (HIGH confidence — validated by PROJECT.md):** No dedicated comics platform combining collection management + C2C marketplace + Brazilian payment methods. Current alternatives are Facebook groups, OLX, and personal spreadsheets.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **User registration and authentication** | Every platform requires identity; without it nothing is personalized | LOW | Email/password sufficient for MVP; social login is table stakes globally but PRD explicitly defers it |
| **Personal collection CRUD** | Core reason collectors visit — to log what they own | MEDIUM | Add/edit/remove physical copies; link to a catalog entry rather than free-text |
| **Curated comic catalog (shared database)** | Users expect to find comics by name, not type them from scratch every time | HIGH | Central catalog with editorial approval is the backbone; quality here determines collection UX quality |
| **Search and filter** | Every catalog/marketplace must be searchable by title, author, publisher, series, character | MEDIUM | Faceted search: publisher, character, series, category, condition, year, price range |
| **Series tracking and progress** | Collectors think in series ("I have 15 of 42") — CLZ and LoCG both offer this | MEDIUM | Progress bar per series; "missing issues" view; foundational for collector retention |
| **Read status per copy** | All serious tracker apps (CLZ, LoCG, Goodreads equivalent) include this | LOW | Toggle read/unread per copy; date of reading optional |
| **Condition grading on listings** | Buyers need condition info; without it marketplace listings are untrustworthy | LOW | Standard grades: New, Very Good, Good, Fair, Poor — maps to CGC-like scale |
| **Item listing for sale** | If the platform has a marketplace, users expect to be able to sell | MEDIUM | Mark copy as "for sale," set price; commissions shown upfront |
| **Shopping cart with reservation** | Standard e-commerce UX; unique items require cart reservation to avoid race conditions | MEDIUM | 24h reservation for unique physical items (not stock) is correct for this domain — see RN01 |
| **Checkout and payment** | Without payment the marketplace is just an ad board | HIGH | PIX QR code is table stakes for Brazil; no PIX = platform is unusable for most Brazilians |
| **Order tracking** | Buyers expect to see order status and shipping codes | MEDIUM | Seller-updated tracking code; status progression |
| **Seller/buyer ratings** | Trust mechanism — without ratings, C2C transactions feel risky | MEDIUM | Post-purchase only (RN10); aggregate star rating on seller profiles |
| **Catalog/item reviews** | Expected on any product catalog; LoCG, MyComicShop both have reviews | LOW | Per-catalog text review + star rating; one per user (RN11) |
| **Responsive mobile layout** | Brazilian internet is predominantly mobile; non-responsive = instant bounce | MEDIUM | Touch-optimized, hamburger nav, full-screen modals on mobile |
| **Email notifications for transactions** | Users expect email confirmation for purchases, sales, shipping | MEDIUM | Welcome, payment confirmed, shipment, password reset are minimum |
| **Favorites / wishlist** | Standard collector behavior: mark items to watch | LOW | Favorite a catalog entry to find it later |
| **User profile with seller info** | Buyers need to evaluate sellers; missing = no trust | LOW | Avatar, ratings, selling history, member since |
| **Legal pages and terms acceptance** | Required by LGPD; no ToS/Privacy Policy = platform cannot legally operate in Brazil | MEDIUM | Accept at signup; versioned; LGPD data rights (delete, export) |
| **Password recovery** | Fundamental auth feature; missing = locked-out users abandon platform | LOW | Email-based reset link with expiry |
| **Pagination on all listings** | Unbound lists crash browsers and degrade UX | LOW | Every list endpoint must paginate; not optional |
| **Admin catalog approval workflow** | Quality control for shared catalog; without it the catalog degrades into spam | MEDIUM | Approve/reject with reason; admin notification on new submissions |
| **Dark/light theme** | Expected by modern users; PRD calls it out explicitly; Brazilian comic community skews dark-theme | LOW | Persist preference; dark is default |

### Differentiators (Competitive Advantage)

Features that set Comics Trunk apart. Not required by expectation, but create meaningful competitive advantage in the Brazilian market.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Affiliate deals page (/deals) with curated offers** | No Brazilian comic platform curates affiliate deals from Amazon BR, Mercado Livre, Panini, Shopee. This is primary revenue AND a service to users. | MEDIUM | Admin-curated coupons and promotions; auto-expire; CONAR-compliant disclosure (RN19). Only platform in Brazil doing this systematically. |
| **PIX-native payment with QR code** | Generic marketplaces bolt PIX on. This platform is PIX-first, QR-code-native, with auto-verification polling. Frictionless for Brazilian users. | HIGH | PIX covers ~70%+ of Brazilian digital payments. Card-first platforms feel foreign here. |
| **Collection import/export via CSV** | CLZ charges for this. LoCG makes it cumbersome. Offering free, well-templated CSV import lowers the switching cost from spreadsheets (the current status quo for Brazilian collectors). | MEDIUM | Template download + error report on import is the differentiator within the differentiator. |
| **Commission transparency at listing time** | Sellers see "You'll receive R$ X" before they post. Generic marketplaces hide the fee until checkout. This builds seller trust. | LOW | Real-time commission calculation using plan rate (RN05). |
| **PT-BR first — built for Brazil** | Every competing serious platform (CLZ, LoCG, MyComicShop) is English-only. Being truly PT-BR — currency BRL, PIX, Brazilian publishers (Panini Brasil, Mythos, etc.), mangás — is a structural advantage. | MEDIUM | i18n architecture ensures this isn't a cosmetic translation but a market-native product. |
| **Series missing-issues finder** | Show the user which issues they don't have in a series and link directly to marketplace listings for those issues. CLZ shows gaps; LoCG shows gaps; no Brazilian platform does. | MEDIUM | Dependency: series tracking + marketplace listings must be live. High retention value. |
| **Dispute system with mediation** | OLX/Facebook groups have zero buyer protection. Having a formal dispute flow (buyer opens → seller responds → admin mediates) is a major trust differentiator for C2C. | HIGH | Required for marketplace trust in Brazil. Generic marketplaces have this, but no comics-specific platform does. |
| **Plan-differentiated commissions** | Rewarding loyal sellers (BASIC: 8% vs FREE: 10%) with lower commissions creates upgrade incentive. Simple but rare in niche C2C platforms. | LOW | RN05 — configurable by admin. |
| **Barcode scan / AI cover recognition (future)** | Cataloging 200+ comics is tedious. CLZ has barcode scan (paid). Offering free barcode + eventual AI recognition in a Brazilian platform would be a major UX leap. | HIGH (future) | PRD section 10 — future vision. Requires robust catalog with cover images and ISBNs first. |
| **Curated admin homepage with "Deals of the Day"** | A homepage that surfaces daily affiliate deals prominently drives repeat visits and affiliate revenue simultaneously. No Brazilian comics site does this. | MEDIUM | Configurable sections (banner, highlights, deals, coupons) managed by admin. |
| **Subscription plan with collection limits + commission reduction** | Gamified upgrade path: FREE users hit 50-item limit, see the value proposition clearly, upgrade. Aligns user behavior (growing collection) with revenue. | MEDIUM | RN07 — enforcement at limit with upgrade suggestion is the key UX moment. |
| **Trade system between users (post-MVP)** | Brazilians frequently trade in Facebook groups. A formal trade system with acceptance flow would pull a major behavior pattern onto the platform. | HIGH (post-MVP) | PRD section 4.21. Requires messaging or at minimum a structured proposal flow. |
| **Spending reports and reading timelines (post-MVP)** | CLZ has this (premium). LoCG has reading history. No Brazilian platform. "How much did I spend on comics this year?" is a question every collector asks. | MEDIUM (post-MVP) | PRD section 4.17. High retention; makes the platform feel like a complete collecting companion. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but introduce disproportionate complexity, risk, or misalignment with the platform's core model.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time chat between buyers and sellers** | Buyers want to ask questions; sellers want to negotiate | Requires WebSocket infrastructure, moderation, content policies, spam protection. Creates liability for what's said. Conversations off-platform reduce dispute trail. | Structured dispute/contact form within order context. Pre-listing Q&A on catalog pages via comments is sufficient for most questions. |
| **Auction / bidding system** | Rare comics attract competitive bids; users expect it for premium items | Auctions require timed events, anti-sniping logic, reserve prices, buyer commitment enforcement. Catawiki makes this work with expert curation; C2C auctions devolve quickly. PRD explicitly excludes this. | Fixed-price listings with 24h cart reservation. Scarcity is already communicated by uniqueness of physical copies. |
| **Native mobile app (iOS/Android)** | Mobile is primary channel in Brazil; app feels more "real" | Development cost doubles; two codebases; app store review delays; push notifications require separate infrastructure. Brazilian comic collectors are not impulse-buying; they research. | Fully responsive PWA with offline capability. Mobile web is sufficient for MVP. |
| **Social login (Google, Facebook, Apple)** | Reduces signup friction | Adds OAuth complexity, third-party dependency, vendor lock-in concerns. Also creates LGPD surface: what data does the OAuth provider share? For a platform with financial transactions, email ownership is important. | Simple email/password with strong password requirements. Post-MVP addition once trust is established. |
| **Automated grading (CGC/PGX integration)** | US collectors expect graded book values | CGC is US-centric; Brazilian market trades mostly raw (ungraded) books. Integration cost is high; data isn't available for Brazilian editions. Creates false precision. | Condition field with 5 standard levels (New/Very Good/Good/Fair/Poor). Simple, honest, works. |
| **Barcode scan at MVP** | Would dramatically speed collection entry | Camera API reliability on mobile web is inconsistent; requires substantial QA across devices; catalog must already have barcode data for it to work. Building barcode scan before the catalog has barcodes is backwards. | CSV import for bulk; manual catalog-linked entry for individual items. Add barcode scan post-catalog enrichment. |
| **Real-time notifications (SSE/WebSocket) at MVP** | Users expect instant updates | SSE/WebSocket requires persistent connections, load balancer sticky sessions, additional infrastructure. On cPanel hosting this is particularly problematic. PRD explicitly defers this. | Polling every 30-60 seconds is imperceptible for non-critical notifications. SSE post-MVP when infrastructure is validated. |
| **Multi-seller shipping calculator (Correios API)** | Users want accurate shipping estimates | Correios API has unreliable uptime; weight/dimension data for comics varies widely; seller location diversity complicates origin-based calculation. Creates false expectations when estimates are wrong. | Admin-configured shipping methods (PAC, SEDEX, local pickup) with fixed or seller-defined rates. Simpler, more predictable. |
| **User-generated catalog entries without approval** | Faster catalog growth; crowdsourcing | Without editorial approval, catalog becomes polluted with duplicates, typos, wrong covers, and spam. CLZ, LoCG, and Goodreads all struggle with duplicate entries. Recovery from a polluted catalog is expensive. | Admin approval workflow (RN08) with user-submitted entries queued for review. Best of both: community input + quality control. |
| **Automated fraud detection at MVP** | Protect platform from bad actors | Rule-based fraud systems have high false-positive rates when transaction volume is low. Blocking legitimate users early damages reputation. PRD correctly defers this to post-MVP. | Manual admin monitoring of transactions. At <50 transactions/month (MVP target), manual monitoring is entirely feasible and produces better outcomes. |
| **News feed aggregation (Twitter/RSS) at MVP** | Keeps users engaged; content without admin effort | Third-party API instability (especially Twitter/X API pricing changes), content moderation surface, embeds introduce performance/privacy issues. Not a retention driver for collectors — collection management is. | Admin miniblog for editorial content. Curated > aggregated for a trust-based platform. Aggregation post-MVP when editorial identity is established. |
| **Credit card payments at MVP** | Wider payment options | Stripe card integration requires PCI-DSS considerations, webhook security, card decline handling, 3DS2 for EU (not needed here), and testing complexity. PIX covers ~70% of Brazilian digital payments. Adding complexity before validating market fit is waste. | PIX-first. Stripe for subscription billing only (simpler use case). Card post-MVP once PIX flow is battle-tested. |

---

## Feature Dependencies

```
[Curated Catalog]
    └──requires──> [Admin Approval Workflow]
    └──enables──> [Personal Collection]
                       └──enables──> [Series Progress Tracking]
                                         └──enables──> [Missing Issues Finder]
                       └──enables──> [Mark as For Sale]
                                         └──requires──> [Marketplace Listings]
                                                            └──requires──> [Shopping Cart + Reservation]
                                                                               └──requires──> [PIX Payment]
                                                                                                  └──requires──> [Order System]
                                                                                                                     └──enables──> [Seller/Buyer Ratings]
                                                                                                                     └──enables──> [Dispute System]
                                                                                                                     └──enables──> [Commission Calculation]

[User Auth]
    └──required by──> ALL personalized features

[Subscription Plans]
    └──requires──> [Stripe integration]
    └──requires──> [Collection Limit Enforcement]
    └──enables──> [Commission Rate Differentiation]

[Affiliate Deals]
    └──requires──> [Admin Panel]
    └──requires──> [Affiliate Tag Configuration]
    └──enables──> [Deals Page /deals]
    └──enables──> [Homepage Deals Section]
    └──enables──> [Affiliate Click Analytics]

[Catalog Reviews + Comments]
    └──requires──> [Curated Catalog]
    └──requires──> [User Auth]

[Email Notifications]
    └──requires──> [Order System] (for transactional emails)
    └──requires──> [User Auth] (for password reset)

[CSV Import/Export]
    └──requires──> [Personal Collection]
    └──requires──> [Curated Catalog] (for matching on import)

[Trade System — post-MVP]
    └──requires──> [Personal Collection]
    └──requires──> [User Auth]
    └──requires──> [Order System] (for dispute model reference)
```

### Dependency Notes

- **Curated Catalog is the foundation**: Collection management, marketplace, series tracking, reviews, and CSV import all depend on the catalog existing and being populated. The catalog must be populated before most other features deliver value.
- **PIX Payment unlocks marketplace**: Without a working payment flow, the marketplace is just a classifieds board. Payment is the trust mechanism.
- **Affiliate Deals is independent**: The /deals feature has minimal dependencies (admin panel + catalog categories for filtering). It can generate revenue before the marketplace is live.
- **Collection Limit Enforcement requires Subscription Plans**: Limits must be configured before they can be enforced. The enforcement check is simple; the subscription infrastructure is the complexity.
- **Seller Ratings require completed transactions**: RN10 — you cannot rate a seller without a completed purchase. Ratings depend on the full order lifecycle being functional.
- **Series Progress Tracking requires catalog entries to have series linkage**: Catalog schema must include series + volume + issue number at data-entry time.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates collection management + marketplace + affiliate revenue.

- [ ] **User auth (signup, login, password recovery)** — gate for all personalized features
- [ ] **Curated catalog with admin approval** — the database backbone; must be seeded at launch
- [ ] **Personal collection CRUD** — core hook; reason collectors register
- [ ] **Series tracking with progress** — retention driver; "15 of 42" is what makes collectors come back
- [ ] **Collection CSV import/export** — lowers switching cost from spreadsheets; key for early adoption
- [ ] **Mark copy as for sale + marketplace listings** — enables C2C
- [ ] **Shopping cart with 24h reservation** — correct for unique physical items
- [ ] **PIX payment with QR code + auto-verification** — Brazil-native; without this marketplace doesn't work
- [ ] **Order system with status lifecycle** — fulfillment tracking
- [ ] **Seller/buyer ratings (post-purchase)** — trust mechanism; required for C2C adoption
- [ ] **Catalog reviews and comments** — community; drives content SEO
- [ ] **Affiliate deals page (/deals)** — primary revenue; independent of marketplace; can go live day one
- [ ] **Homepage with deals of the day** — drives affiliate clicks; first impression
- [ ] **Admin panel (catalog approval, user management, commission config, affiliate deals)** — operational necessity
- [ ] **Subscription plans (FREE + BASIC) with collection limits** — validates monetization
- [ ] **Dispute system with mediation** — required for marketplace trust in C2C
- [ ] **In-app notifications (bell icon, polling)** — minimum notification awareness
- [ ] **Transactional emails (welcome, payment, shipping, sale, password reset)** — expected by users
- [ ] **Legal pages + LGPD compliance (data deletion, export)** — legal requirement for Brazil
- [ ] **Responsive layout, dark/light theme** — PRD critical requirement; mobile-first Brazil
- [ ] **i18n architecture PT-BR** — required for Brazilian market; extensible for future

### Add After Validation (v1.x)

Features to add once core is validated (users registering, collections growing, first transactions).

- [ ] **Credit card payments (Stripe)** — trigger: PIX payment working; expands payment coverage
- [ ] **STANDARD and PREMIUM subscription plans** — trigger: BASIC plan has paid subscribers
- [ ] **Miniblog (admin posts)** — trigger: catalog has enough content to editorialize; SEO value
- [ ] **Spending reports and timelines** — trigger: users have purchase history to report on
- [ ] **Missing issues finder (link from series progress to marketplace)** — trigger: catalog + marketplace both live and populated
- [ ] **Real-time notifications (SSE)** — trigger: polling lag is producing user complaints
- [ ] **Web Push notifications** — trigger: mobile engagement data shows need
- [ ] **Digest emails and quiet hours** — trigger: notification volume warrants it

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Trade system between users** — why defer: requires chat or structured messaging; complex trust/dispute model; validates only after marketplace proves users trust the platform
- [ ] **Barcode scan / AI cover recognition** — why defer: requires catalog to be rich with barcode data and high-quality cover images first; camera API QA complexity
- [ ] **News feed aggregation** — why defer: Twitter/X API instability; moderation surface; not a retention driver for collectors
- [ ] **Automated fraud detection** — why defer: low transaction volume at MVP makes false positives worse than manual monitoring; build when volume justifies it
- [ ] **Reading goals and purchase goals** — why defer: requires collection and purchase history data to exist first; retention feature, not acquisition
- [ ] **Native mobile app** — why defer: responsive web is sufficient; app doubles infrastructure cost; revisit at 10K+ active users
- [ ] **API documentation (Swagger)** — why defer: no public API consumers yet; internal API evolves faster without documentation overhead

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User authentication | HIGH | LOW | P1 |
| Curated catalog (seeded) | HIGH | HIGH | P1 |
| Personal collection CRUD | HIGH | MEDIUM | P1 |
| Series tracking + progress | HIGH | MEDIUM | P1 |
| PIX payment | HIGH | HIGH | P1 |
| Shopping cart + reservation | HIGH | MEDIUM | P1 |
| Order system + lifecycle | HIGH | HIGH | P1 |
| Affiliate deals (/deals) | HIGH | MEDIUM | P1 |
| Admin panel (core ops) | HIGH | HIGH | P1 |
| Seller/buyer ratings | HIGH | MEDIUM | P1 |
| Dispute system | HIGH | HIGH | P1 |
| Subscription plans (FREE+BASIC) | MEDIUM | HIGH | P1 |
| Legal pages + LGPD | HIGH | LOW | P1 |
| Responsive layout | HIGH | MEDIUM | P1 |
| CSV import/export | HIGH | MEDIUM | P1 |
| Transactional emails | HIGH | MEDIUM | P1 |
| Catalog reviews + comments | MEDIUM | LOW | P1 |
| In-app notifications (polling) | MEDIUM | MEDIUM | P1 |
| Favorites / wishlist | MEDIUM | LOW | P1 |
| Dark/light theme | MEDIUM | LOW | P1 |
| Homepage (configurable) | MEDIUM | MEDIUM | P1 |
| Address management | MEDIUM | LOW | P1 |
| Affiliate click analytics (admin) | MEDIUM | LOW | P1 |
| Credit card (Stripe) | HIGH | HIGH | P2 |
| Miniblog | MEDIUM | MEDIUM | P2 |
| Spending reports + timelines | MEDIUM | MEDIUM | P2 |
| Missing issues finder | HIGH | LOW | P2 |
| Real-time notifications (SSE) | MEDIUM | HIGH | P2 |
| Trade system | HIGH | HIGH | P3 |
| Barcode scan | HIGH | HIGH | P3 |
| News feed aggregation | LOW | HIGH | P3 |
| Automated fraud detection | MEDIUM | HIGH | P3 |
| Native mobile app | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add after MVP validation
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | League of Comic Geeks | CLZ Comics | ComicBookRealm | MyComicShop | Our Approach |
|---------|----------------------|------------|----------------|-------------|--------------|
| **Collection management** | Yes — robust, linked to pull list | Yes — desktop + mobile app, barcode scan (paid) | Yes — basic | No (store catalog only) | Yes — catalog-linked, free CSV import |
| **Series progress tracking** | Yes — "read progress," pull list upcoming | Yes | Yes — basic | No | Yes — missing issues → marketplace link |
| **Read status** | Yes — per issue, date | Yes | Yes | No | Yes — per copy with date |
| **Marketplace (C2C)** | No (wishlists only) | No | Price guide only | Yes — store-to-buyer, not C2C | Yes — full C2C with PIX |
| **Barcode scan** | No | Yes (paid tier) | No | No (UPC search only) | Post-MVP (catalog must have barcodes first) |
| **Condition grading** | Yes (pull list grade) | Yes | Yes | Yes (CGC integration) | Yes — 5-tier standard grades |
| **Community reviews** | Yes — robust | No | Basic | No | Yes — catalog reviews + seller ratings |
| **Comments** | Yes — per issue | No | No | No | Yes — per catalog, one nesting level |
| **Price guide / value tracking** | Basic | Yes (paid) | Yes — historical | No | Not in MVP; post-MVP via spending reports |
| **Affiliate deals** | No | No | No | No | Yes — primary revenue; PT-BR curated |
| **PT-BR support** | No | No | No | No | Yes — PT-BR native |
| **PIX payment** | N/A | N/A | N/A | N/A | Yes — table stakes for Brazil |
| **Dispute mediation** | N/A | N/A | N/A | Yes (basic) | Yes — buyer → seller → admin mediation |
| **Subscription tiers** | Free + Pro | Free + paid app | Free | N/A | FREE + BASIC at MVP |
| **CSV import/export** | No (manual only) | Yes (paid) | No | No | Yes — free, with template + error report |
| **Pull list / new releases** | Yes — flagship feature | Basic | No | No | Not MVP — requires publisher release data feed |
| **Admin catalog curation** | Staff-managed | Publisher data | Community | Staff | Admin-approved submissions |
| **News / editorial** | Yes — news feed | No | No | No | Miniblog post-MVP |

---

## Brazil-Specific Feature Considerations

**Confidence:** MEDIUM (training data on Brazilian market + PRD context)

### Why these matter for the Brazilian market:

1. **PIX is not optional.** PIX launched in November 2020 and has become Brazil's dominant digital payment method, surpassing credit/debit cards for many transaction types. A comics marketplace without PIX will be abandoned by sellers and buyers alike. This is the single most important Brazil-specific feature decision.

2. **Brazilian publishers are underrepresented in global catalogs.** Panini Brasil (Marvel/DC), Mythos Editora, Devir, Opera Graphica, Dark Horse Brasil — none of these appear in CLZ, LoCG, or ComicBookRealm catalogs at any meaningful depth. A catalog seeded with Brazilian editions is a structural moat.

3. **Mangá is mainstream in Brazil.** Brazil is one of the largest manga markets outside Japan. The platform must support manga as a first-class category, not an afterthought. Character associations (Dragon Ball, Naruto, One Piece) are as important as Marvel/DC characters.

4. **LGPD compliance is not optional.** Brazil's LGPD (Lei Geral de Proteção de Dados, 2020) requires data access, correction, deletion, and portability rights. Failure to comply exposes the platform to ANPD enforcement. This is especially relevant for a marketplace that holds financial transaction data.

5. **Trust signals for C2C.** Brazilian users have strong negative associations with Facebook group scams and OLX fraud. The dispute system, seller ratings, and escrow-like commission withholding during disputes are not premium features — they are trust prerequisites for a Brazilian C2C marketplace.

6. **Affiliate disclosure (CONAR).** Brazil's CONAR (advertising self-regulatory council) and LGPD together require clear disclosure when links are monetized. RN19 (affiliate transparency notice on all deals pages) is required by Brazilian advertising standards, not just good practice.

---

## Sources

- **League of Comic Geeks** — training knowledge of platform as of mid-2025 (MEDIUM confidence; features may have changed)
- **CLZ Comics** — training knowledge of platform as of mid-2025 (MEDIUM confidence)
- **ComicBookRealm** — training knowledge of platform as of mid-2025 (MEDIUM confidence)
- **MyComicShop** — training knowledge of platform as of mid-2025 (MEDIUM confidence)
- **Catawiki** — training knowledge of platform as of mid-2025 (MEDIUM confidence); auction model explicitly excluded from scope
- **PROJECT.md** — primary project context, HIGH confidence (first-party document)
- **docs/PRD.md v3.0** — full product requirements, HIGH confidence (first-party document)
- **PIX adoption data** — Banco Central do Brasil reports (training knowledge, MEDIUM confidence; live verification not available)
- **LGPD** — Law 13.709/2018 (HIGH confidence; well-documented in training data)
- **CONAR advertising standards** — training knowledge (MEDIUM confidence)

**Note on web research tools:** WebSearch and WebFetch tools were denied during this research session. All competitor feature knowledge is sourced from training data (knowledge cutoff ~mid-2025). Confidence is MEDIUM for all competitor claims. Recommend live verification before roadmap finalization, particularly for CLZ pricing tiers and LoCG recent feature additions.

---

*Feature research for: Comics collector platform — collection management + C2C marketplace + affiliate deals (Brazil)*
*Researched: 2026-02-21*
