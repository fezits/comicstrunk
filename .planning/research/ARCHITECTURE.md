# Architecture Research

**Domain:** Comics collector platform with C2C marketplace (Brazil)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              apps/web  (Next.js — App Router)                 │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │ Public     │  │ Collector  │  │ Seller   │  │  Admin  │  │   │
│  │  │ pages      │  │ dashboard  │  │ portal   │  │  panel  │  │   │
│  │  └────────────┘  └────────────┘  └──────────┘  └─────────┘  │   │
│  │                        ↕  REST + JSON                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTP/S  (JWT Bearer token)
┌──────────────────────────────────▼──────────────────────────────────┐
│                         API LAYER                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              apps/api  (Node.js — Express/Fastify)            │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │  Routes  │  │  Middle- │  │ Services │  │  Workers   │  │   │
│  │  │          │  │  ware    │  │ (domain) │  │ (cron/job) │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  DATA LAYER    │      │  EXTERNAL SVC    │      │  FILE STORAGE   │
│                │      │                  │      │                 │
│  MySQL         │      │  Stripe          │      │  cPanel / S3    │
│  (Prisma ORM)  │      │  PIX provider    │      │  (cover images) │
│                │      │  Email service   │      │                 │
└────────────────┘      └──────────────────┘      └─────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `apps/web` | UI rendering, routing, user interaction, client-side state | `apps/api` via REST; external payment pages via redirect |
| `apps/api` | Business logic, auth, data persistence, external integrations | MySQL (read/write); Stripe (webhooks + API); PIX provider; email service |
| `packages/types` | Shared TypeScript types and API contract DTOs | Imported by both `apps/api` and `apps/web` — no runtime dependency |
| Background workers | Scheduled tasks (reservation expiry, subscription downgrade, offer expiry) | MySQL directly; internal service layer |
| Webhook handlers | Receive payment events from Stripe and PIX provider | Internal order/payment service |

## Recommended Project Structure

```
comicstrunk/                        # monorepo root
├── apps/
│   ├── api/                        # Node.js REST API
│   │   ├── src/
│   │   │   ├── modules/            # Feature modules (see below)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   └── auth.schema.ts
│   │   │   │   ├── catalog/
│   │   │   │   ├── collection/
│   │   │   │   ├── cart/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── subscriptions/
│   │   │   │   ├── notifications/
│   │   │   │   ├── deals/
│   │   │   │   ├── admin/
│   │   │   │   └── users/
│   │   │   ├── shared/
│   │   │   │   ├── middleware/     # auth, rate-limit, validation
│   │   │   │   ├── lib/            # db client, email client, stripe client
│   │   │   │   └── utils/
│   │   │   ├── workers/            # cron jobs (reservation expiry, etc.)
│   │   │   ├── webhooks/           # Stripe + PIX webhook handlers
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── web/                        # Next.js frontend
│       ├── src/
│       │   ├── app/                # App Router pages
│       │   │   ├── (public)/       # homepage, catalog, blog, deals
│       │   │   ├── (auth)/         # login, signup, reset-password
│       │   │   ├── (collector)/    # collection, favorites, series
│       │   │   ├── (seller)/       # listings, sales dashboard
│       │   │   ├── (orders)/       # cart, checkout, my-orders
│       │   │   └── (admin)/        # admin panel
│       │   ├── components/
│       │   │   ├── ui/             # design system primitives
│       │   │   └── [feature]/      # feature-specific components
│       │   ├── lib/
│       │   │   ├── api/            # typed API client (fetch wrappers)
│       │   │   └── auth/           # session management
│       │   └── i18n/               # PT-BR messages
│       └── package.json
│
├── packages/
│   └── types/                      # shared TS types, API DTOs
│       ├── src/
│       │   ├── api.ts              # request/response shapes
│       │   └── domain.ts           # entity types
│       └── package.json
│
└── package.json                    # workspace root
```

### Structure Rationale

