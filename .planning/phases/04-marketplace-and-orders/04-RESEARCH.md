# Phase 4: Marketplace and Orders - Research

**Researched:** 2026-02-23
**Domain:** E-commerce cart/order system with atomic reservations, commission snapshots, and multi-seller order splitting
**Confidence:** HIGH

## Summary

Phase 4 transforms Comics Trunk from a collection management tool into a peer-to-peer marketplace. The core challenge is building a race-condition-free cart reservation system where unique physical items (comic books) can only be in one cart at a time, with 24-hour expiry and automatic release. On top of that, orders must permanently snapshot prices, commission rates, and seller-net amounts at creation time -- these values are immutable audit records, not recalculated fields.

The implementation sits entirely within the existing stack (Express + Prisma + MySQL on the API side, Next.js + shadcn/ui on the frontend). No new external services are required. The two genuinely new concerns are: (1) scheduled background tasks via `node-cron` for reservation expiry and abandoned cart cleanup, and (2) atomic conditional updates via Prisma's `$executeRaw` or `updateMany` to prevent double-sell race conditions on unique items.

**Primary recommendation:** Use Prisma `updateMany` with compound `where` (id + isForSale + no active cart) returning `{ count }` to atomically reserve items. Use `node-cron` 4.x (rewritten in TypeScript) for scheduled cleanup. Implement order status as a pure TypeScript state machine (allowed transitions map) without external libraries.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CART-01 | Adding a copy to cart reserves it for 24 hours | Cart API with `reservedAt` + `expiresAt` fields on CartItem; `expiresAt = now + 24h`; cart query filters `expiresAt > now` |
| CART-02 | Maximum 50 items per cart | Zod validation + service-level count check before insert |
| CART-03 | Cart persists across sessions | CartItem stored in DB linked to userId; survives logout/refresh |
| CART-04 | Expired reservations are automatically released | `node-cron` job runs every 5 minutes deleting CartItems where `expiresAt < now` |
| CART-05 | Abandoned carts cleaned up after 7 days | Same cron or separate pass: delete CartItems where `createdAt < now - 7d` regardless of expiry |
| CART-06 | User cannot buy their own copy | Service checks `collectionItem.userId !== req.user.userId` before adding to cart |
| CART-07 | Each copy can only be in one cart at a time | Atomic reservation: check no unexpired CartItem exists for this collectionItemId before inserting (transaction or updateMany pattern) |
| CART-08 | Cart reservation uses atomic UPDATE | Prisma `$transaction` with existence check, or `$executeRaw` UPDATE with WHERE condition returning affected rows === 1 |
| ORDR-01 | Unique order identifier (ORD-YYYYMMDD-XXXXXX) | Generated in service layer: date prefix + 6-char random alphanumeric; stored in `orderNumber` unique column |
| ORDR-02 | Prices snapshot at order creation (immutable) | `priceSnapshot`, `commissionRateSnapshot`, `commissionAmountSnapshot`, `sellerNetSnapshot` are NOT NULL Decimal columns on OrderItem |
| ORDR-03 | Order can contain items from multiple sellers | Single Order row, multiple OrderItem rows each with their own `sellerId`; UI groups by seller |
| ORDR-04 | Each item has individual shipping tracking | `trackingCode` and `carrier` fields on OrderItem (not Order) |
| ORDR-05 | Order status flow: Pending->Paid->Processing->Shipped->Delivered->Completed | `OrderStatus` and `OrderItemStatus` enums already in schema; state machine in service layer enforces valid transitions |
| ORDR-06 | Orders can be cancelled or disputed at any stage | CANCELLED status in enum; cancellation endpoint validates allowed transitions (not after DELIVERED) |
| ORDR-07 | Items not shipped within 7 days are automatically cancelled | `node-cron` job checks OrderItems with status PROCESSING and `createdAt < now - 7d` with no `shippedAt` |
| ORDR-08 | PIX payment expires in 24h | Order created with PENDING status; actual PIX QR generation is Phase 5; Phase 4 stores the order with 24h payment window concept |
| SHIP-01 | User can register multiple delivery addresses with one as default | ShippingAddress model with `isDefault` boolean; ensure only one default per user (unset others in transaction) |
| SHIP-02 | Address fields: street, number, complement, neighborhood, city, state, ZIP | All fields exist in ShippingAddress model; CEP validated as 8-digit Brazilian postal code |
| SHIP-03 | Shipping methods configurable by admin | ShippingMethod model with name, description, isActive; admin CRUD endpoint |
| SHIP-04 | Seller updates tracking code and carrier for each item | PATCH endpoint on OrderItem setting `trackingCode`, `carrier`, `shippedAt`; validates seller owns item |
| SHIP-05 | Buyer notified of shipping updates | Placeholder: Phase 7 notification system; Phase 4 records the event; notification integration deferred |
| COMM-01 | Commission is a percentage of sale price, paid by seller | `commissionRateSnapshot` on OrderItem; commission = price * rate |
| COMM-02 | Commission rate varies by seller plan: FREE 10%, BASIC 8% | CommissionConfig model queried by seller's current PlanType at order creation |
| COMM-03 | Rates are configurable by admin (with optional min/max values) | Admin CRUD for CommissionConfig with `rate`, `minRate`, `maxRate` fields |
| COMM-04 | Real-time net amount preview when setting price | API endpoint: given price + seller plan, return { commission, sellerNet }; frontend calls on price change |
| COMM-05 | Commission rate and net amount snapshot at order creation | Captured in OrderItem NOT NULL columns at create time; never recalculated |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.22.0 (pinned) | ORM for cart, order, address, commission models | Already in use; all 40 models defined upfront in schema |
| Express | 4.21.x | API routes for cart, orders, shipping, commission | Already in use; module-based structure under `src/modules/` |
| node-cron | 4.x | Scheduled tasks: cart expiry, abandoned cleanup, unshipped cancellation | TypeScript-native rewrite; zero dependencies; cron syntax |
| Zod | 3.23.x | Request validation schemas for all new endpoints | Already in contracts package; consistent with all prior phases |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @comicstrunk/contracts | workspace:* | Shared Zod schemas + types for cart, order, address, commission | All new API input/output types |
| next-intl | 4.x | PT-BR translations for marketplace, cart, checkout, order pages | All new frontend pages |
| shadcn/ui | (installed) | UI components for marketplace, cart, checkout, order management | All new frontend features |
| react-hook-form | 7.x | Form handling for address, listing, checkout | All form-heavy pages |
| lucide-react | 0.575.x | Icons for cart, orders, shipping status | All new UI components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | Bull/BullMQ + Redis | Bull provides job persistence and retry, but requires Redis -- overkill for 3 simple periodic tasks on this scale |
| node-cron | node-schedule | node-schedule supports date-based scheduling but is less maintained; node-cron 4.x is TypeScript-native |
| Pure TS state machine | XState | XState is powerful but heavy for simple status enum transitions; plain TypeScript map is sufficient and keeps bundle small |
| Prisma updateMany | Raw SQL $executeRaw | updateMany returns `{ count }` and is type-safe; raw SQL only needed if compound WHERE is insufficient |

