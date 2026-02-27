---
phase: 03-collection-management
plan: 03
subsystem: api
tags: [prisma, express, cloudinary, multer, transactions]

# Dependency graph
requires:
  - phase: 03-collection-management (plan 01)
    provides: Collection CRUD, CSV import/export, series progress, plan limit enforcement
provides:
  - getMissingEditions API endpoint for series progress missing editions
  - Photo upload/remove API endpoints with Cloudinary and local storage
  - Atomic $transaction wrapping in addItem and importCSV for plan limit enforcement
  - photoUrls Json field on CollectionItem model
affects: [03-collection-management, 04-marketplace]

# Tech tracking
tech-stack:
  added: []
  patterns: [prisma-interactive-transaction, cloudinary-photo-management]

key-files:
  created:
    - apps/api/prisma/migrations/20260223215544_add_collection_photo_urls/migration.sql
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/collection/collection.service.ts
    - apps/api/src/modules/collection/collection.routes.ts

key-decisions:
  - "BadRequestError for photo limit uses inline message string (no second details param) matching existing constructor signature"
  - "Migration marked as already applied since DB column existed from prior dist build"

patterns-established:
  - "Prisma interactive $transaction for atomic multi-step operations (plan limit check + create)"
  - "checkPlanLimit accepts Prisma.TransactionClient for reuse inside any transaction"

requirements-completed: [COLL-04, COLL-09, SERI-07]

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 3 Plan 03: Gap Closure (API Source Sync) Summary

**Added getMissingEditions, photo upload/remove endpoints, and atomic $transaction wrapping to close 3 verification gaps in collection API source**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T21:54:09Z
- **Completed:** 2026-02-23T22:00:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Synced TypeScript source with compiled dist: getMissingEditions, addPhoto, removePhoto now in source
- Wrapped addItem() and importCSV() in prisma.$transaction() for atomic plan limit enforcement
- Added photoUrls Json? field to CollectionItem Prisma schema with migration
- Added 3 new Express routes: GET /missing-editions/:seriesId, POST /:id/photos, DELETE /:id/photos/:photoIndex

## Task Commits

Each task was committed atomically:

1. **Task 1: Add photoUrls field to Prisma schema and create migration** - `aca2ff4` (chore)
2. **Task 2: Add getMissingEditions, addPhoto, removePhoto to service + atomic $transaction wrapping** - `8538662` (feat)

## Files Created/Modified
- `apps/api/prisma/schema.prisma` - Added photoUrls Json? field to CollectionItem model
- `apps/api/prisma/migrations/20260223215544_add_collection_photo_urls/migration.sql` - ALTER TABLE for photo_urls column
- `apps/api/src/modules/collection/collection.service.ts` - Added getMissingEditions, addPhoto, removePhoto; refactored checkPlanLimit for tx; wrapped addItem/importCSV in $transaction
- `apps/api/src/modules/collection/collection.routes.ts` - Added 3 new routes for missing editions and photo management

## Decisions Made
- BadRequestError for photo limit uses single message string instead of second details parameter (constructor only accepts message)
- Migration marked as already applied via `prisma migrate resolve` since the photo_urls column already existed in DB from prior dist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BadRequestError constructor call in addPhoto**
- **Found during:** Task 2 (addPhoto function)
- **Issue:** Plan specified `BadRequestError(message, details)` with 2 args, but BadRequestError constructor only accepts 1 arg (message)
- **Fix:** Inlined the details into the error message string: `Maximum 5 photos per item allowed. Current: ${count}.`
- **Files modified:** apps/api/src/modules/collection/collection.service.ts
- **Verification:** `pnpm --filter api build` compiles with zero errors
- **Committed in:** 8538662 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial fix to match existing constructor signature. No scope creep.

## Issues Encountered
- Prisma migrate dev failed in non-interactive shell: used manual migration directory creation + `prisma migrate resolve --applied` instead
- DB column already existed from prior dist compilation: resolved by marking migration as applied

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 API-side verification gaps from 03-VERIFICATION.md are closed
- Source TypeScript now matches dist behavior for collection features
- Ready for Phase 4 (Marketplace and Orders) or additional Phase 3 gap closure (plan 04 for UI gaps)

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 03-collection-management*
*Completed: 2026-02-23*
