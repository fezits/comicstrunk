# Phase 3: Collection Management - Research

**Researched:** 2026-02-23
**Domain:** Collection CRUD, series progress tracking, CSV import/export, plan-based limits, Cloudinary photo upload
**Confidence:** HIGH

## Summary

Phase 3 builds on top of Phase 2's catalog and taxonomy to let authenticated users manage a personal comic book collection. The core technical domain is straightforward CRUD with some non-trivial requirements around atomic collection limit enforcement, series progress calculation, CSV import/export with error reporting, and photo upload via the existing Cloudinary integration.

**The majority of this phase is already implemented.** A thorough codebase audit reveals that the develop branch already contains working API endpoints (collection routes + service), shared contracts (Zod schemas + types), a frontend API client, and fully-built UI pages for: collection list with filters, collection item detail with edit/delete/read/sale toggles, add-to-collection page with catalog search, CSV import/export flows, series progress page with progress cards, and all PT-BR translations. The existing implementation covers requirements COLL-01, COLL-02, COLL-03, COLL-05, COLL-06, COLL-07 (partially), COLL-09 (partially), SERI-05, and SERI-06.

**Primary recommendation:** The planner should focus on gaps in the existing implementation rather than building from scratch. The key gaps are: (1) photo upload for collection items (COLL-04 -- endpoint and UI missing), (2) atomic limit enforcement with database-level guarantees (COLL-09 -- current implementation uses count-then-insert with a race window), (3) plan limit enforcement returning remaining count and plan info to the client (COLL-07 -- current error message is good but client needs limit/count data for the upgrade CTA), (4) missing editions list with links to catalog search (SERI-07 -- series progress exists but missing editions are not listed), (5) COLL-08 verification (downgrade preserves existing items -- currently handled by design since the service only blocks new additions), and (6) connecting the catalog card "Add to Collection" button to actual functionality (currently a no-op).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLL-01 | User can add copies to collection with quantity, price paid, condition, notes | ALREADY IMPLEMENTED: `addItem` service, `createCollectionItemSchema`, add page with form. Needs: verify quantity > 1 behavior (current schema allows it but service creates one item per catalog entry -- quantity is a field on the item, not multiple rows). |
| COLL-02 | User can mark copy as read with reading date | ALREADY IMPLEMENTED: `markAsRead` service with `readAt` timestamp, PATCH /:id/read endpoint, toggle buttons on list cards and detail page. |
| COLL-03 | User can mark copy as for sale with price and commission preview | ALREADY IMPLEMENTED: `markForSale` service with commission calculation (10% fixed rate), PATCH /:id/sale endpoint, sale dialog on detail page. Commission preview returned in response. |
| COLL-04 | User can upload photos of their copy | GAP: No photo upload endpoint or UI exists for collection items. Cloudinary infrastructure is ready (`uploadImage`, `uploadSingle` middleware). Need: API endpoint for photo upload, photo URL field consideration (CollectionItem model has no photo fields -- may need schema consideration or use a separate approach). |
| COLL-05 | CSV import with template, error report; CSV export | ALREADY IMPLEMENTED: Template download, import with row-by-row validation and error report, export. All API endpoints and UI (import page at /collection/add?mode=import, export button on collection page). |
| COLL-06 | CSV export | ALREADY IMPLEMENTED: Export endpoint returns CSV blob, frontend downloads it as file. |
| COLL-07 | Collection limit per plan (FREE: 50, BASIC: 200) with clear message and upgrade CTA | PARTIALLY IMPLEMENTED: `checkPlanLimit` function in service enforces limits and throws BadRequestError with limit info. GAP: Client needs structured error data (current limit, current count, plan type) to show upgrade CTA. Frontend does not currently display limit info or upgrade suggestion. |
| COLL-08 | Existing copies not removed on downgrade, only new additions blocked | IMPLEMENTED BY DESIGN: The limit check only runs on `addItem` and `importCSV`. Existing items are never deleted by the service. Needs: explicit test to verify this behavior. |
| COLL-09 | Atomic limit enforcement (prevents race condition) | GAP: Current implementation uses `count()` then `create()` -- two separate queries with a race window. Requirement explicitly calls for `UPDATE ... WHERE count < limit` pattern. Need: refactor to use `$transaction` with serializable isolation or a raw SQL atomic check-and-insert. |
| SERI-05 | User sees series progress ("15 of 42 editions") | ALREADY IMPLEMENTED: `getSeriesProgress` service returns collected/totalEditions per series. SeriesProgressCard displays "X de Y (Z%)". |
| SERI-06 | Dedicated series progress page with progress bars and missing editions | PARTIALLY IMPLEMENTED: Series progress page exists with progress bars per series. GAP: Missing editions are not listed -- the page shows progress but not which specific editions the user is missing. |
| SERI-07 | Link from missing editions to catalog/marketplace search | GAP: No missing editions data is returned from the API. Need: endpoint or extension to `getSeriesProgress` that returns the list of catalog entries in the series that the user does NOT own, with links to catalog search. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Express | 4.x | HTTP routing, middleware | In use |
| Prisma | 5.22.0 | ORM, database queries, transactions | In use |
| Zod | 3.x | Schema validation (contracts) | In use |
| Multer | 1.x | File upload middleware (memory storage) | In use |
| PapaParse | 5.x | CSV parsing and generation | In use |
| Cloudinary | 2.x (v2 SDK) | Image upload and CDN | In use |
| Axios | 1.x | Frontend HTTP client | In use |
| next-intl | 4.x | i18n (PT-BR translations) | In use |
| shadcn/ui | latest | UI components (Card, Badge, Dialog, etc.) | In use |
| Sonner | latest | Toast notifications | In use |