### Installation

```bash
# API - add node-cron for scheduled tasks
pnpm --filter api add node-cron
pnpm --filter api add -D @types/node-cron
```

No new web dependencies required -- all needed packages are already installed.

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/modules/
├── cart/                  # Cart API (04-01)
│   ├── cart.routes.ts
│   └── cart.service.ts
├── orders/                # Order API (04-02)
│   ├── orders.routes.ts
│   └── orders.service.ts
├── shipping/              # Shipping & address API (04-03)
│   ├── shipping.routes.ts
│   └── shipping.service.ts
├── commission/            # Commission API (04-04)
│   ├── commission.routes.ts
│   └── commission.service.ts
└── ...

apps/api/src/shared/
├── cron/                  # NEW: Scheduled task definitions
│   └── index.ts           # Registers all cron jobs
├── lib/
│   └── order-number.ts    # Order number generation utility
└── ...

apps/web/src/
├── lib/api/
│   ├── cart.ts            # Cart API client
│   ├── orders.ts          # Orders API client
│   ├── shipping.ts        # Address/shipping API client
│   ├── commission.ts      # Commission API client
│   └── marketplace.ts     # Marketplace listing API client
├── components/features/
│   ├── marketplace/       # Marketplace listing, search, seller profile
│   ├── cart/              # Cart sidebar, countdown, checkout
│   └── orders/            # Order history, detail, seller dashboard
└── app/[locale]/
    ├── (public)/marketplace/           # 04-05: Public marketplace browse
    │   ├── page.tsx                    # Listing page
    │   └── [id]/page.tsx              # Listing detail
    ├── (public)/seller/[id]/page.tsx   # 04-05: Seller public profile
    ├── (collector)/checkout/page.tsx   # 04-06: Checkout page
    ├── (orders)/orders/                # 04-07: Buyer order management
    │   ├── page.tsx                    # Order history
    │   └── [id]/page.tsx              # Order detail
    └── (seller)/seller/                # 04-07: Seller dashboard
        ├── orders/page.tsx             # Seller orders list
        └── orders/[id]/page.tsx        # Seller order detail with tracking form
