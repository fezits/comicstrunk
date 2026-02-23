# Phase 2: Catalog and Taxonomy - Research

**Researched:** 2026-02-22
**Domain:** CRUD APIs with editorial workflow, taxonomy management, search with combined filters, CSV import/export, image upload
**Confidence:** HIGH

## Summary

Phase 2 builds on top of the existing Prisma schema (all catalog models were defined upfront in Phase 1) and the established Express module pattern (routes/service/Prisma). The core work is creating seven new API modules (series, categories, tags, characters, catalog entries, catalog search, CSV import/export) and their corresponding frontend pages. The most complex pieces are: (1) the editorial approval state machine (DRAFT -> PENDING -> APPROVED -> REJECTED), (2) combined multi-filter search with pagination, and (3) bulk CSV import with row-level validation and error reporting.

No new Prisma migration is needed -- all tables (`catalog_entries`, `series`, `categories`, `tags`, `characters`, and junction tables `catalog_categories`, `catalog_tags`, `catalog_characters`) already exist in the database from the Phase 1 upfront schema definition. The primary technical decisions are: use Prisma's native `where` clause filtering (not full-text search) for combined filter queries, use `multer` memory storage + `cloudinary` SDK for cover image uploads, use `papaparse` for CSV parsing/generation, and use `slugify` for slug generation on taxonomy entities.

**Primary recommendation:** Follow the exact same module pattern as `auth` and `users` -- one `*.routes.ts` + one `*.service.ts` per module -- adding five new modules: `catalog`, `series`, `categories`, `tags`, `characters`. Use `authorize('ADMIN')` middleware for all write operations on taxonomy and catalog management. Public read endpoints require no authentication.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CATL-01 | Catalog entry has: title, author, publisher, imprint, barcode/ISBN, cover image, description | Schema already defines all fields on `CatalogEntry` model. Cover image stored as `coverImageUrl` (Cloudinary URL). Use multer + cloudinary SDK for upload. |
| CATL-02 | Catalog entries can belong to a series (with volume and edition number) | Schema has `seriesId`, `volumeNumber`, `editionNumber` on CatalogEntry with relation to `Series` model. Prisma nested `include` for series data. |
| CATL-03 | Catalog entries classified by categories and free-form tags | Junction tables `CatalogCategory` and `CatalogTag` exist. Many-to-many via Prisma `connect`/`set` operations. Categories have slugs; tags have slugs. |
| CATL-04 | Catalog entries associated with characters/heroes | Junction table `CatalogCharacter` exists. Same many-to-many pattern as categories/tags. |
| CATL-05 | New catalog entries pass through editorial approval before appearing publicly | `approvalStatus` field with `ApprovalStatus` enum (DRAFT/PENDING/APPROVED/REJECTED). Filter public queries by `approvalStatus: 'APPROVED'`. |
| CATL-06 | Admin can approve or reject catalog entries with a reason | `rejectionReason` text field exists. Admin endpoint changes `approvalStatus` and sets `rejectionReason`. Use `authorize('ADMIN')` middleware. |
| CATL-07 | Search with combined filters: publisher, character, series, category, price range, condition, year | Build dynamic Prisma `where` clause combining multiple filters. Use `AND` array for combining conditions. Character/category filters use `some` relation filter. |
| CATL-08 | Search results sortable by price, date, rating, title | Prisma `orderBy` with dynamic field mapping. Note: price sorting deferred (no price on CatalogEntry -- price is on CollectionItem in Phase 3). Sort by title, createdAt, averageRating. |
| CATL-09 | All catalog listings paginated | Existing `paginationSchema` in contracts. Use `sendPaginated` helper. Prisma `skip`/`take` with `count` for total. |
| CATL-10 | Average rating (1-5 stars) displayed on each catalog entry | `averageRating` Decimal and `ratingCount` Int fields exist on CatalogEntry. Updated by Phase 7 (Reviews). Phase 2 just reads/displays these fields. |
| CATL-11 | Admin can bulk import catalog entries via CSV | Use `papaparse` for CSV parsing. Multer memory storage for file upload. Row-by-row Zod validation. Return error report with row numbers. |
| CATL-12 | Admin can export catalog data as CSV | Use `papaparse` `unparse` for CSV generation. Stream response with `text/csv` content type and `Content-Disposition` header. |
| CATL-13 | Catalog schema includes barcode/ISBN fields and high-quality cover image storage | `barcode` and `isbn` fields exist with indexes. `coverImageUrl` stores Cloudinary URL (supports transformations for quality/size). |
| SERI-01 | Each series has: title, description, total number of editions | `Series` model with `title`, `description` (Text), `totalEditions` fields. CRUD endpoints for admin. |
| SERI-02 | Catalog entries linked to series with volume and edition number | `seriesId`, `volumeNumber`, `editionNumber` on CatalogEntry. Series detail page uses `include: { catalogEntries: true }`. |
| SERI-03 | Series listing page with search | Public GET endpoint with title search filter and pagination. Prisma `contains` for title search. |
| SERI-04 | Series detail page showing all editions | GET `/series/:id` endpoint with `include: { catalogEntries: { where: { approvalStatus: 'APPROVED' }, orderBy: { editionNumber: 'asc' } } }`. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 5.22.0 | ORM for MySQL queries | Already in use; all models defined |
| Express | 4.21.x | HTTP framework | Already in use |
| Zod | 3.23.x | Schema validation | Already in use via contracts package |
| Axios | 1.13.x | Frontend API calls | Already in use |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| multer | ^1.4.5 | Multipart form-data parsing | Cover image upload, CSV file upload |
| cloudinary | ^2.5.0 | Cloud image storage/CDN | Cover image storage with transformations |
| papaparse | ^5.5.0 | CSV parse/generate | Bulk import and export |
| slugify | ^1.7.0 | URL-safe slug generation | Category, tag, character slugs |

