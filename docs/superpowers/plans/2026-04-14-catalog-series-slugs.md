# Catalog & Series Slugs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-friendly slugs to CatalogEntry and Series, replace CUID-based URLs with slug-based URLs, redirect CUID access to slug via 301.

**Architecture:** Add `slug` (unique) field to both Prisma models. Extend the existing `slug.ts` utility to support the new models. API routes accept both slug and CUID (detect by format), always return slug in responses. Frontend uses slug for all links. Detail pages detect CUID access and redirect 301 to slug URL. Backfill script generates slugs for all existing records.

**Tech Stack:** Prisma (MySQL), Express, Next.js 15 App Router, slugify

---

## File Structure

### Modified Files
| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `slug` field to CatalogEntry and Series |
| `apps/api/src/shared/utils/slug.ts` | Extend SlugModel type to include `catalogEntry` and `series` |
| `apps/api/src/modules/catalog/catalog.service.ts` | `getCatalogEntryByIdOrSlug()`, generate slug on create, include slug in list select |
| `apps/api/src/modules/catalog/catalog.routes.ts` | Route `:idOrSlug` uses new service method |
| `apps/api/src/modules/series/series.service.ts` | `getSeriesByIdOrSlug()`, generate slug on create, include slug in responses |
| `apps/api/src/modules/series/series.routes.ts` | Route `:idOrSlug` uses new service method |
| `apps/web/src/lib/api/catalog.ts` | Add `slug` to CatalogEntry type |
| `apps/web/src/lib/api/series.ts` | Add `slug` to Series types |
| `apps/web/src/app/[locale]/(public)/catalog/[id]/page.tsx` | Detect CUID, redirect 301 to slug |
| `apps/web/src/app/[locale]/(public)/series/[id]/page.tsx` | Detect CUID, redirect 301 to slug |
| `apps/web/src/components/features/catalog/catalog-card.tsx` | Use `entry.slug` in href |
| `apps/web/src/components/features/catalog/catalog-list-item.tsx` | Use `entry.slug` in href |
| `apps/web/src/components/features/catalog/catalog-detail.tsx` | Use `series.slug` in series link |
| `apps/web/src/components/features/series/series-card.tsx` | Use `series.slug` in href |
| `apps/web/src/components/features/series/series-editions-list.tsx` | Use `edition.slug` in href |
| `apps/web/src/components/features/favorites/favorites-list.tsx` | Use `entry.slug` in href |
| `apps/web/src/components/features/homepage/homepage-catalog-highlights.tsx` | Use `item.slug` in href |
| `apps/web/src/components/features/collection/series-progress-card.tsx` | Use `edition.slug` in href |

### New Files
| File | Responsibility |
|---|---|
| `apps/api/scripts/backfill-slugs.ts` | One-time script to generate slugs for all existing CatalogEntry and Series |

---

## Task 1: Database Schema — Add slug fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add slug to CatalogEntry model**

In `schema.prisma`, add `slug` field to CatalogEntry (after `title`):

```prisma
slug            String?        @unique
```

Note: nullable initially so migration doesn't fail on existing rows. Will be made required after backfill.

- [ ] **Step 2: Add slug to Series model**

In `schema.prisma`, add `slug` field to Series (after `title`):

```prisma
slug          String?  @unique
```

- [ ] **Step 3: Create and apply migration**

```bash
corepack pnpm --filter api db:migrate -- --name add-slug-to-catalog-and-series
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
corepack pnpm --filter api db:generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add slug field to CatalogEntry and Series models"
```

---

## Task 2: Extend slug utility

**Files:**
- Modify: `apps/api/src/shared/utils/slug.ts`

- [ ] **Step 1: Add catalogEntry and series to SlugModel**

```typescript
type SlugModel = 'category' | 'tag' | 'character' | 'catalogEntry' | 'series';
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/shared/utils/slug.ts
git commit -m "feat: extend slug utility to support catalogEntry and series"
```

---

## Task 3: Backfill script — Generate slugs for existing records

**Files:**
- Create: `apps/api/scripts/backfill-slugs.ts`

- [ ] **Step 1: Create backfill script**

