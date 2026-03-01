---
phase: 03-collection-management
verified: 2026-02-23T23:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/12
  gaps_closed:
    - "COLL-04 (Photo upload) — POST /:id/photos and DELETE /:id/photos/:photoIndex now in source TypeScript routes and service; addPhoto/removePhoto in web API client; photo upload UI on detail page"
    - "SERI-07 (getMissingEditions) — GET /missing-editions/:seriesId route and getMissingEditions() service function now in source TypeScript"
    - "COLL-09 (Atomic limit enforcement) — addItem() and importCSV() both wrapped in prisma.$transaction(); checkPlanLimit() accepts TransactionClient"
    - "COLL-07 (Plan limit message) — add page and import page now discriminate 400 + 'Collection limit reached' errors and show specific planLimitMessage + planLimitUpgrade toast with 8s duration"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end plan limit message flow"
    expected: "User with 50 FREE-plan items tries to add item; sees 'Limite do plano atingido' toast with upgrade description, not generic 'Erro ao adicionar item'"
    why_human: "Requires a running API with 50-item account to trigger the 400 response and confirm the UI discrimination path executes correctly"
  - test: "Series progress missing editions expand panel"
    expected: "Clicking 'Show missing (N)' on a series card fetches and renders edition thumbnails linked to /catalog/:id detail pages"
    why_human: "Requires running API with real series data; previously broken in dev because endpoint was missing from source (now fixed, but needs functional confirmation)"
  - test: "Photo upload on collection item detail"
    expected: "Camera tile visible on non-editing view; selecting a JPEG/PNG/WebP uploads to Cloudinary and appends thumbnail to grid; hover-to-remove button deletes photo"
    why_human: "Requires Cloudinary credentials configured in API environment; multipart upload path can only be verified end-to-end"
---

# Phase 3: Collection Management Verification Report

**Phase Goal:** Authenticated users can build and manage their personal comic book collection, track reading progress, monitor series completion, and import/export data — making the platform worth returning to before the marketplace exists
**Verified:** 2026-02-23T23:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure via plans 03-03 and 03-04

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add a catalog entry with quantity, price, condition, notes; edit and remove it | VERIFIED | Full CRUD in source routes (lines 128-206) + service (addItem/updateItem/deleteItem); add/edit/delete pages implemented |
| 2 | User can mark copy as read (with reading date) and mark for sale with price | VERIFIED | PATCH /:id/read (line 251) + PATCH /:id/sale (line 269) in source routes; markAsRead/markForSale in service; UI dialogs wired |
| 3 | User can see series progress "15 of 42" and dedicated page with progress bars and missing editions linked to catalog | VERIFIED | getSeriesProgress endpoint (line 41) + SeriesProgressCard calls getMissingEditions (now exists at line 367 in source service, route at line 108 in source routes); links to /catalog/:id |
| 4 | User on FREE plan cannot add more than 50 copies and sees clear message with upgrade suggestion | VERIFIED | checkPlanLimit() in $transaction throws 'Collection limit reached'; add page handleSubmit catches status 400 + message match and shows planLimitMessage + planLimitUpgrade toast (8s) |
| 5 | User can download CSV template, import with error reporting, and export collection | VERIFIED | GET /csv-template, POST /import (with row-level errors array), GET /export — all in source; UI flows implemented |

**Score:** 5/5 truths verified

### Derived Observable Truths (from Requirements)