### Types for New Dependencies
| Library | Version | Purpose |
|---------|---------|---------|
| @types/multer | ^1.4.0 | TypeScript types for multer |
| @types/papaparse | ^5.3.0 | TypeScript types for papaparse |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse | csv-parse/fast-csv | csv-parse is more popular but papaparse works in both Node and browser, and its `unparse` for export is very clean |
| multer + cloudinary | multer-storage-cloudinary | Dedicated storage engine but less flexibility; memory buffer + manual upload gives more control over validation before upload |
| slugify | @sindresorhus/slugify | ESM-only, which complicates CJS build; slugify supports CJS natively |
| Prisma fullTextSearch | Prisma `contains` + `startsWith` | Full-text search requires preview feature flags in Prisma 5.22 and @@fulltext indexes in schema (would need migration). `contains` is sufficient for catalog size and simpler to implement. Can upgrade to full-text later if needed. |

**Installation (API):**
```bash
pnpm --filter api add multer cloudinary papaparse slugify
pnpm --filter api add -D @types/multer @types/papaparse
```

**No new web dependencies needed** -- shadcn/ui components (Select, Table, Badge, Tabs) can be added via CLI as needed. The existing stack (React Hook Form, Zod resolver, Axios, Lucide icons) covers all frontend needs.

## Architecture Patterns

### Recommended Project Structure

#### API Module Structure
```
apps/api/src/
├── modules/
│   ├── auth/            # (existing)
│   ├── users/           # (existing)
│   ├── catalog/
│   │   ├── catalog.routes.ts    # CRUD + approval + search endpoints
│   │   └── catalog.service.ts   # Business logic, Prisma queries
│   ├── series/
│   │   ├── series.routes.ts     # CRUD + public listing
│   │   └── series.service.ts
│   ├── categories/
│   │   ├── categories.routes.ts # CRUD
│   │   └── categories.service.ts
│   ├── tags/
│   │   ├── tags.routes.ts       # CRUD
│   │   └── tags.service.ts
│   └── characters/
│       ├── characters.routes.ts # CRUD
│       └── characters.service.ts
├── shared/
│   ├── lib/
│   │   ├── prisma.ts            # (existing)
│   │   ├── cloudinary.ts        # NEW: Cloudinary config + upload helper
│   │   └── csv.ts               # NEW: CSV parse/unparse helpers
│   ├── middleware/
│   │   ├── validate.ts          # (existing)
│   │   ├── authenticate.ts      # (existing)
│   │   ├── authorize.ts         # (existing)
│   │   └── upload.ts            # NEW: Multer config (memory storage)
│   └── utils/
│       ├── response.ts          # (existing)
│       ├── api-error.ts         # (existing)
│       └── slug.ts              # NEW: Slug generation helper
```