```typescript
import { prisma } from '../src/shared/lib/prisma';
import { generateSlug } from '../src/shared/utils/slug';

async function backfillSlugs() {
  console.log('=== Backfilling CatalogEntry slugs ===');

  const entries = await prisma.catalogEntry.findMany({
    where: { slug: null },
    select: { id: true, title: true },
  });

  console.log(`Found ${entries.length} entries without slug`);

  const seenSlugs = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let baseSlug = generateSlug(entry.title);
    if (!baseSlug) baseSlug = entry.id; // fallback for empty titles

    let slug = baseSlug;
    let counter = 1;
    while (seenSlugs.has(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // Also check DB for existing slugs (from prior partial runs)
    const existing = await prisma.catalogEntry.findFirst({ where: { slug } });
    while (existing || seenSlugs.has(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    seenSlugs.add(slug);

    await prisma.catalogEntry.update({
      where: { id: entry.id },
      data: { slug },
    });

    if ((i + 1) % 500 === 0 || i === entries.length - 1) {
      console.log(`  Processed ${i + 1}/${entries.length}`);
    }
  }

  console.log('=== Backfilling Series slugs ===');

  const seriesList = await prisma.series.findMany({
    where: { slug: null },
    select: { id: true, title: true },
  });

  console.log(`Found ${seriesList.length} series without slug`);

  const seenSeriesSlugs = new Set<string>();

  for (let i = 0; i < seriesList.length; i++) {
    const s = seriesList[i];
    let baseSlug = generateSlug(s.title);
    if (!baseSlug) baseSlug = s.id;

    let slug = baseSlug;
    let counter = 1;
    while (seenSeriesSlugs.has(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    const existing = await prisma.series.findFirst({ where: { slug } });
    while (existing || seenSeriesSlugs.has(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    seenSeriesSlugs.add(slug);

    await prisma.series.update({
      where: { id: s.id },
      data: { slug },
    });

    if ((i + 1) % 100 === 0 || i === seriesList.length - 1) {
      console.log(`  Processed ${i + 1}/${seriesList.length}`);
    }
  }

  console.log('=== Done ===');
  await prisma.$disconnect();
}

backfillSlugs().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run backfill locally**

```bash
cd apps/api && npx tsx scripts/backfill-slugs.ts
```

- [ ] **Step 3: Verify slugs were generated**

```bash
cd apps/api && npx tsx -e "
  import { prisma } from './src/shared/lib/prisma';
  async function check() {
    const nullSlugs = await prisma.catalogEntry.count({ where: { slug: null } });
    const total = await prisma.catalogEntry.count();
    console.log('CatalogEntry: ' + (total - nullSlugs) + '/' + total + ' have slugs');
    const nullSeriesSlugs = await prisma.series.count({ where: { slug: null } });
    const totalSeries = await prisma.series.count();
    console.log('Series: ' + (totalSeries - nullSeriesSlugs) + '/' + totalSeries + ' have slugs');
    await prisma.\$disconnect();
  }
  check();
"
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/backfill-slugs.ts
git commit -m "feat: add backfill script for catalog and series slugs"
```

---

## Task 4: API — Catalog service and routes accept slug

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`
- Modify: `apps/api/src/modules/catalog/catalog.routes.ts`

- [ ] **Step 1: Add slug generation on create and update in catalog service**

In `createCatalogEntry`, after creating the entry, generate and set slug:

```typescript
import { uniqueSlug } from '../../shared/utils/slug';
```

In `createCatalogEntry`, add slug generation to the data before Prisma create.

- [ ] **Step 2: Add `getCatalogEntryByIdOrSlug` function**

```typescript
function isCuid(str: string): boolean {
  return /^c[a-z0-9]{24}$/.test(str);
}

export async function getCatalogEntryByIdOrSlug(idOrSlug: string, publicOnly = true) {
  const where = isCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };

  const entry = await prisma.catalogEntry.findFirst({
    where,
    include: catalogIncludes(),
  });

  if (!entry) {
    throw new NotFoundError('Catalog entry not found');
  }

  if (publicOnly && entry.approvalStatus !== 'APPROVED') {
    throw new NotFoundError('Catalog entry not found');
  }

  return resolveCover(entry);
}
```

- [ ] **Step 3: Update route to use new function**

In `catalog.routes.ts`, change the `GET /:id` handler to call `getCatalogEntryByIdOrSlug`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/catalog/
git commit -m "feat: catalog API accepts slug or CUID, generates slug on create"
```

---

## Task 5: API — Series service and routes accept slug

**Files:**
- Modify: `apps/api/src/modules/series/series.service.ts`
- Modify: `apps/api/src/modules/series/series.routes.ts`

- [ ] **Step 1: Add `getSeriesByIdOrSlug` and slug generation**

Same pattern as catalog — `isCuid()` check, `findFirst` with slug or id, slug on create.

- [ ] **Step 2: Update series routes**

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/series/
git commit -m "feat: series API accepts slug or CUID, generates slug on create"
```

---

## Task 6: Frontend — Update types and API client

**Files:**
- Modify: `apps/web/src/lib/api/catalog.ts`
- Modify: `apps/web/src/lib/api/series.ts`

- [ ] **Step 1: Add slug to CatalogEntry type**

- [ ] **Step 2: Add slug to Series types**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/catalog.ts apps/web/src/lib/api/series.ts
git commit -m "feat: add slug field to frontend catalog and series types"
```

---

## Task 7: Frontend — Update all links to use slug

**Files:** All components that generate `/catalog/${id}` or `/series/${id}` links.

- [ ] **Step 1: Update catalog links** (catalog-card, catalog-list-item, favorites-list, homepage-catalog-highlights, series-editions-list, series-progress-card)

Change `entry.id` → `entry.slug` in href for public catalog links.

- [ ] **Step 2: Update series links** (series-card, catalog-detail)

Change `series.id` → `series.slug` in href for public series links.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/
git commit -m "feat: use slug instead of CUID in all catalog and series links"
```

---

## Task 8: Frontend — Detail pages redirect CUID to slug

**Files:**
- Modify: `apps/web/src/app/[locale]/(public)/catalog/[id]/page.tsx`
- Modify: `apps/web/src/app/[locale]/(public)/series/[id]/page.tsx`

- [ ] **Step 1: Catalog detail page — add CUID detection and redirect**

The page fetches by idOrSlug. If the param looks like a CUID but the entry has a slug, redirect 301.

- [ ] **Step 2: Series detail page — same pattern**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: redirect CUID URLs to slug URLs with 301"
```

---

## Task 9: Deploy and test

- [ ] **Step 1: Run backfill on production DB**
- [ ] **Step 2: Deploy API**
- [ ] **Step 3: Deploy Web**
- [ ] **Step 4: Test with existing gibi — navigate, verify slug URL, check redirect**
