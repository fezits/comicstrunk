# Pitfalls Research

**Domain:** Comics collector platform with unique-item marketplace, PIX payments, subscription tiers, cPanel hosting (Brazil)
**Researched:** 2026-02-21
**Confidence:** HIGH (domain-specific reasoning from PRD + known ecosystem patterns for each risk area)

---

## Critical Pitfalls

### Pitfall 1: Race Condition on Unique-Item Cart Reservation

**What goes wrong:**
Two buyers add the same physical comic to their carts simultaneously. Both reservation requests hit the API within milliseconds of each other. Without a database-level lock, both succeed — the item is "reserved" to two users, leading to double-sell at checkout time. The system detects the conflict only when the second buyer tries to pay, after they've been waiting for 24h.

**Why it happens:**
Developers treat the cart reservation as a two-step read-then-write: (1) check if item is free, (2) mark it reserved. In concurrent requests, both reads return "free" before either write completes. Application-level locks or status checks in code without a database transaction do not solve this.

**How to avoid:**
Use a single atomic UPDATE with a WHERE clause that enforces uniqueness:
```sql
UPDATE comic_copies
SET reserved_by = ?, reserved_until = DATE_ADD(NOW(), INTERVAL 24 HOUR), status = 'reserved'
WHERE id = ? AND status = 'available'
```
Check `affectedRows === 1` in the result. If zero rows affected, the reservation failed — another buyer got it first. Never do SELECT then UPDATE in separate queries. Add a unique index or constraint so `status = 'reserved'` + `reserved_by IS NOT NULL` cannot exist twice for the same item.

**Warning signs:**
- Reservation logic written as `if (item.status === 'available') { item.status = 'reserved' }` anywhere in application code without a DB transaction
- Using optimistic locking with a version field but no pessimistic fallback
- Integration tests that don't exercise concurrent requests

**Phase to address:**
Cart & Marketplace phase. Must be solved before any seller lists items. Test with concurrent API calls in integration suite from day one.

---

### Pitfall 2: PIX Webhook Processed Without Idempotency Guard

**What goes wrong:**
PIX payment providers (Gerencianet/EFI, Pagar.me, Mercado Pago, Asaas, etc.) send the same webhook multiple times as a reliability mechanism. Each delivery can trigger order confirmation, inventory release, and commission recording. Without an idempotency check, the same payment event creates duplicate order state changes, double-books commission, sends multiple "order confirmed" emails to the buyer, and corrupts financial audit logs.

**Why it happens:**
Developers implement the happy path (receive webhook → confirm payment) without accounting for retries. The PRD mentions RN14 (idempotency on webhooks) but the rule is easily forgotten during implementation when a developer is focused on the payment flow itself.

**How to avoid:**
Store every processed webhook event ID in a `webhook_events` table with a unique constraint on `(provider, event_id)`. At the top of every webhook handler, attempt to insert that record. If it already exists, return HTTP 200 immediately without processing. Never skip this even in development — test with duplicate webhook payloads. Wrap the entire webhook processing in a database transaction so partial failures don't leave the system in an inconsistent state.

**Warning signs:**
- Webhook handler has no early-exit for duplicate event IDs
- No `webhook_events` table in the schema
- Integration tests don't test what happens when the same webhook fires twice
- Manual QA steps say "send a test webhook" without a "send it twice" step

**Phase to address:**
Payments phase. Must be designed before any PIX integration is coded. The `webhook_events` table and idempotency middleware should be the first thing built in that phase, not added later.

---

### Pitfall 3: PIX QR Code Expiration Not Synchronized With Cart Reservation

**What goes wrong:**
Cart reservation lasts 24 hours (RN01). PIX payment expires in 24 hours (PRD §4.5). If both clocks start at the same moment, a buyer who spends 23h 50min in checkout generates a PIX QR code that expires in 10 minutes — but the cart reservation also expires in 10 minutes. If the payment confirmation arrives 1 second after both expire, the item is already free in the cart, the payment has no order to attach to, and the buyer paid for something the system already unlocked for another buyer.