#### Web Page Structure
```
apps/web/src/
├── app/[locale]/
│   ├── (public)/
│   │   ├── catalog/
│   │   │   ├── page.tsx           # Catalog browse page with filters
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Catalog entry detail page
│   │   ├── series/
│   │   │   ├── page.tsx           # Series listing with search
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Series detail (all editions)
│   │   └── page.tsx               # (existing) Homepage
│   ├── (admin)/
│   │   └── admin/
│   │       ├── catalog/
│   │       │   ├── page.tsx       # Approval queue + catalog list
│   │       │   ├── new/
│   │       │   │   └── page.tsx   # Create catalog entry form
│   │       │   ├── [id]/
│   │       │   │   └── edit/
│   │       │   │       └── page.tsx # Edit catalog entry
│   │       │   └── import/
│   │       │       └── page.tsx   # CSV import page
│   │       └── content/
│   │           ├── series/
│   │           │   └── page.tsx   # Series CRUD
│   │           ├── categories/
│   │           │   └── page.tsx   # Categories CRUD
│   │           ├── tags/
│   │           │   └── page.tsx   # Tags CRUD
│   │           └── characters/
│   │               └── page.tsx   # Characters CRUD
├── components/
│   ├── features/
│   │   ├── catalog/
│   │   │   ├── catalog-card.tsx          # Catalog entry card for listings
│   │   │   ├── catalog-filters.tsx       # Filter sidebar component
│   │   │   ├── catalog-detail.tsx        # Detail page content
│   │   │   ├── catalog-form.tsx          # Create/edit form (admin)
│   │   │   └── approval-badge.tsx        # Status badge component
│   │   └── series/
│   │       ├── series-card.tsx           # Series listing card
│   │       └── series-editions-list.tsx  # Editions list in detail
│   └── ui/                               # (existing shadcn components)
├── lib/
│   └── api/
│       ├── client.ts                     # (existing)
│       ├── catalog.ts                    # NEW: Catalog API service
│       ├── series.ts                     # NEW: Series API service
│       └── taxonomy.ts                   # NEW: Categories/tags/characters API
```

#### Contracts Structure
```
packages/contracts/src/
├── index.ts         # (existing) re-exports
├── auth.ts          # (existing)
├── users.ts         # (existing)
├── common.ts        # (existing) — add ApprovalStatus, ItemCondition enums
├── catalog.ts       # NEW: Catalog schemas + types
├── series.ts        # NEW: Series schemas + types
└── taxonomy.ts      # NEW: Category/tag/character schemas + types
```

### Pattern 1: Module Route/Service Structure (follow existing auth pattern)
**What:** Each feature module has a routes file that wires middleware and a service file with all business logic.
**When to use:** Every new API module in Phase 2.
**Example:**
```typescript
// apps/api/src/modules/categories/categories.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { createCategorySchema, updateCategorySchema } from '@comicstrunk/contracts';
import * as categoriesService from './categories.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// Public: list categories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoriesService.listAll();
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});

// Admin: create category
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoriesService.create(req.body);
      sendSuccess(res, category, 201);
    } catch (err) {
      next(err);
    }
  },
);

export const categoriesRoutes: Router = router;
```

### Pattern 2: Approval State Machine
**What:** Catalog entries follow DRAFT -> PENDING -> APPROVED/REJECTED workflow.
**When to use:** All catalog entry state transitions.
**Example:**
```typescript
// In catalog.service.ts
const VALID_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PENDING'],   // Can be sent back for re-review
  REJECTED: ['DRAFT'],     // Author can edit and resubmit
};

export async function updateApprovalStatus(
  id: string,
  newStatus: ApprovalStatus,
  rejectionReason?: string,
) {
  const entry = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError('Catalog entry not found');

  const allowed = VALID_TRANSITIONS[entry.approvalStatus as ApprovalStatus];
  if (!allowed?.includes(newStatus)) {
    throw new BadRequestError(
      `Cannot transition from ${entry.approvalStatus} to ${newStatus}`
    );
  }

  return prisma.catalogEntry.update({
    where: { id },
    data: {
      approvalStatus: newStatus,
      rejectionReason: newStatus === 'REJECTED' ? rejectionReason : null,
    },
  });
}
```