- **modules/ (feature modules):** Each domain feature owns its routes, service, and schema together. Prevents cross-module coupling and makes it clear what code belongs to each feature. Adding a new feature means adding one folder, not scattering files across layers.
- **shared/middleware:** Auth validation, rate limiting, and request validation live here because multiple modules consume them. Not duplicated per module.
- **workers/:** Background jobs that run on schedule (reservation expiry after 24h, subscription downgrade, offer auto-expiry) are isolated from the request lifecycle. They share the same service layer but are invoked by a scheduler, not HTTP.
- **webhooks/:** Payment events arrive asynchronously. Stripe and PIX callbacks are routed here, validated (signature check), and forwarded to the payments service. Isolated from normal routes to keep security logic explicit.
- **packages/types:** Shared only for contracts (DTOs, enum values). Never shared implementation. This keeps the apps independently deployable while preventing type drift between the API contract and the frontend's expectations.
- **app/ route groups:** Next.js App Router route groups `(public)`, `(auth)`, `(collector)`, etc. organize pages by access level without affecting the URL. Layouts per group enforce auth requirements consistently.

## Architectural Patterns

### Pattern 1: Feature Module with Service Layer

**What:** Each domain feature (catalog, collection, cart, orders) is a self-contained module: routes handle HTTP concerns, a service handles business logic, schemas validate inputs. The route calls the service; the service calls the database. No business logic in routes, no HTTP concepts in services.

**When to use:** Every feature module in `apps/api`.

**Trade-offs:** Adds one indirection layer. Worth it because services become independently testable and can be called from multiple routes or workers without duplicating logic.

**Example:**
```typescript
// modules/cart/cart.routes.ts
router.post('/cart/items', authenticate, async (req, res) => {
  const { comicId } = cartSchema.addItem.parse(req.body);
  const item = await cartService.addItem(req.user.id, comicId);
  res.json(item);
});

// modules/cart/cart.service.ts
async function addItem(userId: string, comicId: string) {
  // business logic: check availability, create reservation, set 24h expiry
  // no HTTP, no req/res — pure domain logic
}
```

### Pattern 2: Price Snapshot on Order Creation

**What:** When a buyer checks out, the current price, commission rate, and seller net amount are written immutably to the `order_items` table. The live price in `comics` (the listing) is the source of truth for new purchases; the snapshot is the source of truth for everything after order creation.

**When to use:** Order creation only. All post-order reporting, disputes, and payouts read the snapshot, never the live listing price.

**Trade-offs:** Requires explicit snapshot logic at checkout time. The benefit is auditability and correctness: price or commission changes never retroactively affect existing orders (RN04, RN05).

**Example:**
```typescript
// modules/orders/orders.service.ts
async function createOrder(userId: string, cartId: string) {
  const cartItems = await getCartWithCurrentPrices(cartId);
  const sellerPlan = await getSellerPlan(cartItems[0].sellerId);
  const commissionRate = commissionConfig[sellerPlan];

  const orderItems = cartItems.map(item => ({
    comicId: item.comicId,
    priceSnapshot: item.currentPrice,       // locked at creation
    commissionRateSnapshot: commissionRate, // locked at creation
    sellerNetSnapshot: item.currentPrice * (1 - commissionRate),
  }));
  // insert order + items in a single transaction
}
```

### Pattern 3: Reservation via Database Lock with Expiry

**What:** Cart reservations are rows in a `cart_reservations` table with `expires_at` and `reserved_by`. Before inserting, the service checks no active reservation exists for that comic. A scheduled worker (cron every 5 minutes) deletes expired reservations, making items available again.

**When to use:** Cart add-item flow. The uniqueness constraint on `comic_id` in `cart_reservations` is the enforcement mechanism — the database prevents double-reservation, not application-level checks alone.

**Trade-offs:** Polling-based release (cron) introduces up to a 5-minute delay before an expired item reappears as available. Acceptable for this scale; a real-time approach would require a queue, which is over-engineering for the MVP.

```typescript
// workers/reservation-expiry.worker.ts
// runs every 5 minutes via node-cron
async function releaseExpiredReservations() {
  await db.cartReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
}
```

