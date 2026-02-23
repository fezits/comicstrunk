---
phase: 02-catalog-and-taxonomy
plan: 01
subsystem: api
tags: [zod, contracts, cloudinary, multer, papaparse, slugify, schemas, validation]

# Dependency graph
requires:
  - phase: 01-foundation-and-infrastructure
    provides: "Contracts package structure, Prisma schema with catalog/taxonomy models, shared API infrastructure"
provides:
  - "Zod schemas for catalog entry create/update/search/approval/import"
  - "Zod schemas for series create/update/search"
  - "Zod schemas for category, tag, character CRUD"
  - "Cloudinary upload/delete helper with dev fallback"
  - "Multer middleware for image (5MB) and CSV (10MB) uploads"
  - "CSV parse/generate helpers via papaparse"
  - "Slug generation with Prisma collision detection"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

# Tech tracking
tech-stack:
  added: [cloudinary, multer, papaparse, slugify, "@types/multer", "@types/papaparse"]
  patterns: [comma-split-preprocess-for-query-params, graceful-dev-fallback-for-external-services, prisma-dynamic-model-access-via-unknown-cast]

key-files:
  created:
    - packages/contracts/src/catalog.ts
    - packages/contracts/src/series.ts
    - packages/contracts/src/taxonomy.ts
    - apps/api/src/shared/lib/cloudinary.ts
    - apps/api/src/shared/lib/csv.ts
    - apps/api/src/shared/middleware/upload.ts
    - apps/api/src/shared/utils/slug.ts
    - apps/api/.env.example
  modified:
    - packages/contracts/src/index.ts
    - apps/api/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Cloudinary returns empty URL/publicId when unconfigured (dev fallback, no crash)"
  - "Upload middleware uses RequestHandler type annotation for pnpm strict isolation TS2742 compat"
  - "Slug uniqueSlug uses unknown intermediate cast for Prisma dynamic model delegate access"
  - "CSV MIME filter accepts both text/csv and application/vnd.ms-excel plus .csv extension fallback"

patterns-established:
  - "Graceful external service fallback: check env vars at init, set configured flag, return safe defaults when unconfigured"
  - "Comma-separated query param preprocessing: z.preprocess splits comma-delimited strings into arrays for search filters"
  - "Explicit RequestHandler return type on multer factory functions to avoid TS2742 in pnpm strict isolation"

requirements-completed: [CATL-01, CATL-13, SERI-01]

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 2 Plan 1: Shared Schemas and API Utilities Summary

**Zod schemas for catalog/series/taxonomy validation plus Cloudinary, multer, CSV, and slug utilities for API shared infrastructure**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T17:57:52Z
- **Completed:** 2026-02-22T18:04:28Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created 16 Zod schemas across catalog, series, and taxonomy with full type inference exported from contracts
- Built Cloudinary upload helper with graceful dev fallback (no crash when env vars missing)
- Built multer middleware for image uploads (JPEG/PNG/WebP, 5MB) and CSV uploads (10MB) with memory storage
- Built CSV parse/generate helpers and slug generator with Prisma collision detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod schemas and types for catalog, series, and taxonomy** - `a427d8b` (feat)
2. **Task 2: Install dependencies and create shared API utilities** - `5293114` (feat)

## Files Created/Modified
- `packages/contracts/src/catalog.ts` - Catalog entry create/update/search/approval/import Zod schemas
- `packages/contracts/src/series.ts` - Series create/update/search Zod schemas
- `packages/contracts/src/taxonomy.ts` - Category, tag, character CRUD Zod schemas
- `packages/contracts/src/index.ts` - Barrel re-exports for new schema modules
- `apps/api/src/shared/lib/cloudinary.ts` - Cloudinary uploadImage/deleteImage with dev fallback
- `apps/api/src/shared/lib/csv.ts` - CSV parseCSV/generateCSV helpers using papaparse
- `apps/api/src/shared/middleware/upload.ts` - Multer middleware for image and CSV file uploads
- `apps/api/src/shared/utils/slug.ts` - Slug generation with Prisma collision detection
- `apps/api/.env.example` - Added Cloudinary env var placeholders
- `apps/api/package.json` - Added multer, cloudinary, papaparse, slugify dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Cloudinary returns empty URL/publicId when unconfigured rather than crashing, enabling local dev without Cloudinary credentials
- Upload middleware functions annotated with explicit `RequestHandler` return type to avoid TS2742 errors in pnpm strict isolation (same pattern as Phase 1 router exports)
- Slug `uniqueSlug` uses `unknown` intermediate cast for Prisma dynamic model delegate access, keeping type safety while supporting multiple models
- CSV MIME filter accepts both `text/csv` and `application/vnd.ms-excel` plus `.csv` extension fallback for broader compatibility
- Created `.env.example` since it was missing from the repo (plan referenced it but it didn't exist)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2352 type error in slug.ts Prisma delegate cast**
- **Found during:** Task 2 (slug utility creation)
- **Issue:** Direct cast of `prisma[model]` to `{ findFirst: ... }` failed TypeScript strict checks because Prisma delegate types don't overlap with Record-based signatures
- **Fix:** Used `unknown` intermediate cast with typed `SlugDelegate` interface and explicit `where` type
- **Files modified:** `apps/api/src/shared/utils/slug.ts`
- **Verification:** `pnpm --filter api type-check` passes
- **Committed in:** `5293114` (part of Task 2 commit)

**2. [Rule 1 - Bug] Fixed TS2742 inferred type error in upload.ts**
- **Found during:** Task 2 (multer middleware creation)
- **Issue:** Exported functions `uploadSingle` and `uploadCSV` had inferred return types referencing transitive pnpm dependencies (express-serve-static-core, qs) that TypeScript couldn't resolve
- **Fix:** Added explicit `RequestHandler` return type annotations to both functions
- **Files modified:** `apps/api/src/shared/middleware/upload.ts`
- **Verification:** `pnpm --filter api type-check` passes
- **Committed in:** `5293114` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs - TypeScript strict mode compatibility)
**Impact on plan:** Both auto-fixes necessary for type-check to pass. No scope creep.

## Issues Encountered
None beyond the auto-fixed type errors documented above.

## User Setup Required
None - Cloudinary env vars are optional for local development. Image uploads gracefully return empty URLs when unconfigured.

## Next Phase Readiness
- All contracts schemas ready for Plan 02 (taxonomy CRUD endpoints) and Plan 03 (series CRUD endpoints)
- Shared utilities ready for Plan 04 (catalog entry CRUD with image upload)
- CSV helpers ready for Plan 05 (catalog import/export)
- Slug generation ready for taxonomy entity creation

---
*Phase: 02-catalog-and-taxonomy*
*Completed: 2026-02-22*