```

### Pattern 1: Atomic Cart Reservation (Preventing Double-Sell)

**What:** Ensure only one buyer can reserve a given collection item at any time, even under concurrent requests.
**When to use:** Every `addToCart` operation.

**Approach A: Prisma $transaction with existence check (simpler, recommended)**
```typescript
// Source: Project pattern (Prisma transactions already used in collection.service.ts)
async function addToCart(userId: string, collectionItemId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify item exists, is for sale, and is not the user's own
    const item = await tx.collectionItem.findUnique({
      where: { id: collectionItemId },
    });
    if (!item) throw new NotFoundError('Item not found');
    if (!item.isForSale) throw new BadRequestError('Item is not for sale');
    if (item.userId === userId) throw new BadRequestError('Cannot buy your own item');

    // 2. Check no active (unexpired) reservation exists
    const existingReservation = await tx.cartItem.findFirst({
      where: {
        collectionItemId,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingReservation) {
      throw new ConflictError('This item is already reserved by another buyer');
    }

    // 3. Check cart limit
    const cartCount = await tx.cartItem.count({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (cartCount >= 50) {
      throw new BadRequestError('Cart limit reached (maximum 50 items)');
    }

    // 4. Create reservation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tx.cartItem.create({
      data: {
        userId,
        collectionItemId,
        reservedAt: new Date(),
        expiresAt,
      },
    });
  });
}
```

**Approach B: Raw SQL for true atomic UPDATE (maximum safety)**
```typescript
// Source: Prisma docs on $executeRaw (https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)
// Use when you need guaranteed single-statement atomicity
const affectedRows = await prisma.$executeRaw`
  INSERT INTO cart_items (id, user_id, collection_item_id, reserved_at, expires_at, created_at)
  SELECT ${cuid()}, ${userId}, ${collectionItemId}, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW()
  FROM collection_items ci
  WHERE ci.id = ${collectionItemId}
    AND ci.is_for_sale = true
    AND ci.user_id != ${userId}
    AND NOT EXISTS (
      SELECT 1 FROM cart_items ca
      WHERE ca.collection_item_id = ${collectionItemId}
        AND ca.expires_at > NOW()
    )
`;
if (affectedRows === 0) {
  throw new ConflictError('Item is not available for reservation');
}
```

**Recommendation:** Use Approach A (Prisma $transaction) for consistency with existing codebase patterns. The interactive transaction with serializable isolation is sufficient for the expected traffic volume. Approach B is available as an escalation if concurrency issues are observed.

### Pattern 2: Order Number Generation

**What:** Generate unique, human-readable order identifiers in the format `ORD-YYYYMMDD-XXXXXX`.
**When to use:** Order creation.

```typescript
// Source: Custom implementation following ORDR-01 spec
import { randomBytes } from 'crypto';

export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
  return `ORD-${dateStr}-${random}`;
}
// Example: ORD-20260223-A1B2C3
```

**Collision handling:** The `orderNumber` column has a unique constraint. On the rare collision, catch the Prisma unique constraint error and retry with a new random suffix (max 3 retries).

### Pattern 3: Order Status State Machine

**What:** Enforce valid status transitions for both Order and OrderItem.
**When to use:** Every status change operation.

```typescript
// Source: Standard TypeScript state machine pattern
const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['PAID', 'CANCELLED'],
  PAID:       ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED', 'DISPUTED'],
  DELIVERED:  ['COMPLETED', 'DISPUTED'],
  COMPLETED:  [],
  CANCELLED:  [],
  DISPUTED:   ['COMPLETED', 'CANCELLED'], // After dispute resolution
};

