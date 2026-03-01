---
phase: "07-community-and-notifications"
plan: "06"
subsystem: "favorites-ui"
tags: [favorites, ui, catalog-integration, heart-toggle, optimistic-update]
dependency_graph:
  requires: [favorites-api]
  provides: [favorites-ui, favorite-button-component, favorites-list-page]
  affects: [catalog-card, catalog-detail, nav-config, pt-BR-translations]
tech_stack:
  added: []
  patterns: [optimistic-update, auth-redirect-on-action, reusable-toggle-button]
key_files:
  created:
    - apps/web/src/lib/api/favorites.ts
    - apps/web/src/components/features/favorites/favorite-button.tsx
    - apps/web/src/components/features/favorites/favorites-list.tsx
    - apps/web/src/app/[locale]/(collector)/favorites/page.tsx
  modified:
    - apps/web/src/components/features/catalog/catalog-card.tsx
    - apps/web/src/components/features/catalog/catalog-detail.tsx
    - apps/web/src/messages/pt-BR.json
decisions:
  - "FavoriteButton uses optimistic UI update with revert on API error"
  - "Unauthenticated users are redirected to login page on favorite click instead of showing a modal"
  - "FavoriteButton checks initial state from API on mount when initialFavorited prop not provided"
  - "Favorites list page removes cards instantly on unfavorite with local state update"
metrics:
  completed_date: "2026-03-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
---

# Phase 07 Plan 06: Favorites UI Summary

FavoriteButton heart toggle with optimistic updates integrated into catalog cards and detail page, plus paginated favorites list page at /favorites with empty state and smooth removal.

## What Was Built

### API Client (`apps/web/src/lib/api/favorites.ts`)

Three functions wrapping the favorites API endpoints:

| Function | Endpoint | Description |
|----------|----------|-------------|
| `toggleFavorite(catalogEntryId)` | POST /api/v1/favorites/toggle | Toggle favorite, returns `{ favorited: boolean }` |
| `getUserFavorites({ page, limit })` | GET /api/v1/favorites | Paginated list of user's favorited catalog entries |
| `checkIsFavorited(catalogEntryId)` | GET /api/v1/favorites/check/:id | Check if a specific entry is favorited |

### FavoriteButton Component (`apps/web/src/components/features/favorites/favorite-button.tsx`)

Reusable heart icon toggle button with:

- **Optimistic updates**: toggles visual state immediately, reverts on API error
- **Auth check**: redirects unauthenticated users to `/login` on click
- **Initial state loading**: if `initialFavorited` prop not provided, queries API on mount (authenticated users only)
- **Size variants**: `sm` (16px icon, 32px button) and `md` (20px icon, 36px button)
- **Visual states**: filled red heart when favorited, outline muted heart when not (hover turns red)
- **Event bubbling prevention**: `stopPropagation` so card clicks don't trigger navigation
- **Accessibility**: `aria-label` in PT-BR ("Adicionar aos favoritos" / "Remover dos favoritos")
- **onToggle callback**: optional prop for parent components to react to state changes

### Favorites List Page (`apps/web/src/app/[locale]/(collector)/favorites/page.tsx`)

Protected route under `(collector)` layout group (RequireAuth):

- **Grid layout**: responsive 1-5 columns depending on viewport
- **Catalog entry cards**: cover image, title, author, publisher, star rating, series badge
- **Each card has FavoriteButton**: pre-initialized as `favorited=true`, unfavoriting removes card from list instantly
- **Pagination**: page numbers with Previous/Next buttons
- **Empty state**: Heart icon + message + "Explorar Catalogo" link button
- **Loading skeleton**: 10 placeholder cards during fetch

### Catalog Card Integration (`apps/web/src/components/features/catalog/catalog-card.tsx`)

- Replaced the placeholder Heart button with the real `FavoriteButton` component
- Positioned in the top-right action buttons overlay (visible on hover)
- Uses `bg-background/80 backdrop-blur-sm` for readability over cover images

### Catalog Detail Integration (`apps/web/src/components/features/catalog/catalog-detail.tsx`)

- Added `FavoriteButton` next to the entry title (size="md")
- Flexbox layout: title takes remaining space, heart button aligned to the right

### i18n Translations (`apps/web/src/messages/pt-BR.json`)

Added `favorites` section with all UI strings:
- title, addToFavorites, removeFromFavorites, empty, exploreCatalog, loadMore, count, error, removeError, previousPage, nextPage, pageOf

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm --filter web type-check` -- PASSED (zero errors)
- `pnpm --filter web build` -- PASSED (zero errors, /[locale]/favorites at 6.05 kB)
- FavoriteButton renders outline heart when not favorited, filled red heart when favorited
- FavoriteButton on catalog cards appears in hover overlay
- FavoriteButton on catalog detail page appears next to title
- /favorites page route created under (collector) layout with RequireAuth
- Empty state displays heart icon and catalog link
- All text uses next-intl translations in PT-BR

## Decisions Made

1. **Optimistic UI with revert**: FavoriteButton toggles visual state immediately for responsive feel, reverting only if the API call fails. This matches the pattern described in 07-02 (toggle endpoint).

2. **Auth redirect over modal**: When an unauthenticated user clicks the heart, they are redirected to `/login` rather than shown a login modal. This is consistent with the existing pattern used throughout the app.

3. **Initial state from API**: When `initialFavorited` is not provided as a prop, the button queries the API on mount to determine if the entry is favorited. This fires only for authenticated users to avoid unnecessary 401s.

4. **Local state removal on unfavorite**: In the favorites list page, unfavoriting removes the card from the local state immediately rather than re-fetching the page. This provides instant feedback.
