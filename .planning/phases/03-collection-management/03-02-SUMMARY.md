---
phase: 03-collection-management
plan: 02
subsystem: ui
tags: [react, next-intl, catalog-detail, series-progress, missing-editions, collection-ux]

# Dependency graph
requires:
  - phase: 03-collection-management
    provides: Collection API with missing editions endpoint, photo upload, atomic limits
  - phase: 02-catalog-and-taxonomy
    provides: Catalog detail page, catalog search with filters
provides:
  - "Add to Collection" quick button on catalog entry detail page
  - Expandable missing editions panel on series progress cards
  - Frontend getMissingEditions API client function
  - Link from missing editions to catalog entry detail pages
affects: [04-marketplace-and-orders]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-loaded-expandable-panel, quick-add-from-detail-page]

key-files:
  created: []
  modified:
    - apps/web/src/components/features/catalog/catalog-detail.tsx
    - apps/web/src/components/features/collection/series-progress-card.tsx
    - apps/web/src/lib/api/collection.ts
    - apps/web/src/messages/pt-BR.json

key-decisions:
  - "Quick add button on catalog detail uses default values (qty 1, NEW condition) for fast workflow; 'Add with details' link provides full form"
  - "Series progress card shows missing editions lazily (fetched only on expand) to avoid N+1 queries on page load"
  - "Missing editions link to individual catalog detail pages, not to search results"

patterns-established:
  - "Lazy expandable panel: fetch data only on user interaction to prevent unnecessary API calls"
  - "Quick action + detailed action: provide both fast default action and detailed form option"

requirements-completed: [COLL-05, COLL-06, SERI-06]

# Metrics
duration: 10min
completed: 2026-02-23
---

# Phase 3 Plan 02: Collection UI Polish Summary

**Add-to-collection button on catalog detail, expandable missing editions on series progress cards, and requirement completion for CSV import/export and series progress page**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-23T20:07:40Z
- **Completed:** 2026-02-23T20:18:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Catalog entry detail page now has "Add to Collection" quick button (visible when authenticated) with duplicate detection and "Add with details" link
- Series progress cards now have an expandable missing editions panel that lazy-loads from the API
- Each missing edition displays cover thumbnail, title, and edition/volume numbers with link to catalog detail
- "Search in catalog" button on each series card links to catalog filtered by that series
- Frontend API client now includes `getMissingEditions` function and `MissingEdition` type
- Previously implemented features (CSV import/export, series progress page) formally marked as requirement-complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Add collection button on catalog detail and missing editions API client** - `9b0ca14` (feat)
2. **Task 2: Enhance series progress with expandable missing editions panel** - `b71fea6` (feat)

## Files Created/Modified
- `apps/web/src/components/features/catalog/catalog-detail.tsx` - Added "Add to Collection" button, "Add with details" link, auth-aware rendering
- `apps/web/src/components/features/collection/series-progress-card.tsx` - Rewritten with expandable missing editions panel, lazy loading, catalog links
- `apps/web/src/lib/api/collection.ts` - Added getMissingEditions function and MissingEdition type
- `apps/web/src/messages/pt-BR.json` - Added i18n strings for catalog add-to-collection and missing editions

## Decisions Made
- Quick add button on catalog detail uses default values (quantity 1, NEW condition) for fast workflow; "Add with details" link below provides the full form with all fields
- Missing editions are fetched lazily only when user expands the panel, preventing N+1 API calls when loading the series progress page with many series
- Missing editions link to individual catalog detail pages (where user can also add to collection) rather than to search results
- On 409 conflict (duplicate), button shows "already in collection" state instead of an error

## Deviations from Plan

None - no plan file existed; this plan was inferred from ROADMAP requirements and executed as needed.

## Issues Encountered
- No plan file (03-02-PLAN.md) existed in the phase directory. The plan was constructed from ROADMAP descriptions and remaining unfilled requirements (COLL-05, COLL-06, SERI-06) plus identified UX gaps (no add-to-collection on catalog detail, no missing editions display on series progress).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now complete: all collection management features (CRUD, read/sale status, photos, series progress, missing editions, CSV import/export, plan limits) are implemented with both API and frontend
- Phase 4 (Marketplace and Orders) can begin -- collection items can be marked for sale, which is the prerequisite for marketplace listings

## Self-Check: PASSED

All 4 modified files verified present. Both commit hashes (9b0ca14, b71fea6) verified in git log.

---
*Phase: 03-collection-management*
*Completed: 2026-02-23*