const ORDER_ITEM_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['PAID', 'CANCELLED'],
  PAID:       ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED', 'DISPUTED'],
  DELIVERED:  ['COMPLETED', 'DISPUTED'],
  COMPLETED:  [],
  CANCELLED:  [],
  DISPUTED:   ['COMPLETED', 'CANCELLED', 'REFUNDED'],
  REFUNDED:   [],
};

function assertTransition(current: string, next: string, transitions: Record<string, string[]>) {
  const allowed = transitions[current];
  if (!allowed || !allowed.includes(next)) {
    throw new BadRequestError(
      `Invalid status transition: ${current} -> ${next}`
    );
  }
}
```

### Pattern 4: Price/Commission Snapshot at Order Creation

**What:** Capture immutable financial data when an order is created.
**When to use:** Order creation from cart items.

```typescript
// Source: Project requirement ORDR-02, COMM-05
async function createOrder(buyerId: string, shippingAddressId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Get active cart items
    const cartItems = await tx.cartItem.findMany({
      where: { userId: buyerId, expiresAt: { gt: new Date() } },
      include: {
        collectionItem: {
          include: { user: { select: { id: true } } },
        },
      },
    });

    if (cartItems.length === 0) throw new BadRequestError('Cart is empty');

    // 2. Snapshot shipping address
    const address = await tx.shippingAddress.findUnique({
      where: { id: shippingAddressId },
    });
    if (!address || address.userId !== buyerId) {
      throw new NotFoundError('Shipping address not found');
    }

    // 3. Generate order number
    const orderNumber = generateOrderNumber();

    // 4. Calculate totals with commission snapshots
    let totalAmount = 0;
    const itemSnapshots = [];

    for (const ci of cartItems) {
      const item = ci.collectionItem;
      const price = Number(item.salePrice);

      // Look up commission rate for seller's plan
      const sellerSubscription = await tx.subscription.findFirst({
        where: { userId: item.userId, status: 'ACTIVE' },
      });
      const planType = sellerSubscription?.planType ?? 'FREE';
      const commConfig = await tx.commissionConfig.findFirst({
        where: { planType, isActive: true },
      });
      const commRate = commConfig ? Number(commConfig.rate) : 0.10; // Default 10%

      const commAmount = Math.round(price * commRate * 100) / 100;
      const sellerNet = Math.round((price - commAmount) * 100) / 100;
      totalAmount += price;

      itemSnapshots.push({
        collectionItemId: item.id,
        sellerId: item.userId,
        priceSnapshot: price,
        commissionRateSnapshot: commRate,
        commissionAmountSnapshot: commAmount,
        sellerNetSnapshot: sellerNet,
      });
    }

    // 5. Create order + items
    const order = await tx.order.create({
      data: {
        orderNumber,
        buyerId,
        totalAmount,
        shippingAddressSnapshot: JSON.parse(JSON.stringify(address)),
        orderItems: {
          create: itemSnapshots,
        },
      },
      include: { orderItems: true },
    });

    // 6. Clear cart items + mark collection items as no longer for sale
    await tx.cartItem.deleteMany({
      where: { userId: buyerId },
    });

    return order;
  });
}
```

### Pattern 5: Cron Job Registration

**What:** Register scheduled tasks that run in the background.
**When to use:** API server startup.

```typescript
// Source: node-cron 4.x TypeScript API (https://www.npmjs.com/package/node-cron)
// apps/api/src/shared/cron/index.ts
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