### Supporting (no new packages needed)
This phase does not require any new npm packages. All infrastructure is in place from Phase 1 and Phase 2.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SQL for atomic limit | Prisma `$transaction` with isolation level | Prisma transactions are cleaner but MySQL does not support `SERIALIZABLE` isolation on InnoDB row-level locks well for count-then-insert; raw SQL `INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < limit` is more atomic |
| Separate photo model | JSON array field on CollectionItem | JSON array is simpler but not queryable; separate model allows indexing and future features (ordering, captions) |

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure (additions only)
```
apps/api/src/modules/collection/
├── collection.routes.ts        # EXISTS -- needs photo upload route, missing-editions route
├── collection.service.ts       # EXISTS -- needs atomic limit, photo upload, missing editions
apps/web/src/
├── app/[locale]/(collector)/collection/
│   ├── page.tsx                # EXISTS -- collection list
│   ├── add/page.tsx            # EXISTS -- add item + import
│   ├── [id]/page.tsx           # EXISTS -- item detail with edit/delete
│   └── series-progress/page.tsx # EXISTS -- needs missing editions panel
├── components/features/collection/
│   ├── collection-item-card.tsx # EXISTS
│   ├── collection-filters.tsx   # EXISTS
│   ├── collection-stats.tsx     # EXISTS
│   ├── series-progress-card.tsx # EXISTS -- needs missing editions expansion
│   └── plan-limit-banner.tsx    # NEW -- upgrade CTA when limit is near/reached
├── lib/api/
│   └── collection.ts            # EXISTS -- needs photo upload, missing editions functions
packages/contracts/src/
│   └── collection.ts            # EXISTS -- may need photo-related schema additions
```