| # | Requirement | Truth | Status | Evidence |
|---|------------|-------|--------|----------|
| 1 | COLL-01 | Collection item CRUD with quantity, price, condition, notes | VERIFIED | Source routes + service implement full CRUD |
| 2 | COLL-02 | Mark copy as read with reading date | VERIFIED | markAsRead() sets readAt; PATCH /:id/read route in source |
| 3 | COLL-03 | Mark copy for sale with price | VERIFIED | markForSale() with commission calculation; PATCH /:id/sale in source |
| 4 | COLL-04 | Upload photos of copy | VERIFIED | addPhoto/removePhoto in source service.ts (lines 398-456); POST /:id/photos + DELETE /:id/photos/:photoIndex in source routes.ts (lines 208-249); addPhoto/removePhoto in web API client (lines 193-205); photo grid UI in collection/[id]/page.tsx (lines 494-552) |
| 5 | COLL-05 | Import collection via CSV with template download and error report | VERIFIED | importCSV() with row-level validation + errors array; getCSVTemplate(); UI import flow |
| 6 | COLL-06 | Export collection as CSV | VERIFIED | exportCSV() returns downloadable CSV; GET /export route |
| 7 | COLL-07 | Plan limit enforced with clear message and upgrade suggestion | VERIFIED | API throws 'Collection limit reached (N items for PLAN plan)'; add page discriminates by status 400 + message substring; shows t('planLimitMessage') + t('planLimitUpgrade') with 8s duration; same in import path |
| 8 | COLL-08 | Existing copies preserved on downgrade (only new blocked) | VERIFIED | checkPlanLimit only blocks new additions; deleteItem() only on explicit user action |
| 9 | COLL-09 | Atomic database operations for limit enforcement | VERIFIED | addItem() wrapped in prisma.$transaction() (line 70); importCSV() wrapped in prisma.$transaction() (line 473); checkPlanLimit accepts Prisma.TransactionClient (line 42-65) |
| 10 | SERI-05 | Series progress "N of M editions" display | VERIFIED | getSeriesProgress() groups by series; SeriesProgressCard shows collected/totalEditions |
| 11 | SERI-06 | Dedicated series progress page with progress bars | VERIFIED | /collection/series-progress page with SeriesProgressCard grid and Progress component |
| 12 | SERI-07 | Links from missing editions to catalog/search | VERIFIED | getMissingEditions() in source service.ts (line 367); GET /missing-editions/:seriesId in source routes.ts (line 108); SeriesProgressCard links each edition to /catalog/:id; "Search in catalog" button links to /catalog?seriesId= |