export function registerCronJobs() {
  // Release expired cart reservations - every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    const result = await prisma.cartItem.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`[CRON] Released ${result.count} expired cart reservations`);
    }
  });

  // Clean up abandoned carts - daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.cartItem.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
    if (result.count > 0) {
      console.log(`[CRON] Cleaned up ${result.count} abandoned cart items`);
    }
  });

  // Auto-cancel unshipped items after 7 days - daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.orderItem.updateMany({
      where: {
        status: 'PROCESSING',
        shippedAt: null,
        createdAt: { lt: sevenDaysAgo },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    if (result.count > 0) {
      console.log(`[CRON] Auto-cancelled ${result.count} unshipped order items`);
    }
  });

  console.log('[CRON] All scheduled jobs registered');
}
```

Call `registerCronJobs()` from `create-app.ts` after route registration.

### Anti-Patterns to Avoid

- **Recalculating commission on read:** Commission amounts MUST be read from the snapshot columns, never recalculated from current rates. Rates change over time; orders are historical records.
- **Using localStorage for cart:** Cart must be server-side (DB-backed) to enforce the single-reservation constraint. A client-side cart would break CART-07.
- **Polling for cart expiry on frontend only:** The server is the source of truth. Frontend countdown is cosmetic; the cron job handles actual expiry. If a user's countdown shows time remaining but the server already expired it, the next API call should detect this gracefully.
- **Deleting collection items on order creation:** When an order is created, the collection item should NOT be deleted or modified. It stays in the seller's collection with `isForSale = true` until the order is completed. Only after COMPLETED should `isForSale` be set to false.
- **Nested route collisions:** Place static routes (`/stats`, `/export`) before parameterized routes (`/:id`) in Express routers -- established pattern in this codebase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled tasks | Custom setInterval or setTimeout | node-cron 4.x | Cron syntax is standard, handles timezone, prevents overlap with `noOverlap` option |
| CUID generation | Custom ID generator | @prisma/client `cuid()` or Prisma `@default(cuid())` | Already the standard PK strategy throughout the codebase |
| Currency rounding | `Math.round(x * 100) / 100` everywhere | Centralized `roundCurrency(amount: number)` utility | Consistent rounding; Decimal columns store exact values but JS math needs rounding |
| CEP validation | Custom regex | Simple `z.string().regex(/^\d{5}-?\d{3}$/)` in Zod | 8-digit Brazilian postal code; no external library needed for validation alone |
| Order number uniqueness | Application-level dedup | Database unique constraint + retry on collision | MySQL unique constraint is the canonical authority |

**Key insight:** The existing codebase patterns (Prisma transactions, Zod validation in contracts, module-based API structure, Axios service layer in frontend) are well-established through 3 phases. Phase 4 introduces exactly two new infrastructure pieces: node-cron for background tasks and the order number generator. Everything else follows existing patterns.

## Common Pitfalls

### Pitfall 1: Race Condition on Cart Reservation (Double-Sell)

**What goes wrong:** Two buyers try to reserve the same item simultaneously; both read "no reservation exists" and both insert a CartItem.
**Why it happens:** Without atomic check-and-insert, there's a time-of-check-to-time-of-use (TOCTOU) gap between the findFirst and create calls.
**How to avoid:** Use Prisma `$transaction` with interactive mode (sequential reads + writes in a single transaction). MySQL's default InnoDB isolation level (REPEATABLE READ) combined with the transaction ensures the second insert will see the first one's uncommitted write and block or fail. Alternatively, add a unique constraint on `collectionItemId` in the CartItem model (requires migration) -- but then expired items must be cleaned before new reservations can be made.
**Warning signs:** Duplicate CartItem rows for the same collectionItemId in the database; buyer sees "reserved by you" but another buyer also sees the same.

### Pitfall 2: Stale Cart Data on Frontend

**What goes wrong:** User sees items in their cart that have already expired server-side; they proceed to checkout and get an error.
**Why it happens:** Frontend caches cart state; the 24-hour countdown is cosmetic and may drift from server time.
**How to avoid:** Always re-validate cart items at checkout time. The `createOrder` service must re-check that all cart items are still valid (not expired, item still for sale). Show clear error messages for items that became unavailable. Frontend should refresh cart data on page focus/visibility change.
**Warning signs:** Checkout failures with vague errors; users complaining about "ghost items" in cart.

### Pitfall 3: Commission Rate Mismatch Between Preview and Snapshot

**What goes wrong:** Seller sees "You'll receive R$ 45.00" when listing, but the order snapshots a different commission rate because the seller's plan changed between listing and purchase.
**Why it happens:** The preview uses current plan; the snapshot captures the rate at order creation time.
**How to avoid:** This is by design -- COMM-05 explicitly says "snapshot at order creation." The preview (COMM-04) should include a disclaimer that the rate is based on the current plan and may change. The snapshot is the source of truth.
**Warning signs:** Seller complaints about receiving less than expected. Clear UI messaging prevents this.

### Pitfall 4: Decimal Precision Loss

**What goes wrong:** Commission calculations produce values like `4.500000000000001` due to JavaScript floating-point arithmetic.
**Why it happens:** JavaScript `Number` type uses IEEE 754 double-precision; multiplying `45.00 * 0.10` can produce imprecise results.
**How to avoid:** Round all currency calculations to 2 decimal places using `Math.round(value * 100) / 100` before storing. Prisma Decimal columns (`Decimal(10, 2)`) store exact values, but the rounding must happen before the Prisma call since the input is a JS number. Consider a `roundCurrency()` utility function.
**Warning signs:** Prices displayed with more than 2 decimal places; commission + sellerNet not equaling price exactly.

### Pitfall 5: Order Status Transitions Bypassing the State Machine

**What goes wrong:** An order item in SHIPPED status is directly set to CANCELLED, skipping dispute/mediation flow.
**Why it happens:** Direct Prisma update without checking the state machine transition map.
**How to avoid:** All status changes must go through the `assertTransition()` function. Never call `prisma.orderItem.update({ data: { status } })` directly from a route handler -- always go through the service layer which enforces transitions.
**Warning signs:** Invalid status combinations in the database (e.g., CANCELLED with a non-null `deliveredAt`).

### Pitfall 6: Self-Purchase Getting Through

**What goes wrong:** A seller manages to buy their own listed item.
**Why it happens:** Check missing in addToCart or bypassed by direct API call.
**How to avoid:** Enforce `collectionItem.userId !== buyerUserId` in both the addToCart service AND the createOrder service (defense in depth). The cart check catches it early; the order check is the safety net.
**Warning signs:** OrderItems where sellerId === order.buyerId.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Brazilian Address Zod Schema (CEP Validation)

```typescript
// Source: Brazilian postal code format (8 digits, optional hyphen)
export const createShippingAddressSchema = z.object({
  label: z.string().max(50).trim().optional(),
  street: z.string().min(1).max(200).trim(),
  number: z.string().min(1).max(20).trim(),
  complement: z.string().max(100).trim().optional(),
  neighborhood: z.string().min(1).max(100).trim(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().length(2).trim().toUpperCase(),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'Invalid CEP format (expected XXXXX-XXX or XXXXXXXX)'),
  isDefault: z.boolean().default(false),
});
```

### Cart Item with Countdown (Frontend)

```typescript
// Custom hook for reservation countdown
function useCartCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setRemaining(diff);
    };

    tick(); // Initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  const isExpired = remaining === 0;

  return { hours, minutes, seconds, isExpired, remaining };
}
```

### Commission Calculation Utility

```typescript
// Source: COMM-01, COMM-02, COMM-04
export function calculateCommission(
  salePrice: number,
  commissionRate: number,
): { commission: number; sellerNet: number } {
  const commission = Math.round(salePrice * commissionRate * 100) / 100;
  const sellerNet = Math.round((salePrice - commission) * 100) / 100;
  return { commission, sellerNet };
}
```

### Default Address Enforcement (Only One Default)

```typescript
// Source: SHIP-01 requirement -- ensure single default per user
async function setDefaultAddress(tx: Prisma.TransactionClient, userId: string, addressId: string) {
  // Unset all current defaults
  await tx.shippingAddress.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
  // Set the new default
  await tx.shippingAddress.update({
    where: { id: addressId },
    data: { isDefault: true },
  });
}
```

### Marketplace Listing Query (Public Search with Filters)

```typescript
// Source: CATL-07 pattern adapted for marketplace (items for sale)
async function searchMarketplace(filters: MarketplaceSearchInput) {
  const where: Prisma.CollectionItemWhereInput = {
    isForSale: true,
    salePrice: { not: null },
    // Filter out items with active orders (PENDING/PAID/PROCESSING)
    orderItems: {
      none: {
        status: { in: ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED'] },
      },
    },
    // Apply user filters
    ...(filters.condition && { condition: filters.condition }),
    ...(filters.minPrice && { salePrice: { gte: filters.minPrice } }),
    ...(filters.maxPrice && { salePrice: { lte: filters.maxPrice } }),
    catalogEntry: {
      approvalStatus: 'APPROVED',
      ...(filters.publisher && { publisher: { contains: filters.publisher } }),
      ...(filters.characterId && {
        characters: { some: { characterId: filters.characterId } },
      }),
    },
  };

  // ... pagination, sorting, return
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron v3 (CommonJS) | node-cron v4 (TypeScript-native) | 2024 | Import with `import cron from 'node-cron'`; options API simplified; `scheduled` option removed (tasks start immediately) |
| XState for simple state machines | Plain TypeScript transition maps | Ongoing trend | XState is powerful but 30KB+ for simple enum transitions; TS records are zero-dependency |
| Client-side cart (localStorage) | Server-side cart with DB persistence | Industry standard for unique-item marketplaces | Physical items need exclusive reservation; client-side cannot enforce exclusivity |
| Floating-point prices in JS | Decimal columns in DB + JS rounding | Prisma convention | Store exact values; round at calculation boundary |

**Deprecated/outdated:**
- node-cron v3: `scheduled: false` option removed in v4; tasks start on creation by default
- Prisma `$executeRawUnsafe`: Still works but prefer tagged template `$executeRaw` (prevents SQL injection via parameterized queries)

## Open Questions

1. **Should CartItem get a unique constraint on collectionItemId?**
   - What we know: The current schema has only an index, not a unique constraint. The transaction-based approach handles exclusivity at the application level.
   - What's unclear: Whether a DB-level unique constraint would be better for data integrity. The complication is that expired cart items would need to be deleted before a new reservation could be made (the unique constraint doesn't account for time-based validity).
   - Recommendation: Keep the application-level check in the $transaction. It's more flexible (handles expiry cleanly) and consistent with the existing codebase patterns. The cron job cleans up expired items regularly.

2. **How should "mark as sold" work after order completion?**
   - What we know: When an order reaches COMPLETED status, the collection item should no longer be for sale.
   - What's unclear: Should the item be deleted from the seller's collection, or just have `isForSale` set to false? The item is now owned by the buyer.
   - Recommendation: Set `isForSale = false` and `salePrice = null` on COMPLETED. Do NOT delete from seller's collection (it's a historical record). The buyer can independently add the same catalog entry to their own collection.