### Pattern 3: Combined Filter Query Builder
**What:** Build dynamic Prisma `where` clause from multiple optional filters.
**When to use:** Catalog search endpoint.
**Example:**
```typescript
// In catalog.service.ts
export async function searchCatalog(filters: CatalogSearchInput) {
  const where: Prisma.CatalogEntryWhereInput = {
    approvalStatus: 'APPROVED', // Always filter to approved only
  };

  if (filters.title) {
    where.title = { contains: filters.title };
  }
  if (filters.publisher) {
    where.publisher = { contains: filters.publisher };
  }
  if (filters.seriesId) {
    where.seriesId = filters.seriesId;
  }
  if (filters.categoryIds?.length) {
    where.categories = {
      some: { categoryId: { in: filters.categoryIds } },
    };
  }
  if (filters.characterIds?.length) {
    where.characters = {
      some: { characterId: { in: filters.characterIds } },
    };
  }

  const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder);

  const [entries, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      include: {
        series: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        characters: { include: { character: true } },
      },
      orderBy,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.catalogEntry.count({ where }),
  ]);

  return { entries, total };
}
```

### Pattern 4: Multer Memory Storage + Cloudinary Upload
**What:** Parse multipart upload into memory buffer, validate, then upload to Cloudinary.
**When to use:** Cover image upload on catalog entry create/edit.
**Example:**
```typescript
// apps/api/src/shared/lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

// apps/api/src/shared/middleware/upload.ts
import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadSingle = (fieldName: string) =>
  multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
      }
    },
  }).single(fieldName);

export const uploadCSV = (fieldName: string) =>
  multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for CSV
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only CSV files are allowed.'));
      }
    },
  }).single(fieldName);
```

### Pattern 5: CSV Import with Row-Level Validation
**What:** Parse CSV, validate each row with Zod, collect errors, create valid entries in batch.
**When to use:** Admin bulk import endpoint.
**Example:**
```typescript
// In catalog.service.ts
import Papa from 'papaparse';

export async function importFromCSV(buffer: Buffer, adminId: string) {
  const csvText = buffer.toString('utf-8');
  const { data, errors: parseErrors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const results = { created: 0, errors: [] as { row: number; message: string }[] };

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, string>;
    const parsed = catalogImportRowSchema.safeParse(row);

    if (!parsed.success) {
      results.errors.push({
        row: i + 2, // +2 for header row and 0-index
        message: parsed.error.errors.map((e) => e.message).join('; '),
      });
      continue;
    }

    try {
      await createCatalogEntry({ ...parsed.data, createdById: adminId });
      results.created++;
    } catch (err) {
      results.errors.push({
        row: i + 2,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}
```

### Pattern 6: Slug Generation with Collision Handling
**What:** Generate URL-safe slug from name, handle duplicates by appending counter.
**When to use:** Category, tag, and character creation.
**Example:**
```typescript
// apps/api/src/shared/utils/slug.ts
import slugifyLib from 'slugify';
import { prisma } from '../lib/prisma';

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, locale: 'pt' });
}

export async function uniqueSlug(
  text: string,
  model: 'category' | 'tag' | 'character',
  excludeId?: string,
): Promise<string> {
  const base = slugify(text);
  let candidate = base;
  let counter = 0;

  while (true) {
    const existing = await (prisma[model] as any).findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (!existing) return candidate;
    counter++;
    candidate = `${base}-${counter}`;
  }
}
```

