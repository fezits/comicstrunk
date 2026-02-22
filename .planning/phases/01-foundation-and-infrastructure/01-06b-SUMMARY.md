---
phase: 01-foundation-and-infrastructure
plan: 06b
subsystem: ui
tags: [layout, sidebar, header, theme-toggle, mobile-nav, route-groups, api-client, axios, responsive, next-themes]

# Dependency graph
requires:
  - phase: 01-06
    provides: next-intl i18n, next-themes, shadcn/ui components, Tailwind CSS purple theme, Space Grotesk font
  - phase: 01-04
    provides: JWT auth backend with refresh token rotation (API client targets these endpoints)
provides:
  - Responsive sidebar navigation on desktop (1024px+) with collapsible groups and active route highlighting
  - Header with purple-to-blue gradient, mobile hamburger trigger, theme toggle dropdown
  - Mobile navigation sheet (slides from left) with same nav structure, closes on navigation
  - Theme toggle dropdown with dark/light options and next-themes persistence
  - Six route groups scaffolded -- (public), (auth), (collector), (seller), (orders), (admin)
  - Auth layout with centered card pattern (no sidebar) for login/signup pages
  - Typed API client with axios interceptors for coordinated single token refresh on 401
  - Navigation configuration (nav-config.ts) with 5 groups and lucide-react icons
  - PT-BR translations for all navigation items and home page feature highlights
affects: [01-07, 02-auth-frontend, all-frontend-pages, all-authenticated-routes, all-admin-pages]

# Tech tracking
tech-stack:
  added: [axios@1.13.5]
  patterns: [sidebar-header-layout-shell, route-group-organization, api-client-token-refresh-coordination, collapsible-nav-groups, mobile-sheet-navigation]

key-files:
  created:
    - apps/web/src/components/layout/sidebar.tsx
    - apps/web/src/components/layout/header.tsx
    - apps/web/src/components/layout/theme-toggle.tsx
    - apps/web/src/components/layout/mobile-nav.tsx
    - apps/web/src/components/layout/nav-config.ts
    - apps/web/src/app/[locale]/(public)/layout.tsx
    - apps/web/src/app/[locale]/(public)/page.tsx
    - apps/web/src/app/[locale]/(auth)/layout.tsx
    - apps/web/src/app/[locale]/(collector)/layout.tsx
    - apps/web/src/app/[locale]/(seller)/layout.tsx
    - apps/web/src/app/[locale]/(orders)/layout.tsx
    - apps/web/src/app/[locale]/(admin)/layout.tsx
    - apps/web/src/lib/api/client.ts
  modified:
    - apps/web/package.json
    - apps/web/src/messages/pt-BR.json
    - pnpm-lock.yaml

key-decisions:
  - "Navigation organized into 5 groups (Explorar, Minha Colecao, Pedidos, Conta, Administracao) with lucide-react icons and collapsible sections"
  - "Admin nav group filtered out by default -- role-based visibility deferred to Phase 10"
  - "API client coordinates concurrent 401 refreshes with single promise pattern to prevent token rotation race conditions"
  - "Auth layout uses centered card (no sidebar/header) while all other route groups use sidebar+header shell"
  - "Landing page moved from [locale]/page.tsx to (public)/page.tsx route group with feature highlight cards"

patterns-established:
  - "Layout shell: Header (fixed top, h-16) + Sidebar (fixed left, w-64, hidden <lg) + main content (pt-16 lg:pl-64)"
  - "Route groups: (public)/(auth)/(collector)/(seller)/(orders)/(admin) -- groups don't add URL segments"
  - "Nav config: centralized nav-config.ts with NavGroup/NavItem types and lucide-react icons"
  - "Mobile nav: Sheet component from left side, same nav structure, closes on link click"
  - "API client: in-memory token, axios interceptors, coordinated single refresh promise"
  - "Header gradient: gradient-primary class (purple-to-blue) with white text/icons override"

requirements-completed: [INFRA-08]

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 1 Plan 06b: Frontend Layout System Summary

**Responsive layout shell with sidebar navigation on desktop, hamburger sheet on mobile, theme toggle dropdown, six route groups, and axios API client with coordinated token refresh interceptor**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T01:51:11Z
- **Completed:** 2026-02-22T01:59:43Z
- **Tasks:** 1
- **Files modified:** 17