3. **How to handle the ORDR-08 (PIX 24h expiry) boundary with Phase 5?**
   - What we know: Phase 4 creates orders in PENDING status. Phase 5 generates the actual PIX QR code and manages payment.
   - What's unclear: Should Phase 4 create a 24-hour payment deadline concept, or leave that entirely to Phase 5?
   - Recommendation: Phase 4 stores the order with PENDING status and a `createdAt` timestamp. Phase 5 will use `createdAt + 24h` as the payment deadline. No extra column needed in Phase 4.

4. **Seller-Net display: before or after order creation?**
   - What we know: COMM-04 requires real-time preview when setting price. The preview and the snapshot may differ if the plan changes.
   - What's unclear: Whether the existing `markForSale` endpoint in collection.service.ts (which already calculates commission at 10%) needs refactoring.
   - Recommendation: Replace the hardcoded `COMMISSION_RATE = 0.1` in collection.service.ts with a call to the new commission service that reads from CommissionConfig. This is a cross-cutting concern that connects Phase 3 code with Phase 4 infrastructure.

## Sources

### Primary (HIGH confidence)
- Prisma schema at `apps/api/prisma/schema.prisma` -- all models for Cart, Order, OrderItem, ShippingAddress, ShippingMethod, CommissionConfig already defined
- Existing codebase patterns (collection.service.ts, collection.routes.ts) -- verified transaction, validation, and response patterns
- [Prisma Raw Queries Documentation](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) -- $executeRaw returns affected row count
- [Prisma CRUD Reference](https://www.prisma.io/docs/orm/prisma-client/queries/crud) -- updateMany returns BatchPayload with count
- [Prisma Transactions Reference](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) -- interactive transactions for sequential operations

### Secondary (MEDIUM confidence)
- [node-cron npm package](https://www.npmjs.com/package/node-cron) -- v4.2.1, TypeScript rewrite, zero dependencies
- [node-cron v3 to v4 migration guide](https://nodecron.com/migrating-from-v3) -- breaking changes in options API
- [ViaCEP API](https://publicapi.dev/via-cep-api) -- Brazilian CEP lookup (not needed for Phase 4 validation, but useful if address autocomplete is added later)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new external services; node-cron is the only new dependency; all patterns follow existing codebase conventions
- Architecture: HIGH -- module structure, route patterns, service patterns, contract schemas all follow 3 phases of established precedent
- Pitfalls: HIGH -- race conditions on unique items, decimal precision, state machine enforcement are well-documented e-commerce concerns with known solutions
- Database: HIGH -- all models already defined in schema; no migrations needed for core functionality (unique constraint on CartItem is optional)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- stable domain, no fast-moving dependencies)
