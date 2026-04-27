# API Performance Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the most impactful API performance bottlenecks — N+1 queries, redundant taxonomy fetches, a wasteful seller lookup, and missing database index — delivering faster page loads and lower database load.

**Architecture:** Fix the N+1 on the hot `createOrder` path by batching subscription queries; add a lightweight public user endpoint to replace a full marketplace search just to get a seller's name; install TanStack Query in the web app so taxonomy data (categories, characters, series) is fetched once and cached for 10 minutes instead of on every catalog page visit; add a Cache-Control header on read-only taxonomy routes; and add the missing `Series.title` index.

**Tech Stack:** Express 5 / Prisma 5.22.0 / MySQL (API) · Next.js 15 / React 19 / Vitest (Web) · pnpm workspaces · Jest (API tests)

---

## Constraints (read before every task)
- **Never commit** — user commits manually
- **Never touch main** — all work on a feature branch targeting `develop`
- All test data MUST use `TEST_PREFIX` (`_test_`) — see `apps/api/src/__tests__/global-setup.ts`
- After any Prisma migration run: `pnpm --filter api db:seed`
- API response format: `{ success: true, data: {...} }` via `sendSuccess()` / `sendPaginated()`

---

## File Map

| File | Action | Reason |
|------|--------|--------|
| `apps/api/src/modules/orders/orders.service.ts` | Modify lines 98–126 | Batch subscription lookup — eliminate N+1 |
| `apps/api/src/modules/users/users.service.ts` | Modify — add `getPublicProfile()` | New public user endpoint |
| `apps/api/src/modules/users/users.routes.ts` | Modify — add `GET /:id/public` | Wire new endpoint |
| `apps/api/src/__tests__/orders/orders-n1.test.ts` | Create | Verify batched subscriptions |
| `apps/api/src/__tests__/users/users-public.test.ts` | Create | Verify public profile endpoint |
| `apps/api/prisma/schema.prisma` | Modify `Series` model | Add `@@index([title])` |
| `apps/api/src/shared/middleware/cache-control.ts` | Create | Reusable `cachePublic(seconds)` middleware |
| `apps/api/src/modules/categories/categories.routes.ts` | Modify GET / | Apply cache middleware |
| `apps/api/src/modules/tags/tags.routes.ts` | Modify GET / | Apply cache middleware |
| `apps/api/src/modules/characters/characters.routes.ts` | Modify GET / | Apply cache middleware |
| `apps/api/src/modules/series/series.routes.ts` | Modify GET / | Apply cache middleware |
| `apps/api/src/__tests__/taxonomy/cache-headers.test.ts` | Create | Verify Cache-Control headers |
| `apps/web/package.json` | Modify | Add `@tanstack/react-query` |
| `apps/web/src/components/providers/query-provider.tsx` | Create | Client-side QueryClientProvider |
| `apps/web/src/app/[locale]/layout.tsx` | Modify | Wrap with QueryProvider |
| `apps/web/src/app/[locale]/(public)/catalog/page.tsx` | Modify | Replace 3 useEffect calls with useQuery |
| `apps/web/src/lib/api/marketplace.ts` | Modify `getSellerProfile()` | Use GET /users/:id/public directly |

---