## Accomplishments
- Responsive sidebar navigation with 5 collapsible groups (Explorar, Minha Colecao, Pedidos, Conta, Administracao) using lucide-react icons and active route highlighting via usePathname
- Header with purple-to-blue gradient background, mobile hamburger trigger, theme toggle dropdown (dark/light with next-themes persistence), and white text/icon override for gradient visibility
- Mobile navigation using shadcn/ui Sheet component that slides from left with identical nav structure, auto-closes on navigation
- Six route groups scaffolded: (public) and shared layouts use sidebar+header shell, (auth) uses centered card pattern per CONTEXT.md design spec
- API client with axios interceptors implementing coordinated single-promise token refresh to prevent race conditions on concurrent 401 responses
- Build passes cleanly (`pnpm --filter web build` and `pnpm --filter web type-check` both succeed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build responsive layout system with sidebar, header, route groups, and API client** - `5c8c3b9` (feat)

## Files Created/Modified
- `apps/web/src/components/layout/sidebar.tsx` - Desktop sidebar with collapsible nav groups, active route indication
- `apps/web/src/components/layout/header.tsx` - Fixed header with gradient, hamburger trigger, theme toggle
- `apps/web/src/components/layout/theme-toggle.tsx` - Dark/light dropdown using useTheme from next-themes
- `apps/web/src/components/layout/mobile-nav.tsx` - Sheet-based mobile navigation with same nav structure
- `apps/web/src/components/layout/nav-config.ts` - Centralized navigation configuration with NavGroup/NavItem types
- `apps/web/src/app/[locale]/(public)/layout.tsx` - Public route group with sidebar+header shell
- `apps/web/src/app/[locale]/(public)/page.tsx` - Landing page with hero and feature highlight cards
- `apps/web/src/app/[locale]/(auth)/layout.tsx` - Centered card layout for auth pages (no sidebar)
- `apps/web/src/app/[locale]/(collector)/layout.tsx` - Collector route group with sidebar+header shell
- `apps/web/src/app/[locale]/(seller)/layout.tsx` - Seller route group with sidebar+header shell
- `apps/web/src/app/[locale]/(orders)/layout.tsx` - Orders route group with sidebar+header shell
- `apps/web/src/app/[locale]/(admin)/layout.tsx` - Admin route group with sidebar+header shell
- `apps/web/src/lib/api/client.ts` - Typed API client with axios, token refresh interceptor, coordinated promise
- `apps/web/package.json` - Added axios dependency
- `apps/web/src/messages/pt-BR.json` - Expanded with sidebar nav translations and home feature texts
- `pnpm-lock.yaml` - Updated with axios dependency tree

## Decisions Made
- **Navigation grouping:** Organized into 5 groups matching CONTEXT.md sidebar spec: Explorar (Home, Marketplace, Deals), Minha Colecao (Collection, Series Progress, Favorites), Pedidos (Cart, My Orders), Conta (Profile, Settings, Notifications), Administracao (Dashboard, Catalog, Users, Content).
- **Admin group filtering:** Admin nav group is filtered out by default in sidebar and mobile nav. Role-based visibility will be added in Phase 10 when admin features are implemented.
- **Auth layout pattern:** Auth pages use a centered card layout with no sidebar/header, following CONTEXT.md "centered card for public/auth pages" design spec. All other route groups share the sidebar+header layout shell.
- **API client token refresh coordination:** Implemented single-promise pattern where the first 401 creates a refresh promise and all concurrent 401s await the same promise, preventing multiple refresh token rotations.
- **Landing page relocation:** Moved from `[locale]/page.tsx` to `(public)/page.tsx` route group. Added feature highlight cards (Catalogue, Acompanhe, Conecte-se) with lucide-react icons and card styling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale .next/types cache after page relocation**
- **Found during:** Task 1 (type-check verification)
- **Issue:** After moving `[locale]/page.tsx` to `(public)/page.tsx`, the `.next/types` directory still referenced the old page location, causing TypeScript errors.
- **Fix:** Removed `.next` directory to clear stale type cache. Subsequent type-check passed cleanly.
- **Files modified:** None (build artifact cleanup)
- **Verification:** `pnpm --filter web type-check` passes without errors
- **Committed in:** 5c8c3b9 (Task 1 commit -- the fix was clearing stale cache, no code change needed)

**2. [Rule 1 - Bug] Theme toggle invisible on gradient header in light mode**
- **Found during:** Task 1 (visual review of header implementation)
- **Issue:** ThemeToggle uses ghost variant button with default text color. In light mode, the dark text would be invisible against the purple-to-blue gradient header background.
- **Fix:** Added CSS selector override on the header's right-side container: `[&_button]:text-white [&_button]:hover:bg-white/10 [&_button]:hover:text-white` to force white icons on the gradient.
- **Files modified:** apps/web/src/components/layout/header.tsx
- **Verification:** Build passes, button text forced white in both themes
- **Committed in:** 5c8c3b9 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor cache cleanup and visual fix. No scope creep. All plan deliverables met.

## Issues Encountered
- The pre-existing ESLint warning about `actionTypes` in `use-toast.ts` (from Plan 06's shadcn/ui setup) persists in build output but is not a blocking issue -- it's a warning in a generated shadcn/ui file.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout shell is complete for all route groups -- Phase 2 auth UI can build login/signup pages inside (auth) group using the centered card layout
- Sidebar navigation ready for new pages as they are created in future phases
- API client ready for auth endpoints (login, signup, refresh) in Phase 2
- All shadcn/ui components (Sheet, Button, DropdownMenu, Separator, Skeleton) actively used in layout
- Theme toggle functional with persistence -- dark mode default per CONTEXT.md

## Self-Check: PASSED