### Pattern 4: Webhook Idempotency Guard

**What:** Every incoming webhook event (Stripe, PIX) is logged in a `webhook_events` table with its provider event ID before processing. If the same event ID arrives again, the handler returns 200 immediately without reprocessing (RN14).

**When to use:** All payment webhook handlers.

**Trade-offs:** Requires one extra DB write per webhook. The alternative — duplicate order state transitions — is catastrophic.

```typescript
// webhooks/stripe.webhook.ts
async function handleStripeEvent(event: Stripe.Event) {
  const already = await db.webhookEvent.findUnique({
    where: { providerId: event.id }
  });
  if (already) return; // idempotent: already processed

  await db.webhookEvent.create({ data: { providerId: event.id, type: event.type } });
  await processStripeEvent(event); // actual business logic
}
```

### Pattern 5: Typed API Client on the Frontend

**What:** `apps/web/src/lib/api/` contains one typed fetch wrapper per resource group. These functions are the only place where `fetch` is called against the API. Components import from this client, never calling `fetch` directly.

**When to use:** Every data-fetching call in `apps/web`.

**Trade-offs:** One additional file per resource. The benefit is a single place to update base URL, auth headers, and response shape — and full TypeScript coverage from the `packages/types` shared contract.

```typescript
// apps/web/src/lib/api/catalog.ts
export async function getCatalogItem(id: string): Promise<CatalogItemDTO> {
  const res = await apiFetch(`/catalog/${id}`);
  return res.json();
}
```

## Data Flow

### Standard Request Flow (authenticated)

```
Browser action (e.g., "Add to cart")
    ↓
Next.js page/component
    ↓ calls
apps/web/lib/api/cart.ts  (typed fetch, attaches JWT)
    ↓ HTTP POST /api/cart/items
apps/api — authenticate middleware  (validates JWT, sets req.user)
    ↓
apps/api — validation middleware  (Zod schema parse)
    ↓
cart.routes.ts  (routes only — no logic)
    ↓ calls
cart.service.ts  (business rules, reservation check)
    ↓ queries
Prisma → MySQL
    ↑
cart.service.ts  (returns domain object)
    ↑
cart.routes.ts  (serializes to JSON response)
    ↑
apps/web  (updates local state or triggers revalidation)
    ↑
UI reflects new state
```

### Payment Flow (PIX)

```
Buyer clicks "Pay with PIX"
    ↓
POST /api/orders/:id/pay  { method: "PIX" }
    ↓
payments.service.ts
    ├── creates payment record (status: PENDING)
    ├── calls PIX provider API → receives QR code + payment ID
    └── stores PIX payment ID on payment record
    ↓
Response: { qrCode, copyPaste, expiresAt }
    ↓
Frontend: displays QR code, starts polling GET /api/payments/:id/status
    ↓ (user pays on banking app)
PIX provider → POST /api/webhooks/pix  (async callback)
    ↓
webhooks/pix.webhook.ts
    ├── verify signature
    ├── idempotency check
    └── payments.service.confirmPayment()
        ├── update payment status → PAID
        ├── update order status → PAID → IN_PROCESSING
        ├── release cart reservation
        └── trigger notifications (seller + buyer)
    ↓
Next poll from frontend returns PAID → redirect to order confirmation
```

### Subscription Flow (Stripe)

```
User selects BASIC plan
    ↓
POST /api/subscriptions  { planId: "basic", interval: "monthly" }
    ↓
subscriptions.service.ts
    ├── creates/retrieves Stripe customer
    ├── creates Stripe Checkout Session
    └── returns { checkoutUrl }
    ↓
Frontend redirects to Stripe-hosted checkout
    ↓ (user completes payment on Stripe)
Stripe → POST /api/webhooks/stripe  (checkout.session.completed)
    ↓
webhooks/stripe.webhook.ts
    ├── idempotency check
    └── subscriptions.service.activateSubscription()
        ├── update user plan → BASIC
        ├── set subscription end date
        └── trigger welcome email
```