**Score:** 12/12 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/collection/collection.routes.ts` | All collection API routes | VERIFIED | All routes present: CRUD, read/sale, import/export/template, series-progress, missing-editions/:seriesId, photos POST/DELETE |
| `apps/api/src/modules/collection/collection.service.ts` | All service functions | VERIFIED | getMissingEditions, addPhoto, removePhoto added; addItem/importCSV wrapped in $transaction; checkPlanLimit uses TransactionClient |
| `apps/api/prisma/schema.prisma` | photoUrls Json? field on CollectionItem | VERIFIED | Line 427: photoUrls Json? @map("photo_urls") |
| `apps/api/prisma/migrations/20260223215544_add_collection_photo_urls/` | Migration file | VERIFIED | Migration directory exists; marked as applied via migrate resolve |
| `apps/web/src/app/[locale]/(collector)/collection/page.tsx` | Collection list page | VERIFIED | Renders items with filters, pagination, quick actions |
| `apps/web/src/app/[locale]/(collector)/collection/add/page.tsx` | Add + import page with plan limit handling | VERIFIED | handleSubmit and handleImport both discriminate 400 + 'Collection limit reached'; show specific planLimitMessage/planLimitUpgrade toast |
| `apps/web/src/app/[locale]/(collector)/collection/[id]/page.tsx` | Item detail/edit page with photo UI | VERIFIED | Full edit/read/sale/delete flows; Photos section (lines 494-552) with grid, upload tile, remove buttons; only shown in non-editing view |
| `apps/web/src/app/[locale]/(collector)/collection/series-progress/page.tsx` | Series progress page | VERIFIED | Renders SeriesProgressCard grid with API data |
| `apps/web/src/components/features/collection/series-progress-card.tsx` | Series progress card with missing editions | VERIFIED | Calls getMissingEditions() from API client; links to /catalog/:id; "Search in catalog" button |
| `apps/web/src/lib/api/collection.ts` | API client with all collection calls | VERIFIED | addPhoto() (line 193), removePhoto() (line 202) added; photoUrls in CollectionItem type (line 20); getMissingEditions() present |
| `apps/web/src/messages/pt-BR.json` | i18n keys for plan limit and photo management | VERIFIED | planLimitMessage, planLimitUpgrade, photos, addPhoto, removePhoto, photoUploading, photoAdded, photoRemoved, photoError, maxPhotos all present (lines 414-423) |
| `packages/contracts/src/collection.ts` | Zod schemas for collection | VERIFIED | All schemas: createCollectionItemSchema, updateCollectionItemSchema, markForSaleSchema, markAsReadSchema, collectionSearchSchema, collectionImportRowSchema, COLLECTION_LIMITS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `collection/page.tsx` | `/api/v1/collection` | `getCollectionItems()` | WIRED | Fetches on searchParams change, renders items |
| `collection/add/page.tsx` | `/api/v1/collection` (POST) | `addCollectionItem()` | WIRED | handleSubmit calls addCollectionItem; catches plan limit errors specifically |
| `collection/add/page.tsx` | plan-limit error toast | status 400 + message.includes('Collection limit reached') | WIRED | Lines 124-131: discriminates error, shows planLimitMessage + planLimitUpgrade |
| `collection/[id]/page.tsx` | `/api/v1/collection/:id` | `getCollectionItem()` + `updateCollectionItem()` + `deleteCollectionItem()` | WIRED | All CRUD operations wired |
| `collection/[id]/page.tsx` | `/api/v1/collection/:id/photos` | `addPhoto()` + `removePhoto()` | WIRED | handlePhotoUpload (line 202) calls addPhoto; handlePhotoRemove (line 219) calls removePhoto; both update item state |
| `series-progress/page.tsx` | `/api/v1/collection/series-progress` | `getSeriesProgress()` | WIRED | useEffect fetches on mount |
| `series-progress-card.tsx` | `/api/v1/collection/missing-editions/:seriesId` | `getMissingEditions()` | WIRED | handleToggleMissing (line 33) calls getMissingEditions; result rendered as edition links |
| `collection.routes.ts` (GET /missing-editions/:seriesId) | `collectionService.getMissingEditions` | direct call (line 113) | WIRED | Route passes req.user.userId + req.params.seriesId to service |
| `collection.routes.ts` (POST /:id/photos) | `uploadSingle` + `uploadImage` + `collectionService.addPhoto` | middleware chain (lines 208-228) | WIRED | uploadSingle processes file, uploadImage uploads to Cloudinary, addPhoto appends URL |
| `collection.routes.ts` (DELETE /:id/photos/:photoIndex) | `collectionService.removePhoto` | direct call (line 239) | WIRED | Route parses photoIndex integer, calls removePhoto |
| `collection.service.ts` addItem | `prisma.$transaction` + `checkPlanLimit(tx,...)` | $transaction wraps all (lines 70-108) | WIRED | Atomically: check catalog exists, check duplicate, checkPlanLimit, create |
| `collection.service.ts` importCSV | `prisma.$transaction` + `checkPlanLimit(tx, userId, rows.length)` | $transaction wraps all row processing (lines 473-538) | WIRED | Plan limit checked atomically before any rows inserted |
| `checkPlanLimit` | `tx.collectionItem.count` + `tx.subscription.findFirst` | TransactionClient parameter | WIRED | All Prisma calls inside use tx (lines 47-53) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| COLL-01 | 03-01 | Add copies with quantity, price, condition, notes | SATISFIED | createCollectionItemSchema + addItem() + add page |
| COLL-02 | 03-01 | Mark copy as read with reading date | SATISFIED | markAsRead() sets readAt; PATCH /:id/read route |
| COLL-03 | 03-01 | Mark copy for sale with price | SATISFIED | markForSale() returns commission; PATCH /:id/sale route |
| COLL-04 | 03-03, 03-04 | Upload photos of copy | SATISFIED | addPhoto/removePhoto in source service + routes; web API client; photo grid UI on detail page |
| COLL-05 | 03-01 | CSV import with template download and error report | SATISFIED | importCSV(), getCSVTemplate(), row validation with errors array |
| COLL-06 | 03-01 | Export collection as CSV | SATISFIED | exportCSV() returns full collection as downloadable CSV |
| COLL-07 | 03-04 | Plan limit with clear message and upgrade suggestion | SATISFIED | Add page discriminates 400 + 'Collection limit reached'; shows specific upgrade toast |
| COLL-08 | 03-01 | Existing copies preserved on downgrade | SATISFIED | checkPlanLimit only blocks new additions; no removal logic |
| COLL-09 | 03-03 | Atomic collection limit enforcement | SATISFIED | addItem() and importCSV() both use prisma.$transaction(); checkPlanLimit uses TransactionClient |
| SERI-05 | 03-01 | Series progress display "N of M" | SATISFIED | getSeriesProgress() groups by series; SeriesProgressCard shows collected/totalEditions |
| SERI-06 | 03-01, 03-02 | Dedicated series progress page with progress bars | SATISFIED | /collection/series-progress page with Progress component per card |
| SERI-07 | 03-02, 03-03 | Links from missing editions to catalog/search | SATISFIED | getMissingEditions() in source; edition links to /catalog/:id; "Search in catalog" to /catalog?seriesId= |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | All previously-identified blockers resolved |

No blocker anti-patterns detected in gap-closure files. The source/dist divergence (the root cause of 3 prior gaps) is resolved: source now matches dist behavior for getMissingEditions, photo upload/remove, and atomic transactions.

### Human Verification Required

**1. End-to-end plan limit message flow**

**Test:** Log in with a FREE account that already has exactly 50 collection items. Attempt to add one more from the add page.
**Expected:** Instead of "Erro ao adicionar item", the user sees a toast titled "Limite do plano atingido" with description "Voce atingiu o limite de itens do seu plano. Faca upgrade para o plano BASIC para adicionar ate 200 itens." displayed for 8 seconds.
**Why human:** The error discrimination path (status 400 + message.includes('Collection limit reached')) requires a live API call to a real 50-item account. The logic is code-verified but the conditional branch can only be confirmed with an actual API response.

**2. Series progress missing editions expand panel**

**Test:** Log in, add items from a series that has more editions (e.g., add volumes 1-3 of a 10-volume series), navigate to /collection/series-progress, click "Show missing (7)" on that series card.
**Expected:** Panel expands, skeleton loads briefly, then 7 edition rows appear — each with a thumbnail (or BookOpen fallback) and title, linked to /catalog/:id. A "Search in catalog" button appears below the list.
**Why human:** The getMissingEditions endpoint was previously missing from source and was the root cause of the SERI-07 gap. It is now in source, but functional confirmation requires a running API with catalog + series data.

**3. Photo upload on collection item detail page**

**Test:** Navigate to any collection item's detail page (/collection/:id). Verify a "Fotos" section appears below the catalog description. Click the Camera/dashed-border tile, select a JPEG image. Verify the thumbnail appears in the grid. Hover a thumbnail and click the X button to remove it.
**Expected:** Upload shows "Enviando foto..." during processing; on success shows "Foto adicionada!" toast and thumbnail in grid. Remove shows "Foto removida!" toast and thumbnail disappears. At 5 photos, tile is hidden and "Maximo de 5 fotos por item" text appears.
**Why human:** Requires Cloudinary credentials configured in the API environment (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Multipart upload to external service cannot be verified by static code analysis.

### Gaps Summary

No automated-verification gaps remain. All 4 previously identified gaps are closed:

1. **COLL-04 resolved:** Photo routes and service functions added to TypeScript source in commit 8538662 (API) and 1f98233 (frontend UI). Web API client extended in 712eb71.
2. **SERI-07 resolved:** getMissingEditions() and GET /missing-editions/:seriesId added to source TypeScript in commit 8538662. Frontend was already calling this correctly.
3. **COLL-09 resolved:** addItem() and importCSV() wrapped in prisma.$transaction() with checkPlanLimit() accepting TransactionClient in commit 8538662. No race condition remains.
4. **COLL-07 resolved:** Add page handleSubmit and handleImport now discriminate plan-limit errors (status 400 + 'Collection limit reached') and show specific upgrade CTA toast in commit 712eb71.

Three items remain for human verification due to requirements for a running API with real data (plan limits, series data, Cloudinary).

---

*Verified: 2026-02-23T23:00:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — initial gaps_found (9/12) → human_needed (12/12 automated)*
