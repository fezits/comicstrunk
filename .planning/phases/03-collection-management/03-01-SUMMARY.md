---
phase: 03-collection-management
plan: 01
subsystem: api
tags: [prisma, express, cloudinary, transactions, collection, photos]

# Dependency graph
requires:
  - phase: 02-catalog-and-taxonomy
    provides: CatalogEntry model, Cloudinary upload/delete, upload middleware
provides:
  - Atomic collection limit enforcement via prisma.$transaction
  - Photo upload/delete endpoints for collection items
  - Missing editions endpoint for series completion tracking
  - Structured plan limit error data for frontend upgrade CTA
affects: [03-collection-management, 06-subscriptions]

# Tech tracking
tech-stack:
  added: []
  patterns: [interactive-prisma-transaction-for-atomicity, structured-error-details-on-BadRequestError]

key-files:
  created:
    - apps/api/prisma/migrations/20260223195255_add_collection_photo_urls/migration.sql
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/collection/collection.service.ts
    - apps/api/src/modules/collection/collection.routes.ts
    - packages/contracts/src/collection.ts
    - apps/api/src/shared/utils/api-error.ts
    - apps/api/src/shared/middleware/validate.ts

key-decisions:
  - "BadRequestError details typed as unknown to support both object and array payloads"
  - "Photo cleanup on removePhoto silently continues if Cloudinary/local deletion fails"
  - "photoUrls stored as Json? field set to Prisma.JsonNull when empty instead of empty array"

patterns-established:
  - "Atomic limit enforcement: prisma.$transaction wrapping count+create to prevent race conditions"
  - "Structured error details: BadRequestError accepts optional details for machine-readable error data"

requirements-completed: [COLL-01, COLL-02, COLL-03, COLL-04, COLL-07, COLL-08, COLL-09, SERI-05, SERI-07]

# Metrics
duration: 9min
completed: 2026-02-23
---

# Phase 3 Plan 01: Collection API Gaps Summary

**Atomic limit enforcement via $transaction, photo upload/delete endpoints, and missing editions API for series completion tracking**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-23T19:50:21Z
- **Completed:** 2026-02-23T20:00:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Collection `addItem` and `importCSV` now use `prisma.$transaction` for atomic limit enforcement, preventing race conditions on concurrent requests
- Photo upload (`POST /:id/photos`) and delete (`DELETE /:id/photos/:photoIndex`) endpoints with Cloudinary integration and max 5 photos per item
- Missing editions endpoint (`GET /missing-editions/:seriesId`) returns APPROVED catalog entries the user does not own
- Plan limit errors include structured metadata (`currentCount`, `limit`, `planType`) for frontend upgrade CTA
- `BadRequestError` updated to accept optional `details` parameter, propagated through error handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Add photoUrls field, atomic limit enforcement, photo and missing editions service** - `93025d7` (feat)
2. **Task 2: Add photo upload and missing editions API routes** - `aaa79b1` (feat)

## Files Created/Modified
- `apps/api/prisma/schema.prisma` - Added `photoUrls Json?` field to CollectionItem
- `apps/api/prisma/migrations/20260223195255_add_collection_photo_urls/migration.sql` - Migration for photoUrls column
- `apps/api/src/modules/collection/collection.service.ts` - Atomic transactions, addPhoto, removePhoto, getMissingEditions
- `apps/api/src/modules/collection/collection.routes.ts` - POST /:id/photos, DELETE /:id/photos/:photoIndex, GET /missing-editions/:seriesId
- `packages/contracts/src/collection.ts` - missingEditionsQuerySchema and MissingEditionsQuery type
- `apps/api/src/shared/utils/api-error.ts` - BadRequestError with details parameter
- `apps/api/src/shared/middleware/validate.ts` - Uses BadRequestError details constructor parameter

## Decisions Made
- BadRequestError `details` typed as `unknown` (not `Record<string, unknown>`) to support both object payloads (plan limit data) and array payloads (validation errors)
- Photo cleanup on `removePhoto` silently continues if Cloudinary/local file deletion fails -- prevents blocking the database update
- `photoUrls` set to `Prisma.JsonNull` when all photos removed, rather than storing an empty array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated BadRequestError and validate.ts for type compatibility**
- **Found during:** Task 1 (collection service refactoring)
- **Issue:** Adding `details: Record<string, unknown>` to BadRequestError broke validate.ts which passes an array of validation error objects
- **Fix:** Changed details type to `unknown` and updated validate.ts to use the constructor parameter instead of manual property assignment
- **Files modified:** apps/api/src/shared/utils/api-error.ts, apps/api/src/shared/middleware/validate.ts
- **Verification:** `pnpm --filter api build` and `pnpm type-check` pass
- **Committed in:** 93025d7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for type compatibility. No scope creep.

## Issues Encountered
- `pnpm build` (full monorepo) fails on web due to Windows EPERM on `.next/trace` file -- this is a pre-existing Windows development issue unrelated to this plan's changes. Contracts and API build successfully. `pnpm type-check` passes for all packages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All collection API gaps are closed: atomic limits, photo management, missing editions
- Frontend (Plan 02) can now build collection UI with photo upload, series completion tracking, and upgrade CTA on limit errors
- Existing collection endpoints (CRUD, read toggle, sale toggle, stats, CSV) continue to work unchanged

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (93025d7, aaa79b1) verified in git log.

---
*Phase: 03-collection-management*
*Completed: 2026-02-23*
