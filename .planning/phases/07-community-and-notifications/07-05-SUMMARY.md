---
phase: "07-community-and-notifications"
plan: "05"
subsystem: "reviews-comments-ui"
tags: [reviews, comments, star-rating, catalog-detail, community, ui]
dependency_graph:
  requires: [reviews-api, comments-api, catalog-detail-page]
  provides: [star-rating-component, review-form, review-list, comment-thread, seller-rating-summary]
  affects: [catalog-detail-page, pt-BR-translations]
tech_stack:
  added: []
  patterns: [optimistic-like-toggle, interactive-star-rating, paginated-comment-thread, inline-reply-form]
key_files:
  created:
    - apps/web/src/components/ui/star-rating.tsx
    - apps/web/src/lib/api/reviews.ts
    - apps/web/src/lib/api/comments.ts
    - apps/web/src/components/features/reviews/catalog-review-form.tsx
    - apps/web/src/components/features/reviews/catalog-review-list.tsx
    - apps/web/src/components/features/reviews/seller-review-form.tsx
    - apps/web/src/components/features/reviews/seller-rating-summary.tsx
    - apps/web/src/components/features/comments/comment-form.tsx
    - apps/web/src/components/features/comments/comment-item.tsx
    - apps/web/src/components/features/comments/comment-thread.tsx
  modified:
    - apps/web/src/app/[locale]/(public)/catalog/[id]/page.tsx
    - apps/web/src/messages/pt-BR.json
decisions:
  - "Created new reusable StarRating in components/ui/ with both display and interactive modes, separate from existing display-only catalog/star-rating.tsx"
  - "Used optimistic UI update for comment likes with revert-on-error pattern"
  - "Integrated reviews and comments as stacked sections below catalog detail rather than tabs for simpler UX and SEO"
  - "Comment replies limited to one nesting level with visual left-border indentation"
metrics:
  tasks: 3/3
  files-created: 10
  files-modified: 2
---

# Phase 07 Plan 05: Reviews and Comments UI Summary

Reusable interactive star rating component, catalog review form/list with create/edit/delete, comment thread with one-level nested replies and optimistic like toggle, seller review and rating summary -- all integrated into catalog detail page with PT-BR translations.

## What Was Built

### Reusable Star Rating Component (`components/ui/star-rating.tsx`)
- **Display mode** (interactive=false): renders filled, half-filled, and empty stars based on decimal rating value. Uses amber-500 color for filled stars.
- **Interactive mode** (interactive=true): clickable/hoverable stars with hover preview, calls onChange(1-5). Uses `role="radiogroup"` with individual star aria-labels for accessibility.
- **Three size variants**: sm (16px), md (20px), lg (24px).
- Accepts `maxStars`, `className` for flexibility.

### API Clients

**`lib/api/reviews.ts`** -- 7 functions matching the 07-01 API:
| Function | Endpoint |
|----------|----------|
| `createCatalogReview` | POST /reviews/catalog |
| `createSellerReview` | POST /reviews/seller |
| `updateReview` | PUT /reviews/:id |
| `deleteReview` | DELETE /reviews/:id |
| `getCatalogReviews` | GET /reviews/catalog/:id |
| `getSellerReviews` | GET /reviews/seller/:id |
| `getUserReviewForCatalog` | GET /reviews/catalog/:id/mine |

**`lib/api/comments.ts`** -- 5 functions matching the 07-02 API:
| Function | Endpoint |
|----------|----------|
| `createComment` | POST /comments |
| `updateComment` | PUT /comments/:id |
| `deleteComment` | DELETE /comments/:id |
| `getCatalogComments` | GET /comments/catalog/:id |
| `toggleCommentLike` | POST /comments/:id/like |

### Review Components

- **CatalogReviewForm**: Star rating input + textarea with character counter. Supports create mode ("Publicar Avaliacao") and edit mode ("Atualizar Avaliacao"). Delete with AlertDialog confirmation. Login prompt for unauthenticated users.
- **CatalogReviewList**: Shows average rating summary with StarRating display + review count. Renders user's own review form (auto-detects via getUserReviewForCatalog). Paginated list of reviews with avatar, name, star rating, date, text. "Carregar mais" button for pagination.
- **SellerReviewForm**: Star rating + textarea for rating sellers on completed orders. Designed for integration in order detail pages.
- **SellerRatingSummary**: Fetches seller average rating + recent reviews (up to 5). Shows StarRating display + review count + recent review cards. Ready for marketplace/seller profile integration.

### Comment Components

- **CommentForm**: Textarea with character counter (max 5000). Adapts label/placeholder based on whether it's a top-level comment or reply. Login prompt for unauthenticated users.
- **CommentItem**: Renders user avatar/name, comment text, timestamp. Like button with Heart icon and optimistic toggle (immediate UI change, revert on API error). Reply button opens inline CommentForm. Edit/Delete buttons for comment author only. Delete uses AlertDialog confirmation. Renders nested replies with left-border indentation.
- **CommentThread**: Fetches top-level comments with nested replies on mount. Shows comment count header with MessageSquare icon. CommentForm at top for new comments. Paginated list with "Carregar mais comentarios" button.

### Catalog Detail Page Integration

Added two new sections below the existing `CatalogDetail` component:
1. **Reviews section**: Star icon + "Avaliacoes" header + `CatalogReviewList` with the entry's averageRating and ratingCount
2. **Comments section**: `CommentThread` with the catalog entry ID

Sections are separated by horizontal separators for clean visual hierarchy.

### i18n Translations (PT-BR)

Added `reviews` key (18 translations) and `comments` key (16 translations) to `pt-BR.json`. All UI text uses `useTranslations()` -- no hardcoded strings.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `pnpm type-check`: PASSED (all 4 tasks: contracts, contracts build, api, web)
- `pnpm --filter web build`: PASSED (exit code 0)
- Catalog detail page compiles at 13.1 kB
- All 10 new component files created in correct directories
- All translations properly keyed under `reviews` and `comments` namespaces
- No unused imports or type errors