**Why it happens:**
PIX expiration and cart reservation expiration are implemented independently. Developers assume "both are 24 hours so they stay in sync." They don't account for: (1) a user who adds to cart early and pays late, (2) the payment QR code being generated partway through the reservation window, not at the start.

**How to avoid:**
Generate the PIX QR code only at checkout initiation, not at cart-add time. Set the PIX expiration to be shorter than the remaining cart reservation time (e.g., PIX expires at `MIN(remaining_cart_time - 5min, 30min)`). Implement a grace period in webhook processing: if a payment confirmation arrives for an expired-but-recently-expired reservation (within 5 minutes), hold the transaction for manual admin review rather than auto-rejecting. Log all such edge cases. Issue an automatic PIX refund for payments that cannot be fulfilled.

**Warning signs:**
- PIX QR code TTL is hardcoded to 24h regardless of cart reservation age
- No handling for the "payment arrived but reservation expired" case in webhook code
- No refund flow for orphaned PIX payments

**Phase to address:**
Payments phase, designed alongside cart reservation. The two systems must be designed together, not independently.

---

### Pitfall 4: Commission Snapshot Not Taken at Order Creation

**What goes wrong:**
The seller's subscription plan changes between the moment they list an item and the moment a buyer pays. If commission is calculated at payment time using the seller's current plan, a seller who downgraded from BASIC (8%) to FREE (10%) after listing gets charged the higher commission retroactively. Or, an admin changes commission rates globally and all in-progress orders get repriced. Both violate the seller's legitimate price expectations and create trust-destroying disputes.

**Why it happens:**
Developers query `commission_rate` from the seller's current plan at payment processing time — it's the "freshest" data. The PRD states RN04 (price snapshot) but it's easy to implement the snapshot for the item price while forgetting to also snapshot the commission rate and net-to-seller amount.

**How to avoid:**
At order line creation, record three immutable values: `price_snapshot`, `commission_rate_snapshot`, and `seller_net_snapshot`. These fields are set once and never updated. Commission rate comes from the seller's active plan at order creation time, not payment time. Admin changes to plan rates only affect future orders. Make these columns NOT NULL with no default in the schema so forgetting to set them causes an immediate error.

**Warning signs:**
- Order line table has `price` but no `commission_rate` or `seller_net` columns
- Commission is computed at payment time by joining to the current plan table
- No test for the scenario: seller lists item → seller upgrades plan → buyer pays → verify correct commission applied

**Phase to address:**
Marketplace + Payments phase. The `orders` and `order_items` schema must include snapshot columns from the start. Retrofitting this is a data migration risk.

---

### Pitfall 5: cPanel Node.js Process Management Without Restart Strategy

**What goes wrong:**
cPanel's Node.js application manager uses Phusion Passenger under the hood. Node.js processes are managed differently than traditional shared hosting PHP. Common failure modes: (1) The process crashes and cPanel does not restart it automatically without correct configuration, leaving the API returning 502 errors indefinitely. (2) After a deployment (new files uploaded), the old process continues serving stale code because `restart.txt` was not touched. (3) Memory leaks accumulate over days until cPanel kills the process, causing unexpected downtime.

**Why it happens:**
Developers experienced with PM2 on VPS environments assume cPanel behaves the same. cPanel/Passenger has a different restart mechanism (`touch tmp/restart.txt` in the app root) and different environment variable handling (set in cPanel UI, not in `.env` files by default). The first deployment that "works on VPS" silently fails on cPanel.

**How to avoid:**
Set up and test the full cPanel deployment pipeline before writing any application code. Verify: (1) `tmp/restart.txt` touch triggers a process restart, (2) environment variables are correctly injected via cPanel's env var UI, not `.env` file (or confirm `.env` loading works with Passenger), (3) `app.js` / entry point path is correctly configured in cPanel's Node.js app settings. Add a `GET /health` endpoint that returns 200 with process uptime — use it as the smoke test after every deployment. Document the exact deployment steps in a runbook.