### Anti-Patterns to Avoid
- **Exposing non-approved entries publicly:** Every public query MUST include `approvalStatus: 'APPROVED'` filter. Never return DRAFT/PENDING/REJECTED entries to non-admin users.
- **N+1 queries in search results:** Always use Prisma `include` to eager-load relations (series, categories, tags, characters) in a single query, not separate queries per entry.
- **Accepting file uploads without size/type validation:** Always configure multer `fileFilter` and `limits` before processing.
- **Storing images locally on disk:** cPanel disk storage is limited and not CDN-backed. Always upload to Cloudinary.
- **Building slug in the frontend:** Slugs must be generated server-side to ensure uniqueness and consistency.
- **Allowing direct status jumps:** DRAFT to APPROVED or REJECTED to APPROVED bypasses the review queue. Enforce valid transitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing/generation | Custom CSV parser | `papaparse` | CSV has edge cases (quoted fields, escaped commas, newlines in values, BOM) that are deceptively complex |
| Slug generation | `string.replace(/\s/g, '-').toLowerCase()` | `slugify` library | Needs Unicode normalization, diacritic removal, PT-BR locale awareness |
| Image upload/CDN | File system storage + manual resizing | `cloudinary` SDK | CDN delivery, automatic format conversion, responsive transformations, no server disk management |
| Multipart parsing | Manual request body parsing | `multer` | MIME boundary parsing, file size limits, concurrent uploads are complex |
| Pagination math | Manual offset/limit calculation | Existing `paginationSchema` + `sendPaginated` | Already built and tested in Phase 1 contracts |

**Key insight:** CSV and image handling have dozens of edge cases (encoding, malformed input, timeout, partial upload) that production-ready libraries handle well. Custom solutions invariably miss edge cases that surface in production with real user data.

## Common Pitfalls

### Pitfall 1: Junction Table Management Complexity
**What goes wrong:** Creating a catalog entry with categories/tags/characters requires managing junction tables. Developers often forget to handle disconnects on update (removing old associations and adding new ones).
**Why it happens:** Many-to-many relations in Prisma require explicit `connect`/`disconnect`/`set` operations on junction tables.
**How to avoid:** Use Prisma's `set` operation on update which replaces all existing associations: `categories: { set: [], create: newCategoryIds.map(id => ({ categoryId: id })) }`. Or use `deleteMany` + `createMany` in a transaction.
**Warning signs:** Duplicate junction rows, "ghost" associations after editing.

### Pitfall 2: Forgetting approvalStatus Filter on Public Endpoints
**What goes wrong:** Public catalog browse returns DRAFT or PENDING entries that should not be visible.
**Why it happens:** Developer adds a new query path and forgets to include the `approvalStatus: 'APPROVED'` filter.
**How to avoid:** Create a helper function `approvedOnly()` that returns the base `where` clause. All public service methods must use it. Add tests specifically checking that non-approved entries are excluded.
**Warning signs:** Test with mixed approval statuses; if DRAFT entries appear in public listings, the filter is missing.

### Pitfall 3: CSV Import Error Handling Stops at First Error
**What goes wrong:** Import fails on first bad row and discards the rest of the file.
**Why it happens:** Using `safeParse` correctly but throwing on the first error instead of collecting all errors.
**How to avoid:** Iterate all rows, collect errors per row, create valid entries, return comprehensive error report with row numbers.
**Warning signs:** Users report "import failed" but only first row was bad.

### Pitfall 4: Missing Cloudinary Environment Variables
**What goes wrong:** Image upload silently fails or crashes in development/test because Cloudinary credentials are not set.
**Why it happens:** `.env` variables not configured or not documented.
**How to avoid:** Validate Cloudinary env vars at module load (like JWT secrets pattern from Phase 1). Provide a fallback for dev/test that stores a placeholder URL without actually uploading.
**Warning signs:** `undefined` in Cloudinary config, upload timeouts.

### Pitfall 5: Slug Collision on Update
**What goes wrong:** Updating a category name generates a slug that collides with an existing one.
**Why it happens:** Unique slug check does not exclude the current entity's own ID.
**How to avoid:** `uniqueSlug` function must accept an optional `excludeId` parameter to exclude the entity being updated from the collision check.
**Warning signs:** "Unique constraint violation" errors when editing names.

### Pitfall 6: Large CSV Files Blocking Event Loop
**What goes wrong:** A 5000-row CSV import blocks the Express event loop for seconds, making the API unresponsive.
**Why it happens:** Synchronous processing of all rows in a single tick.
**How to avoid:** Process in batches (e.g., 50 rows at a time with small delays), or use Prisma's `createMany` for batch inserts. For Phase 2 scale (initial catalog), synchronous processing is acceptable but should include a row limit (e.g., max 1000 rows per import).
**Warning signs:** API health check timeouts during CSV import.

