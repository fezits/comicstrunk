---
phase: "07-community-and-notifications"
plan: "02"
subsystem: "comments-and-favorites-api"
tags: [comments, favorites, likes, community, api]
dependency_graph:
  requires: []
  provides: [comments-api, favorites-api, comment-likes, optional-authenticate-middleware]
  affects: [create-app, contracts-index, authenticate-middleware]
tech_stack:
  added: []
  patterns: [toggle-pattern, optional-authentication, one-level-nesting-enforcement]
key_files:
  created:
    - packages/contracts/src/comments.ts
    - packages/contracts/src/favorites.ts
    - apps/api/src/modules/comments/comments.service.ts
    - apps/api/src/modules/comments/comments.routes.ts
    - apps/api/src/modules/favorites/favorites.service.ts
    - apps/api/src/modules/favorites/favorites.routes.ts
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/create-app.ts
    - apps/api/src/shared/middleware/authenticate.ts
decisions:
  - "Used toggle pattern for both likes and favorites (check existence, create or delete)"
  - "Created optionalAuthenticate middleware for public comment listing with optional like-status enrichment"
  - "One nesting level enforced by checking parent.parentId at application layer"
  - "Comment deletion cascades replies in a transaction (deleteMany replies, then delete parent)"
  - "likesCount maintained via transactional increment/decrement alongside CommentLike create/delete"
metrics:
  completed_date: "2026-02-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 3
---

# Phase 07 Plan 02: Comments and Favorites API Summary

Comments API with CRUD, one-level reply nesting, and like toggle; Favorites API with toggle, list, and check -- all following established module patterns with Zod contract schemas.

## What Was Built

### Comments Module (5 endpoints)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/comments` | Required | Create comment or reply on a catalog entry |
| `PUT /api/v1/comments/:id` | Required | Edit own comment content |
| `DELETE /api/v1/comments/:id` | Required | Delete own comment (cascades replies) |
| `GET /api/v1/comments/catalog/:catalogEntryId` | Optional | Paginated top-level comments with nested replies |
| `POST /api/v1/comments/:id/like` | Required | Toggle like on a comment |

**Key behaviors:**
- Replies are limited to one nesting level -- attempting to reply to a reply returns 400
- Parent comment must belong to the same catalog entry as the new reply
- Only the comment author can edit or delete their comment (403 for others)
- GET returns `isLiked` boolean when user is authenticated (via `optionalAuthenticate` middleware)
- `likesCount` is maintained atomically via Prisma transactions alongside CommentLike records

### Favorites Module (3 endpoints)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/favorites/toggle` | Required | Add or remove a catalog entry from favorites |
| `GET /api/v1/favorites` | Required | Paginated list of user's favorited catalog entries |
| `GET /api/v1/favorites/check/:catalogEntryId` | Required | Check if a specific catalog entry is favorited |

**Key behaviors:**
- Toggle pattern: single endpoint creates or deletes the favorite
- Only APPROVED catalog entries can be favorited
- List returns catalog entry metadata (title, author, publisher, cover, rating, series)
- Ordered by most recently favorited first

### Contract Schemas

- `packages/contracts/src/comments.ts`: `createCommentSchema`, `updateCommentSchema`, `catalogCommentsQuerySchema` + types
- `packages/contracts/src/favorites.ts`: `toggleFavoriteSchema`, `favoritesQuerySchema` + types

### Infrastructure Addition

- `optionalAuthenticate` middleware added to `apps/api/src/shared/middleware/authenticate.ts` -- attaches user if valid Bearer token is present, otherwise continues without user. This is useful for public endpoints that optionally enrich responses for authenticated users.

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing functionality] Created optionalAuthenticate middleware**
- **Found during:** Task 2
- **Issue:** The GET comments endpoint needs to be public but also resolve the authenticated user for like status. No such middleware existed.
- **Fix:** Added `optionalAuthenticate` to `apps/api/src/shared/middleware/authenticate.ts` alongside the existing `authenticate` function.
- **Files modified:** `apps/api/src/shared/middleware/authenticate.ts`

### Minor Route Pattern Adjustments

The plan's original route structure suggested `GET /:catalogEntryId` for listing comments and individual endpoints like `POST /:catalogEntryId` and `DELETE /:id`. To avoid ambiguous path collisions between catalog entry IDs and comment IDs, the GET endpoint was placed at `/catalog/:catalogEntryId` (more explicit), and POST uses the body `catalogEntryId` field instead of a path parameter. This follows the same disambiguation pattern used in the collection module.

## Verification

- `pnpm --filter contracts build` -- PASSED (zero errors)
- `pnpm --filter api build` -- PASSED (zero errors)
- `pnpm type-check` -- PASSED (all 4 tasks: contracts, contracts build, api, web)

## Decisions Made

1. **Toggle pattern for likes and favorites**: Rather than separate add/remove endpoints, both use a single toggle endpoint that checks existence and creates or deletes accordingly. This simplifies frontend integration.

2. **Optional authentication middleware**: Created a reusable `optionalAuthenticate` middleware rather than inline logic. This can be reused by any future public endpoint that optionally enriches responses for authenticated users.

3. **Transaction-based likesCount**: The `likesCount` denormalized counter is updated in the same transaction as the CommentLike create/delete to prevent inconsistency. This avoids the need for a separate aggregation query on every read.

4. **Comment deletion cascades replies**: When a top-level comment is deleted, all its replies are deleted first in a transaction. CommentLike records cascade automatically via Prisma's onDelete: Cascade.

5. **Route path disambiguation**: Used `/catalog/:catalogEntryId` for the comment listing endpoint to avoid path collision with `/:id` routes (PUT, DELETE, POST like).