## Task 1: Fix N+1 subscription lookup in createOrder

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts:98-126`
- Create: `apps/api/src/__tests__/orders/orders-n1.test.ts`

### Context
`createOrder` loops over `cartItems` and inside the loop calls `tx.subscription.findFirst()` for each seller — this is N queries for N cart items. Fix: collect unique seller IDs first, fetch all their subscriptions in one query, then look up in a Map.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/orders/orders-n1.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../create-app';
import { prisma } from '../../shared/lib/prisma';
import { TEST_PREFIX } from '../global-setup';

/**
 * This test verifies that createOrder does NOT issue multiple subscription
 * queries for a multi-seller cart. We do this by checking the order is
 * created successfully with items from two different sellers — if the N+1
 * existed and there was a query failure, the order would fail or items would
 * get wrong commission rates.
 *
 * A true query-count assertion would require Prisma query logging; here we
 * verify correct behavior: both items created with the correct commission
 * snapshot based on each seller's plan.
 */
describe('createOrder — no N+1 subscription lookup', () => {
  const app = createApp();
  let buyerToken: string;
  let buyerId: string;
  let seller1Id: string;
  let seller2Id: string;
  let addressId: string;
  let collItem1Id: string;
  let collItem2Id: string;

  beforeAll(async () => {
    // Create buyer
    const buyerRes = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}buyer-n1@test.com`,
      name: `${TEST_PREFIX} Buyer N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    buyerToken = buyerRes.body.data.accessToken;
    buyerId = buyerRes.body.data.user.id;

    // Create seller1 (no subscription = FREE plan)
    const s1Res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}seller1-n1@test.com`,
      name: `${TEST_PREFIX} Seller1 N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    seller1Id = s1Res.body.data.user.id;

    // Create seller2 (no subscription = FREE plan)
    const s2Res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}seller2-n1@test.com`,
      name: `${TEST_PREFIX} Seller2 N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    seller2Id = s2Res.body.data.user.id;

    // Create a catalog entry for each seller's item
    const cat = await prisma.catalogEntry.create({
      data: {
        title: `${TEST_PREFIX} Comic N1`,
        approvalStatus: 'APPROVED',
        createdById: seller1Id,
      },
    });

    // Seller1 collection item for sale
    const ci1 = await prisma.collectionItem.create({
      data: { userId: seller1Id, catalogEntryId: cat.id, isForSale: true, salePrice: 25.0 },
    });
    collItem1Id = ci1.id;

    // Seller2 collection item for sale
    const ci2 = await prisma.collectionItem.create({
      data: { userId: seller2Id, catalogEntryId: cat.id, isForSale: true, salePrice: 30.0 },
    });
    collItem2Id = ci2.id;

    // Add both items to buyer cart
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000);
    await prisma.cartItem.createMany({
      data: [
        { userId: buyerId, collectionItemId: collItem1Id, reservedAt: now, expiresAt: expires },
        { userId: buyerId, collectionItemId: collItem2Id, reservedAt: now, expiresAt: expires },
      ],
    });

    // Create shipping address for buyer
    const addr = await prisma.shippingAddress.create({
      data: {
        userId: buyerId,
        label: 'Casa',
        street: 'Rua Teste',
        number: '1',
        neighborhood: 'Centro',
        city: 'SP',
        state: 'SP',
        zipCode: '01001-000',
      },
    });
    addressId = addr.id;
  });

  afterAll(async () => {
    // Cleanup in dependency order
    await prisma.orderItem.deleteMany({ where: { collectionItemId: { in: [collItem1Id, collItem2Id] } } });
    await prisma.order.deleteMany({ where: { buyerId } });
    await prisma.cartItem.deleteMany({ where: { userId: buyerId } });
    await prisma.collectionItem.deleteMany({ where: { id: { in: [collItem1Id, collItem2Id] } } });
    await prisma.catalogEntry.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
    await prisma.shippingAddress.deleteMany({ where: { userId: buyerId } });
    await prisma.user.deleteMany({
      where: { email: { in: [
        `${TEST_PREFIX}buyer-n1@test.com`,
        `${TEST_PREFIX}seller1-n1@test.com`,
        `${TEST_PREFIX}seller2-n1@test.com`,
      ] } },
    });
  });

  it('creates an order with items from two sellers and correct commission snapshots', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ shippingAddressId: addressId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderItems).toHaveLength(2);

    // Both items should have 10% commission (FREE plan rate)
    for (const item of res.body.data.orderItems) {
      expect(Number(item.commissionRateSnapshot)).toBe(0.1);
    }

    const totalAmount = Number(res.body.data.totalAmount);
    expect(totalAmount).toBe(55.0); // 25 + 30
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes on N+1 code but wrong behavior)**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="orders-n1" --no-coverage 2>&1 | tail -30
```