### Pitfall 7: Prisma `count` and `findMany` Race Condition
**What goes wrong:** Total count differs from actual results because data changes between the two queries.
**Why it happens:** `count` and `findMany` are separate queries, not transactional by default.
**How to avoid:** Use `Promise.all([findMany, count])` for near-simultaneous execution. For this application's scale, the race window is negligible. If consistency is critical, wrap in `prisma.$transaction`.
**Warning signs:** Pagination shows "100 results" but only 99 entries exist.

## Code Examples

### Route Registration Pattern (create-app.ts)
```typescript
// Add to apps/api/src/create-app.ts
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { seriesRoutes } from './modules/series/series.routes';
import { categoriesRoutes } from './modules/categories/categories.routes';
import { tagsRoutes } from './modules/tags/tags.routes';
import { charactersRoutes } from './modules/characters/characters.routes';

// In createApp():
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/series', seriesRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/tags', tagsRoutes);
app.use('/api/v1/characters', charactersRoutes);
```

### Zod Schema for Catalog Entry (contracts)
```typescript
// packages/contracts/src/catalog.ts
import { z } from 'zod';

export const ApprovalStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const createCatalogEntrySchema = z.object({
  title: z.string().min(1).max(255).trim(),
  author: z.string().max(255).trim().optional(),
  publisher: z.string().max(255).trim().optional(),
  imprint: z.string().max(255).trim().optional(),
  barcode: z.string().max(50).trim().optional(),
  isbn: z.string().max(20).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  seriesId: z.string().cuid().optional(),
  volumeNumber: z.number().int().positive().optional(),
  editionNumber: z.number().int().positive().optional(),
  categoryIds: z.array(z.string().cuid()).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  characterIds: z.array(z.string().cuid()).optional(),
});

export const updateCatalogEntrySchema = createCatalogEntrySchema.partial();

export const catalogSearchSchema = z.object({
  title: z.string().optional(),
  publisher: z.string().optional(),
  seriesId: z.string().cuid().optional(),
  categoryIds: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).optional(),
  ),
  characterIds: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).optional(),
  ),
  sortBy: z.enum(['title', 'createdAt', 'averageRating']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateCatalogEntryInput = z.infer<typeof createCatalogEntrySchema>;
export type UpdateCatalogEntryInput = z.infer<typeof updateCatalogEntrySchema>;
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
```

### Taxonomy CRUD Schema (contracts)
```typescript
// packages/contracts/src/taxonomy.ts
import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createTagSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});
export const updateTagSchema = createTagSchema.partial();

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(2000).trim().optional(),
});
export const updateCharacterSchema = createCharacterSchema.partial();

export const createSeriesSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  totalEditions: z.number().int().positive(),
});
export const updateSeriesSchema = createSeriesSchema.partial();

// Shared types
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
```

### Test Pattern (following Phase 1 structure)
```typescript
// apps/api/src/__tests__/catalog/catalog-crud.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { request, loginAs, TEST_ADMIN } from '../setup';

describe('POST /api/v1/catalog', () => {
  let adminToken: string;

  beforeAll(async () => {
    const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
    adminToken = accessToken;
  });

  it('admin can create catalog entry', async () => {
    const res = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Batman: O Longo Dia das Bruxas',
        author: 'Jeph Loeb',
        publisher: 'Panini',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Batman: O Longo Dia das Bruxas');
    expect(res.body.data.approvalStatus).toBe('DRAFT');
  });

  it('unauthenticated user cannot create catalog entry', async () => {
    await request
      .post('/api/v1/catalog')
      .send({ title: 'Test' })
      .expect(401);
  });

  it('non-admin user cannot create catalog entry', async () => {
    const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);
    await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Test' })
      .expect(403);
  });
});
```