**Warning signs:**
- No deployment runbook exists
- Health check endpoint not implemented
- Environment variable loading tested only locally with `.env`, never verified in cPanel environment
- No post-deploy smoke test step in the deployment process
- First cPanel deployment attempt done after significant application code is written

**Phase to address:**
Foundation phase (Phase 1). The cPanel deployment pipeline must be verified with a trivial "hello world" app before the project diverges further. This is a go/no-go gate for the entire technical stack.

---

### Pitfall 6: Collection Limit Enforcement With Race Condition

**What goes wrong:**
A FREE plan user has 49 comics in their collection (limit: 50). They open the collection page in two browser tabs and click "add comic" in both simultaneously. Both requests read the current count as 49, both pass the limit check, both insert — resulting in 51 comics in a FREE collection. At scale (or with a fast double-click), this creates a consistent enforcement gap.

**Why it happens:**
The limit check is implemented as: `SELECT COUNT(*) FROM collection WHERE user_id = ?` → check `count < limit` → INSERT. The read and write are not atomic. Same pattern as the cart reservation race condition but manifests differently.

**How to avoid:**
Same solution as the cart race: one atomic query. Use `INSERT ... SELECT` pattern with a subquery that counts and enforces the limit in a single statement, or use a row-level lock (`SELECT COUNT(*) ... FOR UPDATE` inside a transaction before INSERT). Alternatively, enforce with a database trigger on the collection table. Also add a `collection_count` denormalized counter on the user record, updated atomically with the INSERT using transactions — this counter can also be used for efficient limit enforcement without full COUNT queries.

**Warning signs:**
- Limit check is a separate SELECT before INSERT with no transaction wrapping both
- No unit test that fires two simultaneous add-to-collection requests for a user at their limit
- `collection_count` only tracked in application memory, not in the database

**Phase to address:**
Collection management phase. Must be implemented correctly the first time — data integrity bugs in user collections are very hard to remediate after real user data exists.

---

### Pitfall 7: Affiliate Link Tracking Without Click Attribution Integrity

**What goes wrong:**
Affiliate links (Amazon, Mercado Livre, eBay, etc.) contain partner tracking tags appended as query parameters (e.g., `?tag=comicstrunk-20`). Developers build a click-tracking redirect endpoint (`/go/:offer_id`) that logs the click then redirects. The pitfall: (1) If the redirect fires before the click is logged (async write after redirect), bots and crawlers generate phantom analytics. (2) If the affiliate tag is embedded directly in the stored URL and a partner changes their tag format, all historical links break silently. (3) No deduplication means one user refreshing the /deals page generates 10x click counts.

**Why it happens:**
Affiliate tracking is perceived as simple ("just log it and redirect"). The edge cases — bot traffic, duplicate clicks, tag management, broken links — are discovered only after the analytics dashboard shows impossible numbers.

**How to avoid:**
(1) Log clicks synchronously before redirect (or use a fire-and-forget pattern where the redirect is non-blocking but the log insertion is guaranteed via a queue). (2) Store the affiliate tag separately from the destination URL in the database — compose them at redirect time. This lets admins update tags without touching individual offer URLs. (3) Deduplicate clicks with a session/user + offer + 1-hour window: the same user clicking the same offer multiple times counts once. (4) Filter known bot User-Agent strings before recording. (5) Validate that the destination URL is still reachable periodically (background job).

**Warning signs:**
- Affiliate tag is baked directly into the stored URL string
- Click logging is done asynchronously after the HTTP redirect has already fired
- No deduplication logic in click tracking
- Analytics show click counts dramatically higher than page views

