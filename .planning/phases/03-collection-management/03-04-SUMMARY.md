---
phase: 03-collection-management
plan: 04
subsystem: ui
tags: [react, next-intl, axios, photo-upload, plan-limits]

# Dependency graph
requires:
  - phase: 03-collection-management (plan 03)
    provides: Photo upload/remove API endpoints, atomic $transaction plan limit enforcement, photoUrls field
provides:
  - Plan-limit-specific error handling with upgrade CTA on collection add page
  - Photo upload/remove UI on collection item detail page
  - addPhoto() and removePhoto() web API client functions
  - photoUrls field on CollectionItem frontend type
  - i18n keys for plan limit messages and photo management
affects: [03-collection-management, 04-marketplace]

# Tech tracking
tech-stack:
  added: []
  patterns: [axios-error-discrimination, photo-grid-upload-ui]

key-files:
  created: []
  modified:
    - apps/web/src/lib/api/collection.ts
    - apps/web/src/app/[locale]/(collector)/collection/add/page.tsx
    - apps/web/src/app/[locale]/(collector)/collection/[id]/page.tsx
    - apps/web/src/messages/pt-BR.json

key-decisions:
  - "Plan limit detection uses axios error response status 400 + message.includes('Collection limit reached') pattern"
  - "Photo section only rendered in non-editing view to avoid layout conflicts with edit form"

patterns-established:
  - "Axios error discrimination: cast to typed error shape, check status + message for specific error handling"
  - "Photo grid with dashed-border upload tile: responsive grid with hover-to-delete overlay and file input label"

requirements-completed: [COLL-04, COLL-07]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 3 Plan 04: Gap Closure (Frontend Plan Limits + Photo UI) Summary

**Plan-limit-specific error toasts with upgrade CTA on add/import pages, and photo upload/remove grid UI on collection detail page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T22:04:50Z
- **Completed:** 2026-02-23T22:08:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Add page and import page now detect plan-limit errors (status 400 + "Collection limit reached") and show specific toast with upgrade suggestion instead of generic error
- Collection item detail page has full photo management: grid display of existing photos with hover-to-remove, dashed upload tile with Camera icon, 5-photo limit enforcement
- API client extended with addPhoto() and removePhoto() functions using FormData multipart upload
- CollectionItem frontend type includes photoUrls field for type-safe photo handling
- 10 new i18n keys added for plan limit and photo management strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plan limit error handling and photo API client functions** - `712eb71` (feat)
2. **Task 2: Add photo upload UI to collection item detail page** - `1f98233` (feat)

## Files Created/Modified
- `apps/web/src/lib/api/collection.ts` - Added photoUrls to CollectionItem type, addPhoto() and removePhoto() API client functions
- `apps/web/src/app/[locale]/(collector)/collection/add/page.tsx` - Plan-limit-specific error handling in handleSubmit and handleImport catch blocks
- `apps/web/src/app/[locale]/(collector)/collection/[id]/page.tsx` - Photo management section with grid display, upload tile, remove buttons, loading state
- `apps/web/src/messages/pt-BR.json` - 10 new i18n keys for plan limit messages and photo management labels

## Decisions Made
- Plan limit detection uses axios error response status 400 + message.includes('Collection limit reached') pattern for reliable backend error discrimination
- Photo section only rendered in non-editing view to avoid layout conflicts with the edit form

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend gaps from Phase 3 verification are now closed (COLL-04 photo UI, COLL-07 plan limit messages)
- Phase 3 Collection Management is fully complete
- Ready for Phase 4 (Marketplace and Orders)

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 03-collection-management*
*Completed: 2026-02-23*