### CSV Export Pattern
```typescript
// In catalog.service.ts
import Papa from 'papaparse';

export async function exportToCSV(): Promise<string> {
  const entries = await prisma.catalogEntry.findMany({
    where: { approvalStatus: 'APPROVED' },
    include: {
      series: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      characters: { include: { character: true } },
    },
    orderBy: { title: 'asc' },
  });

  const rows = entries.map((entry) => ({
    title: entry.title,
    author: entry.author ?? '',
    publisher: entry.publisher ?? '',
    imprint: entry.imprint ?? '',
    barcode: entry.barcode ?? '',
    isbn: entry.isbn ?? '',
    description: entry.description ?? '',
    series: entry.series?.title ?? '',
    volumeNumber: entry.volumeNumber ?? '',
    editionNumber: entry.editionNumber ?? '',
    categories: entry.categories.map((c) => c.category.name).join('; '),
    tags: entry.tags.map((t) => t.tag.name).join('; '),
    characters: entry.characters.map((ch) => ch.character.name).join('; '),
    averageRating: entry.averageRating.toString(),
    ratingCount: entry.ratingCount,
  }));

  return Papa.unparse(rows);
}
```

### API Endpoint URL Design
```
# Taxonomy (CRUD)
GET    /api/v1/series                  # Public: list with pagination + search
GET    /api/v1/series/:id              # Public: detail with editions
POST   /api/v1/series                  # Admin: create
PUT    /api/v1/series/:id              # Admin: update
DELETE /api/v1/series/:id              # Admin: delete

GET    /api/v1/categories              # Public: list all
POST   /api/v1/categories              # Admin: create
PUT    /api/v1/categories/:id          # Admin: update
DELETE /api/v1/categories/:id          # Admin: delete

GET    /api/v1/tags                    # Public: list all
POST   /api/v1/tags                    # Admin: create
PUT    /api/v1/tags/:id                # Admin: update
DELETE /api/v1/tags/:id                # Admin: delete

GET    /api/v1/characters              # Public: list with pagination
POST   /api/v1/characters              # Admin: create
PUT    /api/v1/characters/:id          # Admin: update
DELETE /api/v1/characters/:id          # Admin: delete

# Catalog
GET    /api/v1/catalog                 # Public: search with filters + pagination
GET    /api/v1/catalog/:id             # Public: detail (approved only)
POST   /api/v1/catalog                 # Admin: create entry (starts as DRAFT)
PUT    /api/v1/catalog/:id             # Admin: update entry
DELETE /api/v1/catalog/:id             # Admin: delete entry

# Catalog Approval
PATCH  /api/v1/catalog/:id/submit      # Admin: DRAFT -> PENDING
PATCH  /api/v1/catalog/:id/approve     # Admin: PENDING -> APPROVED
PATCH  /api/v1/catalog/:id/reject      # Admin: PENDING -> REJECTED (with reason)

# Catalog Image
POST   /api/v1/catalog/:id/cover       # Admin: upload cover image (multipart)

# Catalog CSV
POST   /api/v1/catalog/import          # Admin: CSV import (multipart)
GET    /api/v1/catalog/export           # Admin: CSV export
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma fullTextSearch preview flag (MySQL) | fullTextSearch GA for MySQL in Prisma 6 | Prisma 6.0.0 | In Prisma 5.22 still needs preview flag; we avoid it by using `contains` filter instead |
| multer disk storage | multer memory storage + cloud upload | 2023+ | No temp files on server; direct buffer-to-cloud pipeline |
| Manual CSV string building | papaparse `unparse` | Stable since 2020 | Handles all CSV edge cases (quoting, escaping, special chars) |
| REST N+1 queries | Prisma `include` + `select` | Prisma 2+ | Single query loads relations; avoids waterfall API calls |

**Deprecated/outdated:**
- `multer-storage-cloudinary` (last updated 2021): Still functional but uses older Cloudinary SDK patterns. Prefer manual `cloudinary.v2.uploader.upload_stream` for more control.
- Prisma `middleware` for slug generation: Replaced by Prisma Client Extensions in Prisma 4.7+. For this project, a simple utility function is sufficient and more explicit.

## Open Questions

1. **Cloudinary Account Setup**
   - What we know: Cloudinary free tier provides 25 monthly transformations and 25GB storage, sufficient for initial catalog.
   - What's unclear: Whether the user has a Cloudinary account. Need CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars.
   - Recommendation: Add Cloudinary env vars to `.env.example`. For dev/test, implement a mock/skip mode that accepts image metadata without actually uploading. The cover image upload route should work without Cloudinary configured (just skip the upload and leave `coverImageUrl` null).

2. **Initial Seed Data Scope**
   - What we know: STATE.md mentions "Initial catalog seed data (Panini Brasil, Mythos, Devir titles) source and scope not yet defined" as a concern.
   - What's unclear: How many seed entries are expected, and what source data format.
   - Recommendation: Seed basic taxonomy (5-10 categories like "Super-heroi", "Manga", "Terror"; 5-10 popular characters; 3-5 publishers as series) but defer large catalog seeding to CSV import. Provide a sample CSV template in the seed script output.

3. **CATL-08 Price Range and Condition Filters**
   - What we know: The requirement says "Search with combined filters: publisher, character, series, category, price range, condition, year". However, `CatalogEntry` has no `price` or `condition` fields -- those belong to `CollectionItem` (Phase 3).
   - What's unclear: Whether price/condition filters should be implemented in Phase 2 or deferred to Phase 3 when CollectionItem exists.
   - Recommendation: Implement all filters that apply to `CatalogEntry` fields (publisher, character, series, category, year via createdAt). Defer price range and condition filters to Phase 3/4 when marketplace search is built on top of CollectionItem. Document this as a known scope boundary.

4. **CATL-10 Average Rating Display Without Reviews**
   - What we know: Reviews are Phase 7. Rating fields exist on CatalogEntry but will be 0/0 in Phase 2.
   - What's unclear: Should the UI show the rating component (with 0 stars) or hide it until reviews exist?
   - Recommendation: Display the rating component but show "No reviews yet" when ratingCount is 0. The component is already part of the catalog detail layout, so building it now (display-only) avoids rework in Phase 7.

5. **Cover Image Required vs Optional**
   - What we know: `coverImageUrl` is nullable in schema. CATL-01 lists cover image as a field.
   - What's unclear: Is cover image required for catalog entry creation or optional?
   - Recommendation: Make cover image optional at creation but encourage it. The CSV import will likely not include images (just metadata). Images can be added via the separate `POST /catalog/:id/cover` endpoint after creation.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/prisma/schema.prisma` (all Phase 2 models verified)