### Webhook-Driven State Transitions

```
External event (Stripe / PIX provider)
    ↓
/api/webhooks/[provider]
    ├── signature validation  (HMAC check against provider secret)
    ├── idempotency check     (event ID in webhook_events table)
    └── route to domain service
        ├── payment.confirm()     → order status update
        ├── subscription.renew()  → plan extension
        └── subscription.fail()   → schedule downgrade
```

### Background Worker Flow

```
node-cron scheduler (every 5 min / daily / hourly)
    ↓
workers/[name].worker.ts
    ├── reservation-expiry:    delete expired cart_reservations
    ├── order-cancellation:    cancel unpaid orders after 7 days
    ├── deal-expiry:           mark expired affiliate offers as inactive
    ├── subscription-check:    downgrade users whose paid period ended
    └── notification-digest:   (post-MVP) batch email digests
```

### Key Data Flows Summary

1. **Catalog → Collection:** User picks a catalog entry (the "product definition") and adds their physical copy as a `comic` record linked to that `catalog_item`. The catalog is the shared reference; the comic is the user's specific instance.
2. **Comic → Cart → Order:** A comic marked "for sale" appears in search results. When added to cart, a `cart_reservation` locks it. Checkout converts reservation to an immutable order with price snapshot. Reservation is released on order creation (or expiry).
3. **Order → Payment → Payout:** Order triggers a payment request (PIX QR or Stripe). Webhook confirms payment. Seller net value is stored in the snapshot and appears in the admin's payout dashboard. Actual bank transfer is manual (admin processes it based on dashboard).
4. **Affiliate Click Tracking:** User clicks a deal on `/deals`. The frontend calls `POST /api/deals/:id/click` before redirecting to the affiliate URL. The API increments click count atomically. No client-side tracking pixels — all tracking server-side to survive ad blockers.

## Suggested Build Order

Dependencies between components determine safe build order. Each layer must be stable before layers above it can be built.

```
Phase 1 — Foundation (everything depends on this)
├── Monorepo setup, TypeScript config, ESLint, shared packages/types
├── MySQL schema + Prisma setup (all tables, even unused ones — prevents migrations chaos)
├── API skeleton: Express/Fastify app, middleware chain, error handling
└── Auth module: JWT issue/refresh, password hash, signup/login endpoints

Phase 2 — Catalog (marketplace depends on it; collection depends on it)
├── Catalog CRUD + editorial approval workflow
├── Series, categories, tags, characters — admin-managed taxonomy
└── Search + filters + pagination endpoint

Phase 3 — Collection (core user hook, needed before marketplace)
├── Comic (exemplar) add/edit/remove, linked to catalog
├── Read status, condition, notes
├── Series progress tracking
└── CSV import/export

Phase 4 — Marketplace Core (cart + orders + PIX)
├── Cart with 24h reservation (requires Phase 2 catalog)
├── Order creation with price snapshot
├── PIX payment integration + webhook handler
├── Idempotency layer for webhooks
└── Shipping tracking (seller updates tracking code)

Phase 5 — Subscriptions (plan enforcement required for collection limits)
├── Stripe integration: Checkout Session, webhook handler
├── Plan enforcement: collection limit gate
├── Commission calculation per plan at checkout
└── Automatic downgrade worker

Phase 6 — Community + Social
├── Catalog reviews (1-5 stars + text)
├── Seller reviews (post-purchase gate)
├── Comments + likes
└── Favorites

Phase 7 — Notifications
├── Notification data model + in-app bell/dropdown
├── Transactional email integration
└── Notification preferences (on/off per type)

Phase 8 — Affiliate Deals (revenue from day one)
├── Deal/coupon admin CRUD with affiliate tag config
├── /deals page with filters + auto-expiry
└── Click tracking (server-side)

Phase 9 — Admin Panel
├── Dashboard metrics
├── Catalog approval queue
├── User/content management
└── Commission and plan configuration

Phase 10 — Legal + Compliance
├── Legal document management with versioning
├── Mandatory acceptance flows (signup, first listing)
├── Dispute flow (buyer → seller → admin mediation)
└── LGPD: account deletion, data export

Phase 11 — Homepage + Polish
├── Configurable homepage sections (banner, highlights, deals)
├── Contact form
├── Seller bank account management
└── Production hardening: health checks, backups, HTTPS
```