### Pattern 1: Atomic Collection Limit Enforcement
**What:** Prevent race conditions where two concurrent requests both pass the count check and both insert, exceeding the limit.
**When to use:** Every addItem and importCSV operation.
**Example:**
```typescript
// Use Prisma interactive transaction with raw SQL for atomicity
async function addItemAtomic(userId: string, data: CreateCollectionItemInput) {
  return prisma.$transaction(async (tx) => {
    // Lock-free atomic check: count current items and abort if >= limit
    const [{ count }] = await tx.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM collection_items WHERE user_id = ${userId}
    `;

    const subscription = await tx.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const planType = subscription?.planType ?? 'FREE';
    const limit = COLLECTION_LIMITS[planType as keyof typeof COLLECTION_LIMITS];

    if (Number(count) >= limit) {
      throw new BadRequestError(
        `Collection limit reached (${limit} items for ${planType} plan).`,
        { currentCount: Number(count), limit, planType }
      );
    }

    // Create within same transaction -- serialized with the count
    return tx.collectionItem.create({
      data: { userId, catalogEntryId: data.catalogEntryId, ... },
      include: collectionIncludes(),
    });
  });
}
```

### Pattern 2: Missing Editions Calculation
**What:** Compare all editions in a series against the user's collection to find gaps.
**When to use:** Series progress detail, missing editions panel.
**Example:**
```typescript
async function getMissingEditions(userId: string, seriesId: string) {
  // Get all catalog entries in this series
  const allEditions = await prisma.catalogEntry.findMany({
    where: { seriesId, approvalStatus: 'APPROVED' },
    select: { id: true, title: true, editionNumber: true, volumeNumber: true, coverImageUrl: true },
    orderBy: { editionNumber: 'asc' },
  });

  // Get user's collection items for this series
  const ownedIds = await prisma.collectionItem.findMany({
    where: { userId, catalogEntry: { seriesId } },
    select: { catalogEntryId: true },
  });

  const ownedSet = new Set(ownedIds.map((i) => i.catalogEntryId));

  return allEditions.filter((e) => !ownedSet.has(e.id));
}
```

### Pattern 3: Photo Upload for Collection Items
**What:** Allow users to upload photos of their physical copies.
**When to use:** Collection item detail page.
**Notes:** The CollectionItem model in Prisma does NOT have photo fields. Options:
1. **Add a JSON field** to CollectionItem for photo URLs (simplest, works for v1)
2. **Create a CollectionItemPhoto model** (more flexible, allows multiple photos with ordering)

Since the Prisma schema is defined upfront for all phases and schema changes require migrations, the planner must decide: use a new migration to add a `photoUrls Json?` field to CollectionItem, OR use the existing `notes` field creatively (not recommended), OR create a separate model.

**Recommendation:** Add a `photoUrls Json? @map("photo_urls")` field to CollectionItem via a new migration. This is the lightest-touch approach for v1. The schema was designed to be extended without destructive changes.

```typescript
// API route
router.post('/:id/photos', authenticate, uploadSingle('photo'), async (req, res, next) => {
  const { url } = await uploadImage(req.file.buffer, 'comicstrunk/collection');
  const item = await collectionService.addPhoto(req.user.userId, req.params.id, url);
  sendSuccess(res, item);
});
```

### Anti-Patterns to Avoid
- **Count-then-insert without transaction:** Creates a race window for collection limits. Always use a transaction.
- **Querying all editions on every collection list request:** Series progress should be a separate endpoint, not computed inline on the collection list.
- **Storing Cloudinary URLs in JSON without cleanup tracking:** If photos are stored in a JSON array, deleting photos requires parsing the URL to extract the publicId for Cloudinary deletion.
- **Blocking CSV import on first error:** Import should be row-by-row with error accumulation, continuing past individual row failures (already implemented correctly).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom CSV parser | PapaParse (already used) | Edge cases: quoted fields, embedded commas, BOM, encoding |
| Image upload/CDN | Manual file serving | Cloudinary (already configured) | Resizing, format optimization, CDN delivery |
| File upload middleware | Manual body parsing | Multer (already configured) | Memory storage, file size limits, MIME validation |
| Form validation | Manual req.body checks | Zod via contracts (already patterned) | Type inference, consistent error messages |
| Currency formatting | Manual string formatting | Intl.NumberFormat (already used in components) | Locale-aware, handles edge cases |

**Key insight:** This phase's entire infrastructure stack is already in place from Phase 1 and Phase 2. No new dependencies are needed. Every pattern has a working precedent in the codebase.

## Common Pitfalls

### Pitfall 1: Race Condition on Collection Limits
**What goes wrong:** Two concurrent requests both check `count < limit`, both pass, both insert, user ends up with limit+1 items.
**Why it happens:** Separate read (count) and write (insert) without transactional isolation.
**How to avoid:** Wrap count check and insert in a Prisma `$transaction`. For maximum safety, use `SELECT ... FOR UPDATE` or a raw SQL approach that atomically checks.
**Warning signs:** Intermittent failures where users slightly exceed their plan limit.

### Pitfall 2: Prisma Decimal Handling
**What goes wrong:** `pricePaid` and `salePrice` are `Decimal(10,2)` in Prisma, which returns `Prisma.Decimal` objects, not plain numbers. Frontend receives string-ified decimals.
**Why it happens:** Prisma wraps MySQL DECIMAL in its own Decimal class for precision.
**How to avoid:** The existing code already handles this -- `Number(item.pricePaid)` in CSV export, and the frontend already expects `number | null`. Ensure any new endpoints do the same.
**Warning signs:** Prices showing as `"29.90"` (string) instead of `29.90` (number) in API responses.

### Pitfall 3: Missing Migration for Photo Field
**What goes wrong:** Trying to use `photoUrls` on CollectionItem without running a migration first.
**Why it happens:** The original schema was defined for all 10 phases, but COLL-04 (photo upload) wasn't included as a field on CollectionItem.
**How to avoid:** Create a new Prisma migration that adds the field. The schema is designed to be extended non-destructively.
**Warning signs:** Prisma type errors, runtime "Unknown field" errors.

### Pitfall 4: CSV Import Exceeding Plan Limits
**What goes wrong:** CSV import with 100 rows passes the initial bulk limit check but some rows are duplicates/invalid, so the actual import count is lower. Or conversely, the check passes for the total row count but the user is already near the limit.
**Why it happens:** The current `checkPlanLimit(userId, rows.length)` checks upfront with total row count, but rows may fail validation.
**How to avoid:** The current approach is actually conservative (safe) -- it checks the worst case (all rows succeed). This is acceptable. If too restrictive for UX, could switch to checking per-row within the transaction.
**Warning signs:** Users unable to import small CSV files because the total row count plus existing items exceeds the limit, even though many rows would be skipped.

### Pitfall 5: Express Route Order Collision
**What goes wrong:** Routes like `/stats`, `/export`, `/csv-template` are matched as `/:id` parameters.
**Why it happens:** Express matches routes in registration order.
**How to avoid:** The current code already handles this correctly -- static routes (`/stats`, `/series-progress`, `/export`, `/csv-template`, `/import`) are registered BEFORE `/:id`. Any new static routes must follow this pattern.
**Warning signs:** 404 or unexpected behavior when hitting known static endpoints.

## Code Examples

### Existing Collection Service Pattern (for reference)
```typescript
// Source: apps/api/src/modules/collection/collection.service.ts
// The addItem function already validates catalog entry, checks duplicates, and checks limits:
export async function addItem(userId: string, data: CreateCollectionItemInput) {
  const catalogEntry = await prisma.catalogEntry.findUnique({
    where: { id: data.catalogEntryId },
  });
  if (!catalogEntry || catalogEntry.approvalStatus !== 'APPROVED') {
    throw new NotFoundError('Catalog entry not found or not approved');
  }
  const existing = await prisma.collectionItem.findFirst({
    where: { userId, catalogEntryId: data.catalogEntryId },
  });
  if (existing) {
    throw new ConflictError('This item is already in your collection');
  }
  await checkPlanLimit(userId);
  // ... create item
}
```

### Existing Cloudinary Upload Pattern (for photo upload)
```typescript
// Source: apps/api/src/modules/catalog/catalog.service.ts
// Cover image upload pattern -- reuse for collection photos:
export async function uploadCoverImage(id: string, buffer: Buffer) {
  const { url } = await uploadImage(buffer, 'comicstrunk/covers');
  const updated = await prisma.catalogEntry.update({
    where: { id },
    data: { coverImageUrl: url },
  });
  return updated;
}
```

### Existing Frontend API Client Pattern
```typescript
// Source: apps/web/src/lib/api/collection.ts
// All API functions follow this pattern:
export async function getCollectionItem(id: string): Promise<CollectionItem> {
  const response = await apiClient.get(`/collection/${id}`);
  return response.data.data;
}
```

### Plan Limit Error with Structured Data (proposed pattern)
```typescript
// Service throws BadRequestError with extra metadata:
throw new BadRequestError(
  `Collection limit reached (${limit} items for ${planType} plan). Current: ${currentCount}.`,
);