- Existing codebase: `apps/api/src/modules/auth/auth.routes.ts`, `auth.service.ts` (route/service pattern)
- Existing codebase: `packages/contracts/src/common.ts` (pagination, response types)
- Existing codebase: `apps/api/src/shared/middleware/authorize.ts` (role authorization pattern)
- Existing codebase: `apps/api/src/__tests__/auth/signup.test.ts` (test pattern with setup)

### Secondary (MEDIUM confidence)
- [Prisma Full-Text Search Docs](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) - Confirmed fullTextSearch still needs preview flag in Prisma 5.22; GA only in Prisma 6
- [Prisma Filtering and Sorting Docs](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting) - `contains`, `startsWith`, relation filters verified
- [Cloudinary Node.js Upload](https://cloudinary.com/blog/guest_post/upload-images-to-cloudinary-with-node-js-and-react) - upload_stream API pattern verified
- [PapaParse npm](https://www.npmjs.com/package/papaparse) - Parse/unparse API, Node.js compatibility confirmed
- [slugify npm](https://www.npmjs.com/package/slugify) - CJS support, locale option for pt confirmed

### Tertiary (LOW confidence)
- multer-storage-cloudinary maintenance status (last npm publish date not verified directly)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already in the project; new libraries (multer, cloudinary, papaparse, slugify) are mature and widely used
- Architecture: HIGH - Following exact same patterns as Phase 1 modules; no new architectural decisions needed
- Pitfalls: HIGH - Based on direct analysis of the Prisma schema and existing code patterns; junction table and approval state machine pitfalls are well-documented
- Search/Filter: MEDIUM - Prisma `contains` filter is well-documented but performance at scale (10K+ entries) not yet validated; sufficient for initial catalog
- CSV Import: MEDIUM - papaparse is well-documented but batch processing strategy for very large files (5K+ rows) may need tuning

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, no fast-moving dependencies)