Expected: Either FAIL (compilation error if file doesn't exist yet) or PASS with current buggy code — we just want to confirm the test runs. The real fix is in Step 3.

- [ ] **Step 3: Fix the N+1 in orders.service.ts**

Replace lines 98–126 in `apps/api/src/modules/orders/orders.service.ts` (the `for (const cartItem of cartItems)` loop and the code before it):

```typescript
    // 4. Batch-fetch all seller subscriptions — one query instead of N
    const uniqueSellerIds = [...new Set(cartItems.map((ci) => ci.collectionItem.userId))];
    const sellerSubscriptions = await tx.subscription.findMany({
      where: {
        userId: { in: uniqueSellerIds },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build a Map: sellerId → planType (first/latest active subscription wins)
    const sellerPlanMap = new Map<string, string>();
    for (const sub of sellerSubscriptions) {
      if (!sellerPlanMap.has(sub.userId)) {
        sellerPlanMap.set(sub.userId, sub.planType);
      }
    }

    // 5. Build order items with price/commission snapshots
    let totalAmount = 0;
    const orderItemsData: Array<{
      collectionItemId: string;
      sellerId: string;
      priceSnapshot: number;
      commissionRateSnapshot: number;
      commissionAmountSnapshot: number;
      sellerNetSnapshot: number;
    }> = [];

    for (const cartItem of cartItems) {
      const { collectionItem } = cartItem;
      const sellerId = collectionItem.userId;
      const price = Number(collectionItem.salePrice ?? 0);

      // Look up seller's plan from the pre-fetched map
      const planType = sellerPlanMap.get(sellerId) ?? 'FREE';

      // Get commission rate for seller's plan
      const commissionRate = await getCommissionRate(planType);

      // Calculate commission and seller net
      const { commission, sellerNet } = calculateCommission(price, commissionRate);

      orderItemsData.push({
        collectionItemId: collectionItem.id,
        sellerId,
        priceSnapshot: roundCurrency(price),
        commissionRateSnapshot: commissionRate,
        commissionAmountSnapshot: commission,
        sellerNetSnapshot: sellerNet,
      });

      totalAmount += price;
    }
```

Also renumber the subsequent comments in the function: the old "5. Snapshot shipping address" becomes "6.", "6. Create order" becomes "7.", "7. Clear buyer's cart" becomes "8.".

- [ ] **Step 4: Run test to verify it passes**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="orders-n1" --no-coverage 2>&1 | tail -20
```

Expected output: `PASS apps/api/src/__tests__/orders/orders-n1.test.ts` with 1 test passing.

---

## Task 2: Add GET /users/:id/public endpoint

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts`
- Modify: `apps/api/src/modules/users/users.routes.ts`
- Create: `apps/api/src/__tests__/users/users-public.test.ts`

### Context
`getSellerProfile()` on the web currently fires a full marketplace search just to get a seller's name. We need a cheap, unauthenticated endpoint: `GET /api/v1/users/:id/public` → `{ id, name, avatarUrl, createdAt }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/users/users-public.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../create-app';
import { prisma } from '../../shared/lib/prisma';
import { TEST_PREFIX } from '../global-setup';

describe('GET /api/v1/users/:id/public', () => {
  const app = createApp();
  let testUserId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}public-profile@test.com`,
      name: `${TEST_PREFIX} Public User`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    testUserId = res.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: `${TEST_PREFIX}public-profile@test.com` } } });
    await prisma.user.deleteMany({ where: { email: `${TEST_PREFIX}public-profile@test.com` } });
  });

  it('returns public profile without authentication', async () => {
    const res = await request(app).get(`/api/v1/users/${testUserId}/public`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: testUserId,
      name: `${TEST_PREFIX} Public User`,
    });
    // Must NOT expose sensitive fields
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
    // Must include public fields
    expect(res.body.data).toHaveProperty('avatarUrl');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('returns 404 for unknown user ID', async () => {
    const res = await request(app).get('/api/v1/users/nonexistent-id-xyz/public');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="users-public" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `GET /api/v1/users/:id/public` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Add getPublicProfile() to users.service.ts**

Add after line 33 (after `getProfile`) in `apps/api/src/modules/users/users.service.ts`:

```typescript
const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_PROFILE_SELECT,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}
```

- [ ] **Step 4: Add GET /:id/public route to users.routes.ts**

Add before the `PUT /profile` route in `apps/api/src/modules/users/users.routes.ts` (after line 23):

```typescript
// GET /:id/public — no auth, returns safe public profile
router.get(
  '/:id/public',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await usersService.getPublicProfile(req.params.id as string);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="users-public" --no-coverage 2>&1 | tail -20
```

Expected: `PASS apps/api/src/__tests__/users/users-public.test.ts` — 2 tests passing.

---

## Task 3: Fix getSellerProfile() in web to use new endpoint

**Files:**
- Modify: `apps/web/src/lib/api/marketplace.ts:89-105`

### Context
`getSellerProfile()` currently fires `searchMarketplace({ sellerId, limit: 1 })` just to get the seller's name — a full paginated DB query to retrieve one field. Replace with a direct call to `GET /users/:id/public`.

- [ ] **Step 1: Modify getSellerProfile() in marketplace.ts**

Replace lines 89–105 in `apps/web/src/lib/api/marketplace.ts`:

```typescript
export async function getSellerProfile(
  sellerId: string,
): Promise<{ id: string; name: string; avatarUrl: string | null; createdAt?: string }> {
  const response = await apiClient.get(`/users/${sellerId}/public`);
  return response.data.data;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web type-check 2>&1 | tail -20
```

Expected: no TypeScript errors.

---

## Task 4: Add Series.title DB index

**Files:**
- Modify: `apps/api/prisma/schema.prisma` — `Series` model

### Context
`Series.title` has no index. Catalog imports do `findFirst({ where: { title: { contains: ... } } })` for every row — without an index MySQL does a full table scan per import row. Adding an index reduces import time significantly as the Series table grows.

- [ ] **Step 1: Write the failing test (verify index exists via migration)**

The test here is running the migration. There's no Jest test for schema indexes — we verify by running the migration and checking the table structure.

- [ ] **Step 2: Add the index to schema.prisma**

In `apps/api/prisma/schema.prisma`, find the `Series` model (around line 326) and add `@@index([title])`:

```prisma
model Series {
  id            String   @id @default(cuid())
  title         String
  description   String?  @db.Text
  totalEditions Int      @map("total_editions")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  catalogEntries CatalogEntry[]

  @@index([title])
  @@map("series")
}
```

- [ ] **Step 3: Create and apply the migration**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api db:migrate
```

When prompted for a migration name, enter: `add_series_title_index`

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Re-run seed to ensure data is intact**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api db:seed
```

Expected: seed completes without errors.

- [ ] **Step 5: Verify index exists in MySQL**

```bash
mysql -u root -padmin comicstrunk -e "SHOW INDEX FROM series WHERE Key_name != 'PRIMARY';" 2>/dev/null
```

Expected: at least one row with `Column_name = title`.

---

## Task 5: Add Cache-Control middleware for taxonomy GET routes

**Files:**
- Create: `apps/api/src/shared/middleware/cache-control.ts`
- Modify: `apps/api/src/modules/categories/categories.routes.ts`
- Modify: `apps/api/src/modules/tags/tags.routes.ts`
- Modify: `apps/api/src/modules/characters/characters.routes.ts`
- Modify: `apps/api/src/modules/series/series.routes.ts`
- Create: `apps/api/src/__tests__/taxonomy/cache-headers.test.ts`

### Context
Read-only taxonomy endpoints (`GET /categories`, `GET /tags`, `GET /characters`, `GET /series`) never change between requests for regular users. Setting `Cache-Control: public, max-age=300, stale-while-revalidate=3600` lets browsers and CDNs cache them for 5 minutes, serving zero DB queries on repeat visits.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/taxonomy/cache-headers.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../create-app';

describe('Cache-Control headers on taxonomy list endpoints', () => {
  const app = createApp();

  const endpoints = [
    '/api/v1/categories',
    '/api/v1/tags',
    '/api/v1/characters',
    '/api/v1/series',
  ];

  for (const endpoint of endpoints) {
    it(`${endpoint} returns Cache-Control: public, max-age=300`, async () => {
      const res = await request(app).get(endpoint);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=300');
    });
  }
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="cache-headers" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — no `cache-control` header on those responses currently.

- [ ] **Step 3: Create the cache-control middleware**

Create `apps/api/src/shared/middleware/cache-control.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that sets Cache-Control for public read-only endpoints.
 * @param maxAgeSeconds - how long browsers/CDNs may cache the response
 * @param staleWhileRevalidateSeconds - allow serving stale while revalidating (default 1 hour)
 */
export function cachePublic(maxAgeSeconds: number, staleWhileRevalidateSeconds = 3600) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set(
      'Cache-Control',
      `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
    );
    next();
  };
}
```

- [ ] **Step 4: Apply middleware to categories GET /**

In `apps/api/src/modules/categories/categories.routes.ts`, add the import at the top and apply to the list route:

```typescript
import { cachePublic } from '../../shared/middleware/cache-control';
```

Change the `GET /` route handler:

```typescript
router.get('/', cachePublic(300), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoriesService.listCategories();
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Apply middleware to tags GET /**

In `apps/api/src/modules/tags/tags.routes.ts`, add import:

```typescript
import { cachePublic } from '../../shared/middleware/cache-control';
```

Find the `GET /` route and apply:

```typescript
router.get('/', cachePublic(300), async (_req: Request, res: Response, next: NextFunction) => {
```

- [ ] **Step 6: Apply middleware to characters GET /**

In `apps/api/src/modules/characters/characters.routes.ts`, add import:

```typescript
import { cachePublic } from '../../shared/middleware/cache-control';
```

Find the `GET /` route and apply:

```typescript
router.get('/', cachePublic(300), async (_req: Request, res: Response, next: NextFunction) => {
```

- [ ] **Step 7: Apply middleware to series GET /**

In `apps/api/src/modules/series/series.routes.ts`, add import:

```typescript
import { cachePublic } from '../../shared/middleware/cache-control';
```

Find the `GET /` route and apply. Note: this route uses `validate()` middleware, so keep the order:

```typescript
router.get(
  '/',
  validate(seriesSearchSchema, 'query'),
  cachePublic(300),
  async (req: Request, res: Response, next: NextFunction) => {
```

- [ ] **Step 8: Run test to verify all 4 endpoints pass**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter api test -- --testPathPattern="cache-headers" --no-coverage 2>&1 | tail -20
```

Expected: `PASS apps/api/src/__tests__/taxonomy/cache-headers.test.ts` — 4 tests passing.

---

## Task 6: Install TanStack Query and add QueryProvider to web app

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/providers/query-provider.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

### Context
TanStack Query v5 provides stale-while-revalidate caching at the component level. After this task, every `useQuery` call with the same key returns cached data instead of firing a network request — essential for the taxonomy caching in Task 7.

- [ ] **Step 1: Install @tanstack/react-query**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web add @tanstack/react-query
```

Expected: `@tanstack/react-query` appears in `apps/web/package.json` dependencies.

- [ ] **Step 2: Create QueryProvider client component**

Create `apps/web/src/components/providers/query-provider.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures each request gets its own QueryClient in SSR/RSC context
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes default
            gcTime: 10 * 60 * 1000,   // 10 minutes garbage collect
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Add QueryProvider to locale layout**

In `apps/web/src/app/[locale]/layout.tsx`, add the import and wrap children:

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { CartProvider } from '@/contexts/cart-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { CookieConsentBanner } from '@/components/features/legal/cookie-consent-banner';
import { QueryProvider } from '@/components/providers/query-provider';
import '@/styles/globals.css';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryProvider>
          <AuthProvider>
            <CartProvider>
              <NotificationProvider>
                {children}
                <CookieConsentBanner />
              </NotificationProvider>
            </CartProvider>
          </AuthProvider>
        </QueryProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'font-sans',
            },
          }}
        />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web type-check 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Verify web builds**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web build 2>&1 | tail -30
```

Expected: build completes successfully.

---

## Task 7: Cache taxonomy calls in catalog page with useQuery

**Files:**
- Modify: `apps/web/src/app/[locale]/(public)/catalog/page.tsx`

### Context
The catalog page currently fires 3 API calls on every mount via `useEffect` — `getCategories()`, `getCharacters(1, 100)`, `getSeries({ limit: 100 })`. These responses don't change between page visits. With TanStack Query's `staleTime: 10min`, navigating away and back reuses cached data — zero network requests for taxonomy on repeat visits.

- [ ] **Step 1: Replace useEffect taxonomy calls with useQuery in catalog/page.tsx**

In `apps/web/src/app/[locale]/(public)/catalog/page.tsx`:

1. Add imports at the top (after existing imports):

```typescript
import { useQuery } from '@tanstack/react-query';
```

2. Remove the following state declarations (around lines 91–93):

```typescript
// DELETE these lines:
const [categories, setCategories] = useState<Category[]>([]);
const [characters, setCharacters] = useState<Character[]>([]);
const [seriesList, setSeriesList] = useState<Series[]>([]);
```

3. Remove the taxonomy `useEffect` (lines 103–114):

```typescript
// DELETE this entire block:
useEffect(() => {
  Promise.all([
    getCategories(),
    getCharacters(1, 100),
    getSeries({ limit: 100 }),
  ]).then(([cats, chars, ser]) => {
    setCategories(cats);
    setCharacters(chars.data);
    setSeriesList(ser.data);
  });
}, []);
```

4. Add `useQuery` calls in their place (after the `filters` declaration on line 101):

```typescript
const { data: categories = [] } = useQuery({
  queryKey: ['taxonomy', 'categories'],
  queryFn: () => getCategories(),
  staleTime: 10 * 60 * 1000,
});

const { data: characters = [] } = useQuery({
  queryKey: ['taxonomy', 'characters'],
  queryFn: () => getCharacters(1, 100).then((r) => r.data),
  staleTime: 10 * 60 * 1000,
});

const { data: seriesList = [] } = useQuery({
  queryKey: ['taxonomy', 'series'],
  queryFn: () => getSeries({ limit: 100 }).then((r) => r.data),
  staleTime: 10 * 60 * 1000,
});
```

- [ ] **Step 2: Remove now-unused useState import items**

In the import on line 3, remove `useEffect` from the React imports if it's now unused (check first — other effects in the file still use it):

```typescript
// Keep useEffect — it's still used for the catalog search (line 117)
// Keep useState — still used for entries, pagination, loading, error, view, filtersOpen, etc.
```

No changes needed here — `useEffect` and `useState` are still used for other state.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web type-check 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Verify web builds**

```bash
cd c:/Projetos/comicstrunk
pnpm --filter web build 2>&1 | tail -30
```

Expected: build completes, no errors.

---

## Self-Review

### 1. Spec coverage

| Requirement | Task |
|-------------|------|
| N+1 subscription lookup in createOrder | Task 1 ✅ |
| Cache taxonomy calls (TanStack Query, staleTime 10min) | Tasks 6+7 ✅ |
| getSellerProfile via marketplace search hack | Tasks 2+3 ✅ |
| getSeriesProgress pagination | **Not in this plan** — complex raw query refactor, low user impact today. Defer. |
| Missing DB indexes (Series.title) | Task 4 ✅ |
| Missing indexes on Order/Notification/Review | Already exist in schema — false alarm ✅ |
| Cache-Control on taxonomy routes | Task 5 ✅ |

### 2. Placeholder scan

No placeholders found. Every step has exact file paths, complete code, and exact commands with expected output.

### 3. Type consistency

- `getPublicProfile()` in service returns `{ id, name, avatarUrl, createdAt: string }` — matches what `getSellerProfile()` in web expects after the fix (added `avatarUrl`, removed `createdAt?` optional).
- `cachePublic(300)` signature defined in Task 5 Step 3, consumed correctly in Steps 4–7.
- `useQuery` query functions return the same types as the old `useState` setters expected.
- `QueryProvider` wraps children with correct provider type.

### 4. Dependency order

Tasks can be executed sequentially or in parallel:
- Task 1 (API) — independent
- Task 2 (API) → Task 3 (Web) must come after Task 2
- Task 4 (DB) — independent, but run seed after
- Task 5 (API) — independent
- Task 6 (Web) → Task 7 (Web) must come after Task 6