// Frontend catches and shows upgrade CTA:
try {
  await addCollectionItem(data);
} catch (err) {
  if (err.response?.data?.error?.message?.includes('Collection limit reached')) {
    // Show upgrade CTA modal instead of generic error toast
    showPlanLimitModal();
    return;
  }
  toast.error(t('addError'));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate count + insert | Transactional count + insert | Best practice | Prevents race condition on limits |
| Single photo URL field | JSON array of photo URLs | Schema design choice | Supports multiple photos per item |
| Client-side CSV parsing | Server-side PapaParse | Already implemented | Consistent validation, server-controlled |

**Deprecated/outdated:**
- None relevant to this phase. The stack is stable and recently implemented.

## Open Questions

1. **CollectionItem Photo Storage Schema**
   - What we know: The Prisma schema does not include photo fields on CollectionItem. Cloudinary upload infrastructure exists.
   - What's unclear: Whether to add a `photoUrls Json?` field via migration or create a separate CollectionItemPhoto model.
   - Recommendation: Add `photoUrls Json? @map("photo_urls")` to CollectionItem. Simpler, sufficient for v1. A separate model is over-engineering for the current scope. This requires a new Prisma migration.

2. **Atomic Limit Enforcement Strategy**
   - What we know: Current implementation uses count-then-insert (non-atomic). Requirement COLL-09 explicitly requires atomicity.
   - What's unclear: Whether Prisma `$transaction` with default isolation level is sufficient or if `SERIALIZABLE` is needed.
   - Recommendation: Prisma `$transaction` (interactive) with default `READ COMMITTED` isolation + `SELECT COUNT(*) ... FOR UPDATE` (locking) on the collection_items rows for the user. This prevents concurrent inserts from both passing the count check.

3. **Catalog Card "Add to Collection" Button**
   - What we know: The CatalogCard component has an "Add to Collection" button that is currently a no-op (click handler does nothing except prevent default).
   - What's unclear: Whether this should be a quick-add (add with defaults) or navigate to the /collection/add page with the entry pre-selected.
   - Recommendation: Quick-add with defaults (condition: NEW, quantity: 1) via API call, with a toast confirmation and link to edit details. This is the most natural UX for catalog browsing.

## Sources

### Primary (HIGH confidence)
- **Codebase audit** -- Direct reading of all relevant source files in the repository:
  - `apps/api/src/modules/collection/collection.routes.ts` -- Full route definitions
  - `apps/api/src/modules/collection/collection.service.ts` -- Complete service implementation
  - `packages/contracts/src/collection.ts` -- All Zod schemas and types
  - `apps/web/src/lib/api/collection.ts` -- Frontend API client
  - `apps/web/src/app/[locale]/(collector)/collection/` -- All page components
  - `apps/web/src/components/features/collection/` -- All feature components
  - `apps/web/src/messages/pt-BR.json` -- All translation strings
  - `apps/api/prisma/schema.prisma` -- Database model definitions
  - `apps/api/src/shared/lib/cloudinary.ts` -- Upload infrastructure
  - `apps/api/src/shared/middleware/upload.ts` -- Multer configuration
  - `apps/api/src/shared/lib/csv.ts` -- CSV utility functions

### Secondary (MEDIUM confidence)
- **Prisma transactions documentation** -- Interactive transactions with isolation levels for MySQL/InnoDB
- **MySQL InnoDB locking** -- `SELECT ... FOR UPDATE` row-level locking behavior within transactions

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use, no new dependencies needed
- Architecture: HIGH -- All patterns established by Phase 1 and Phase 2, direct code inspection
- Pitfalls: HIGH -- Based on actual code patterns observed in the existing implementation
- Gap analysis: HIGH -- Direct comparison of requirements vs. implemented code

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- no external dependencies changing)