**Phase to address:**
Affiliate deals phase. The click-tracking endpoint is the first thing to build, before any offer goes live. Revenue analytics depend on clean data from day one.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store commission rate as join to current plan (not snapshot) | Simpler schema | Financial disputes when rates change; rewrites order history | Never — snapshot is required by RN04 |
| Use application-level status checks for unique-item locking | Faster to code | Double-sells in production under concurrent load | Never for unique items |
| Skip webhook idempotency and hope for no retries | 1 hour saved | Duplicate orders, double commissions, angry users | Never |
| Hardcode PIX expiry to 24h without tying to cart expiry | Simple implementation | Orphaned paid-but-unfulfilable payments | Never |
| Deploy to cPanel without testing the pipeline first | Feels like it saves time | Weeks of debugging infra issues mid-project | Never — must validate infra first |
| Enforce collection limits only in the frontend | Simple to implement | Trivially bypassable via API; inconsistent data | Never — always enforce in backend |
| Embed affiliate tags in stored URLs | Simpler data model | Cannot update tags; broken links when partners change formats | Only in the most time-constrained prototype, never in production |
| Use polling to check PIX payment status instead of webhooks | Easier to test locally | Polling misses confirmations, delays order confirmation, wastes API quota | Acceptable as a fallback only if provider has polling API; webhooks are primary |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PIX provider (Gerencianet/EFI, Pagar.me, Asaas, etc.) | Assuming all providers have identical webhook payload structure | Normalize webhook events to an internal format at the adapter layer; never use provider-specific field names in business logic |
| PIX provider | Testing only in sandbox; production has different MTLS/certificate requirements | Set up and test production credentials in a staging environment before launch |
| PIX provider | Not verifying webhook signature (HMAC or mTLS) | Always validate the webhook source — unauthenticated webhooks let attackers fake payment confirmations |
| Stripe (subscriptions) | Treating Stripe subscription webhooks as perfectly reliable ordering | Stripe can send `invoice.paid` before `customer.subscription.created` — handle out-of-order events gracefully |
| Stripe (subscriptions) | Not handling `invoice.payment_failed` → `customer.subscription.deleted` chain | Implement the full downgrade-to-FREE flow triggered by Stripe webhook, tested end-to-end |
| cPanel Node.js | Uploading `.env` file directly to server | Use cPanel's environment variable UI; `.env` files in web-accessible directories are a security risk |
| cPanel Node.js | Forgetting to touch `tmp/restart.txt` after deploying new code | Automate this step in the deployment script; stale code is invisible to the developer but broken for users |
| cPanel Node.js | Using `require('dotenv').config()` and assuming it works identically to local dev | Verify environment variable loading in the actual cPanel environment before writing environment-dependent code |
| Mercado Livre affiliate | Using the ML affiliate program API vs. manually appended tags | ML affiliate tags have different formats for different product categories; test with actual product URLs |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full collection to count items for limit check | Slow "add to collection" for users with 200+ items | Maintain a denormalized `collection_count` on the user record, updated atomically | ~100 items per user |
| Querying all active cart reservations to check for expired ones | Slow reservation expiry sweep | Add a database index on `reserved_until`; use a scheduled job that queries only `WHERE reserved_until < NOW()` | ~1000 active reservations |
| Rendering the catalog search with no index on filterable columns | Search results take 5+ seconds | Add composite indexes on `(status, category_id)`, `(status, series_id)`, `(status, publisher_id)` at schema creation | ~500 catalog items |
| Affiliate click logging as a synchronous DB write in the redirect path | Slow redirects (200ms+ added to every link click) | Log clicks to a queue (Redis, Bull) and process asynchronously; redirect immediately | High traffic on /deals page |
| Counting total order items per seller for the admin dashboard | Dashboard takes 10+ seconds to load | Precompute aggregates in a background job or use denormalized counters | ~10K orders |
| Loading all notifications for a user without pagination | Notification page locks up for active users | Always paginate notifications; add index on `(user_id, created_at DESC)` | ~500 notifications per user |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not verifying PIX webhook source (no HMAC or mTLS validation) | Attacker sends fake "payment confirmed" webhook, gets items for free without paying | Implement webhook signature validation as the first line of the webhook handler; reject without logging anything if signature invalid |
| Exposing seller bank account details in public API responses | Data breach exposes CPF, bank account, agency numbers | Bank account data accessible only to admin endpoints and the owning seller; never include in public marketplace responses |
| Returning full user data (including email, CPF) in marketplace item listings | PII exposure in catalog/marketplace responses | Marketplace item responses include only seller display name and rating; separate seller profile endpoint with auth required |
| Allowing any authenticated user to "buy" items via direct API call without checking they're not the seller | Seller self-purchases to game the review system | Enforce RN03 (no self-purchase) at the API layer, not just UI — validate `item.seller_id !== request.user.id` in the order creation endpoint |
| Affiliate link redirect endpoint with open redirect vulnerability | Attacker crafts `/go/` URLs that redirect to phishing sites | Validate that the redirect destination matches a whitelist of allowed domains (amazon.com.br, mercadolivre.com.br, etc.) before redirecting |
| Commission rate configurable by admin with no audit log | Admin changes commission rates without accountability; disputes with sellers | Every change to commission configuration must be logged with admin user ID, timestamp, old value, and new value |
| Subscription downgrade check only on Stripe webhook | If Stripe webhook delivery fails, user retains paid benefits indefinitely | Implement a daily background job that cross-checks Stripe subscription status with local database; reconcile discrepancies |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "add to collection" button without telling the user how many slots they have left | User hits the limit unexpectedly; confusion and frustration | Always display "X of Y comics in your collection" prominently on the collection page and near the add button |
| Cart reservation countdown not visible | User returns to a cart they assume is still valid; item was released; they feel deceived | Show a countdown timer (hours remaining) on each reserved cart item; send a notification when under 2 hours remain |
| PIX QR code without a "copy code" button | Mobile users cannot scan their own screen; desktop users struggle with QR reader apps | Always provide QR code + Pix copia-e-cola text + copy-to-clipboard button; these are the three standard UX patterns for PIX in Brazil |
| Catalog approval rejection email with only "Rejected" — no reason | Contributor re-submits the same wrong data repeatedly | Rejection emails and in-app notifications must include the admin's rejection reason; this is required by PRD §4.2 |
| Showing raw commission rate to seller without showing net amount | Seller cannot do mental math for every item | Show: list price, commission amount in BRL, and net-to-seller in BRL — all three simultaneously — when seller sets a price |
| Blocking UI during PIX payment waiting period | User leaves the page, payment confirms but notification is not seen | Use polling or webhook-driven update to the frontend; the PIX waiting screen must auto-update when payment is confirmed without a page reload |
| Enforcing collection limit only at "add" time, not at import | User imports 300 comics via CSV on a FREE plan; all 300 land in the DB; limit is meaningless | Enforce collection limit during CSV import processing server-side; report how many were imported vs. how many were blocked and why |