**Ordering rationale:**
- Auth (Phase 1) must exist before any feature can enforce user identity.
- Catalog (Phase 2) must exist before collection (users add copies of catalog items) and before marketplace (listings reference catalog entries).
- Collection (Phase 3) is the core user retention hook and must exist before subscriptions enforce collection limits.
- Cart + payments (Phase 4) can be built as soon as catalog exists — it doesn't require collection to be complete.
- Subscriptions (Phase 5) require the payment webhook infrastructure established in Phase 4.
- Notifications (Phase 7) can start after Phase 4 because the most critical emails are payment confirmations.
- Affiliate deals (Phase 8) are independent of the marketplace — they can be built any time after the admin panel is partially in place, but are grouped post-community because community features drive the audience that makes deals valuable.

## API Design Patterns

### URL Structure

```
/api/v1/
├── auth/               signup, login, refresh, logout, forgot-password
├── catalog/            list, show, create, update, delete, approve, reject
├── series/             list, show, create, update, delete
├── collection/         list, show, add, update, remove, import, export
├── cart/               show, add-item, remove-item, clear
├── orders/             list, show, create, update-shipping
├── payments/           create, status, refund
├── subscriptions/      create, cancel, status
├── deals/              list, show, click-track
├── notifications/      list, mark-read, preferences
├── users/              profile, addresses, bank-accounts
├── admin/              (prefixed admin routes for all management)
└── webhooks/           stripe, pix  (no auth — signature validation instead)
```

### Response Envelope

All API responses use a consistent envelope:

```typescript
// Success
{ "data": T, "meta"?: { "total": number, "page": number, "perPage": number } }

// Error
{ "error": { "code": string, "message": string, "details"?: object } }
```

### Pagination

All list endpoints accept `?page=1&perPage=20`. No cursor-based pagination for MVP — offset pagination is sufficient at this scale and simpler to implement.

### Auth Headers

```
Authorization: Bearer <jwt_access_token>
```

Refresh tokens stored in httpOnly cookie. Access tokens are short-lived (15 min). Refresh tokens are long-lived (30 days), rotated on use.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe | Server-side SDK (`stripe` npm); Checkout Sessions for subscriptions; webhook verification via `stripe.webhooks.constructEvent` | Never expose Stripe secret key to frontend. Publishable key only for client-side Stripe.js if needed |
| PIX provider (e.g., Gerencianet/Efí, PagSeguro, Mercado Pago) | REST API call from `payments.service.ts`; webhook callback on `/api/webhooks/pix` | Must verify HMAC signature on every webhook. Store PIX transaction ID for idempotency |
| Email service (e.g., Resend, SendGrid, Nodemailer + SMTP) | Service abstraction in `shared/lib/email.ts`; called from notification service | Queue-like retry on failure. Template rendering in service, not in routes |
| cPanel file storage | Multipart upload via API, stored on cPanel hosting filesystem or configured S3-compatible storage | Image uploads for comic covers and user avatars. Validate file type and size server-side |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `apps/api` | REST over HTTP/S | All communication through typed API client. No shared runtime state |
| `apps/api` modules ↔ each other | Direct function call (service imports service) | Keep this minimal — only `orders.service` imports `cart.service` (to release reservation at checkout) and `notifications.service` (to trigger alerts). Cross-module imports indicate coupling |
| `apps/api` ↔ workers | Shared service layer — workers import the same services used by routes | Workers are not a separate process in MVP; they run in the same Node process via node-cron. Post-MVP can be extracted |
| `packages/types` ↔ `apps/*` | TypeScript `import` only — no runtime code | Types package must never contain business logic or Node.js imports |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (MVP) | Single Node.js process per app; cron workers in-process; simple polling for notifications; offset pagination sufficient |
| 1k–100k users | Add read replicas for MySQL (reporting queries drain the primary); extract workers to separate process or BullMQ queue; add Redis cache for catalog search results and session storage; replace polling with SSE for real-time notifications |
| 100k+ users | Consider splitting heavy domains (payments, search) into separate services; CDN for static assets and cover images; full-text search engine (Meilisearch or Elasticsearch) to replace MySQL LIKE queries |