## Gap Summary for Planner

The following is a prioritized list of what needs to be done (gaps only -- existing implementation is solid):

### Must Fix (required by requirements)
1. **COLL-09: Atomic limit enforcement** -- Refactor `checkPlanLimit` + `addItem` to use `$transaction`. Also apply to `importCSV`.
2. **COLL-04: Photo upload** -- Add `photoUrls` field to CollectionItem (migration), create upload endpoint, add photo upload UI on detail page.
3. **SERI-07: Missing editions list** -- Add `getMissingEditions` endpoint, display in series progress page with links to catalog search.
4. **COLL-07: Plan limit UI** -- When limit is reached, show structured error with current count, limit, and plan type. Display upgrade CTA on the collection page.

### Should Fix (UX improvement, aligns with success criteria)
5. **Catalog card quick-add** -- Wire the "Add to Collection" button on CatalogCard to actually add items.
6. **SERI-06 enhancement** -- Add missing editions panel to series progress page (currently shows progress bars but not the specific missing editions).
7. **Commission preview on sale** -- The markForSale response includes commission and sellerNet, but the frontend doesn't display them. Add commission preview to the sale dialog.

### Already Complete (verify with tests)
- COLL-01: Add/edit/remove copy with all fields
- COLL-02: Mark as read with date
- COLL-03: Mark for sale with price
- COLL-05: CSV import with template and error report
- COLL-06: CSV export
- COLL-08: Existing copies preserved on downgrade (by design)
- SERI-05: Series progress display