---

## "Looks Done But Isn't" Checklist

- [ ] **Cart reservation expiry:** Reservations "expire" — verify a background job actually runs and releases them; check that `status` returns to `'available'` and the item appears in search results again
- [ ] **PIX payment confirmation:** QR code generates and displays — verify the webhook actually fires in production (not just sandbox), the order status changes to `PAID`, the seller gets notified, and the item is marked sold
- [ ] **Commission snapshot:** Orders are created — verify `commission_rate_snapshot` column is populated with the seller's plan rate at order creation time, not joined from the current plan at query time
- [ ] **Collection limit enforcement:** Limit blocks adding at 50 — verify the limit also applies to CSV import, to the API endpoint directly (not just the frontend button), and to concurrent requests
- [ ] **Subscription downgrade:** Subscription is canceled in Stripe — verify the local database is updated, the user's plan returns to FREE, and collection access above the FREE limit is gracefully handled (not deleted, just blocked from adding more)
- [ ] **Affiliate link redirect:** Redirect fires — verify click is logged before redirect, the affiliate tag is appended correctly to the destination URL, and the analytics dashboard increments
- [ ] **Catalog approval workflow:** Admin approves a catalog item — verify it becomes searchable by buyers, appears in relevant filters, and the contributor receives an approval notification
- [ ] **cPanel deployment:** App runs locally — verify it runs on cPanel with the same environment variables, the restart mechanism works, and the health endpoint returns 200 after deployment

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-sell from cart race condition | HIGH | Manual investigation of each duplicate order; refund one buyer; implement correct atomic reservation; contact affected sellers; audit all past reservations for same pattern |
| Duplicate PIX webhook processed | MEDIUM | Identify all orders with duplicate payment events via audit log; reverse duplicate commissions; send corrected emails to affected buyers; add idempotency guard |
| Commission not snapshotted (calculated from current plan) | HIGH | Audit all historical orders to determine which were affected by plan changes; manual calculation of correct amounts; potential seller payouts adjustment; schema migration to add snapshot columns |
| cPanel process crash with no restart | LOW | Touch `tmp/restart.txt` via cPanel file manager; implement health monitoring alert immediately; document restart procedure |
| Collection limit bypassed via race condition | LOW-MEDIUM | Run query to identify users over their plan limit; send notification explaining the situation; block further additions until within limit; do not delete existing items |
| Affiliate clicks double-counted (no deduplication) | MEDIUM | Export raw click logs; apply deduplication algorithm retrospectively; recalibrate analytics baseline; implement deduplication going forward |
| PIX payment arrived after cart reservation expired | MEDIUM | Implement a reconciliation queue for orphaned payments; issue PIX refund automatically; notify buyer with explanation; log for admin review |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cart race condition (double-sell) | Cart & Marketplace phase | Integration test: fire 10 concurrent add-to-cart requests for the same item; only 1 should succeed |
| PIX webhook without idempotency | Payments phase | Integration test: send same webhook event ID twice; verify only 1 order state change occurs |
| PIX expiry vs. cart expiry mismatch | Payments phase | Scenario test: add to cart, wait until 23h remaining, generate PIX — verify PIX expiry < cart expiry |
| Commission not snapshotted | Marketplace + Payments phase | Schema review: verify `commission_rate_snapshot` column exists and is NOT NULL before any order code is written |
| cPanel deployment instability | Foundation phase (Phase 1) | Smoke test: deploy hello-world API to cPanel; verify env vars, health endpoint, and restart mechanism before writing app code |
| Collection limit race condition | Collection management phase | Integration test: fire 2 concurrent add-to-collection requests for user at their limit; only 1 should succeed |
| Affiliate tracking data corruption | Affiliate deals phase | Integration test: send same click twice within 1 hour; verify only 1 click recorded; verify tag is correctly appended to redirect URL |
| Subscription downgrade not applied | Subscription phase | End-to-end test: cancel subscription in Stripe test mode; trigger webhook; verify user plan in DB returns to FREE |

---

## Sources

- PRD v3.0 (docs/PRD.md) — Business rules RN01–RN19, feature specs §4.1–§4.24
- PROJECT.md (.planning/PROJECT.md) — Technical constraints (cPanel, MySQL, Node.js, Next.js, monorepo)
- Domain knowledge: Unique-item marketplace patterns (Etsy, Discogs, Depop architecture discussions)
- PIX ecosystem: Banco Central do Brasil PIX specification, Gerencianet/EFI and Pagar.me developer documentation patterns
- cPanel Node.js: Phusion Passenger + cPanel application hosting known behaviors
- Affiliate tracking: Amazon Associates, Mercado Livre affiliate program known integration patterns
- Stripe subscription lifecycle: Stripe official webhook event ordering documentation

---
*Pitfalls research for: Comics Trunk — unique-item collector marketplace, Brazil*
*Researched: 2026-02-21*
