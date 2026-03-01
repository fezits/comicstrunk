---
phase: "07-community-and-notifications"
plan: "01"
subsystem: "reviews-api"
tags: [reviews, ratings, catalog, seller, api]
dependency-graph:
  requires: [prisma-schema, catalog-service, orders-service, contracts-common]
  provides: [reviews-api, catalog-rating-aggregation, seller-reviews]
  affects: [catalog-entry-average-rating, seller-profiles]
tech-stack:
  added: []
  patterns: [rating-aggregation-via-prisma-transaction, p2002-conflict-handling, seller-review-order-gate]
key-files:
  created:
    - packages/contracts/src/reviews.ts
    - apps/api/src/modules/reviews/reviews.service.ts
    - apps/api/src/modules/reviews/reviews.routes.ts
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/create-app.ts
decisions:
  - "Used paginationSchema (not full catalogReviewsQuerySchema) for GET route query validation since catalogEntryId/sellerId come from URL params"
  - "Seller reviews return averageRating and ratingCount alongside paginated reviews in a single response"
  - "getUserReviewForCatalog uses Prisma compound unique finder (userId_catalogEntryId) for efficient single-review lookup"
metrics:
  duration: "5m 17s"
  completed: "2026-03-01T02:58:51Z"
  tasks: 3/3
  files-created: 3
  files-modified: 2
---

# Phase 07 Plan 01: Reviews and Ratings API Summary

Reviews API with catalog review CRUD (1-5 stars, one per user per catalog entry), seller review creation gated by completed order status, and atomic averageRating/ratingCount aggregation on CatalogEntry via Prisma transactions.

## What Was Built

### Contracts (`packages/contracts/src/reviews.ts`)
- `createCatalogReviewSchema` -- catalogEntryId + rating (1-5) + optional text (max 2000 chars)
- `createSellerReviewSchema` -- sellerId + orderId + rating (1-5) + optional text
- `updateReviewSchema` -- optional rating and/or text with at-least-one-field refinement
- `catalogReviewsQuerySchema` and `sellerReviewsQuerySchema` -- pagination + entity ID for full-query use cases
- Exported types: `CreateCatalogReviewInput`, `CreateSellerReviewInput`, `UpdateReviewInput`, `CatalogReviewsQuery`, `SellerReviewsQuery`

### Service (`apps/api/src/modules/reviews/reviews.service.ts`)
- **`createCatalogReview`** -- verifies catalog entry exists and is APPROVED, catches P2002 for duplicate prevention, recalculates averageRating after creation
- **`createSellerReview`** -- validates order exists, buyer is the reviewer, order is COMPLETED, seller appears in order items, catches P2002 for duplicate prevention
- **`updateReview`** -- ownership check, updates rating/text, recalculates catalog rating if applicable
- **`deleteReview`** -- ownership check, deletes review, recalculates catalog rating if applicable
- **`getCatalogReviews`** -- paginated reviews with user name and avatar
- **`getSellerReviews`** -- paginated reviews plus aggregated averageRating and ratingCount
- **`getSellerAverageRating`** -- standalone seller rating summary
- **`getUserReviewForCatalog`** -- single review lookup via compound unique index
- **`recalculateCatalogRating`** -- helper that atomically recalculates averageRating and ratingCount using Prisma aggregate + update inside a transaction

### Routes (`apps/api/src/modules/reviews/reviews.routes.ts`)
7 endpoints mounted at `/api/v1/reviews`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /catalog/:catalogEntryId | Public | Paginated catalog reviews |
| GET | /seller/:sellerId | Public | Paginated seller reviews + average |
| GET | /catalog/:catalogEntryId/mine | Auth | User's own review for edit pre-fill |
| POST | /catalog | Auth | Create catalog review |
| POST | /seller | Auth | Create seller review (order-gated) |
| PUT | /:id | Auth | Update own review |
| DELETE | /:id | Auth | Delete own review |

### Route Mounting (`apps/api/src/create-app.ts`)
- Added `import { reviewsRoutes }` and `app.use('/api/v1/reviews', reviewsRoutes)` before error handler

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Query schema mismatch for GET routes**
- **Found during:** Task 3
- **Issue:** The plan specified using `catalogReviewsQuerySchema` and `sellerReviewsQuerySchema` for GET route query validation, but these schemas include `catalogEntryId`/`sellerId` fields. Since those values come from URL params (not query string), validation would fail on every request.
- **Fix:** Used `paginationSchema` for GET route query validation instead. The full query schemas are still exported from contracts for use in service-level or frontend validation where the entity ID is part of the payload.
- **Files modified:** `apps/api/src/modules/reviews/reviews.routes.ts`

## Verification Results

- Contracts build: PASSED
- API build: PASSED (exit code 0)
- Type-check: PASSED (no errors in reviews module; pre-existing error in notifications.service.ts is out of scope)
- All 7 endpoints correctly wired: catalog CRUD, seller create/list, user's own review lookup
- Rating aggregation uses $transaction for atomicity
- Seller review enforces: order exists, buyer match, COMPLETED status, seller in order items
- Duplicate reviews caught via P2002 -> ConflictError (409)
- Ownership checks on update/delete -> ForbiddenError (403)