### Scaling Priorities

1. **First bottleneck:** Catalog search with multiple concurrent filters against MySQL LIKE queries. Fix: add composite indexes first, then Redis cache for popular queries. Full-text search engine only if indexing is insufficient.
2. **Second bottleneck:** Reservation expiry cron running in-process competes with request handling under load. Fix: extract workers to BullMQ + Redis queue when this becomes measurable.

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Routes

**What people do:** Put commission calculation, reservation checks, and price snapshot logic directly in route handlers.

**Why it's wrong:** Routes become untestable and logic is duplicated when workers or webhooks need the same behavior. A reservation expiry worker can't reuse route logic.

**Do this instead:** Routes are thin — validate input, call service, return response. All domain rules live in the service layer.

### Anti-Pattern 2: Sharing Implementation Between Apps

**What people do:** Create a `packages/shared` with database client, service functions, or business logic imported by both `apps/api` and `apps/web`.

**Why it's wrong:** Breaks the decoupling. `apps/web` ends up with a database dependency. The apps can no longer be deployed independently, and Next.js server bundles grow with Node.js-only code.

**Do this instead:** `packages/types` contains only TypeScript interfaces and enums (no runtime code). The frontend never touches the database — it talks to the API exclusively.

### Anti-Pattern 3: Querying Prices at Read Time for Orders

**What people do:** Store only the `comic_id` on an order item and join to the current listing price when displaying the order.

**Why it's wrong:** If the seller updates their price, or the commission config changes, the order history shows wrong values. Disputes are impossible to resolve fairly without the original price.

**Do this instead:** Snapshot `price`, `commission_rate`, and `seller_net` into the `order_items` row at the moment of order creation. Never recalculate from live data (RN04).

### Anti-Pattern 4: Frontend Calling External Payment APIs Directly

**What people do:** Call Stripe or PIX provider APIs from `apps/web` (e.g., in a Server Action) to reduce API round-trips.

**Why it's wrong:** Exposes API secrets in the Next.js server context, bypasses idempotency guards, and duplicates business logic that belongs in the API.

**Do this instead:** `apps/web` calls `apps/api`. The API owns all external service integrations, secrets, and webhook handling.

### Anti-Pattern 5: Single `users` Table Trying to Cover All Roles

**What people do:** Add `is_admin`, `is_seller`, `commission_rate`, `stripe_customer_id`, `bank_account_*` as columns on the users table.

**Why it's wrong:** The table becomes a dumping ground that's hard to query and maintains nullable columns for most rows. As roles diverge, the joins needed to assemble a "seller profile" become complex.

**Do this instead:** Separate related tables: `user_subscriptions`, `seller_profiles` (bank accounts, payout data), `admin_settings`. The `users` table stays lean (auth identity, plan level, role enum).

## Sources

- Project constraints documented in `.planning/PROJECT.md` (MySQL, cPanel, monorepo, Node.js + Next.js — decided by team)
- PRD business rules in `docs/PRD.md` v3.0 (reservation mechanics RN01-RN02, price snapshot RN04, commission RN05, webhook idempotency RN14)
- Confidence HIGH for structural patterns (service layer, module organization, snapshot pattern) — these are well-established patterns with strong consensus in Node.js/Express ecosystems
- Confidence MEDIUM for specific library choices within the API framework — verified against common cPanel-compatible patterns but not benchmarked for this specific load profile

---
*Architecture research for: Comics collector platform with C2C marketplace — decoupled Node.js API + Next.js frontend + MySQL*
*Researched: 2026-02-21*
