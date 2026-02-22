---
phase: 01-foundation-and-infrastructure
plan: 06
subsystem: ui
tags: [next-intl, next-themes, tailwindcss, shadcn-ui, i18n, dark-mode, space-grotesk, purple-theme]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 15 App Router skeleton with Tailwind CSS 3.4
  - phase: 01-03
    provides: Next.js standalone output configuration
  - phase: 01-05
    provides: @comicstrunk/contracts package with shared types and schemas
provides:
  - next-intl v4 PT-BR internationalization with routing, middleware, and message files
  - next-themes dark/light toggle with dark mode default and purple accent (#7C3AED)
  - Tailwind CSS 3.4 with purple primary and blue secondary CSS variables
  - shadcn/ui component library (14 components) with purple-themed CSS variables
  - Space Grotesk font loaded via next/font/google
  - Root layout with suppressHydrationWarning for next-themes
  - Locale layout with ThemeProvider, NextIntlClientProvider, and Toaster (sonner)
  - Purple-to-blue gradient utility classes for buttons and headers
  - 404 not-found page with PT-BR text
affects: [01-06b, 01-07, 02-auth-frontend, all-frontend-pages, all-forms]

# Tech tracking
tech-stack:
  added: [next-intl@4.8.3, next-themes@0.4.6, lucide-react@0.575.0, sonner@2.0.7, class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.5.0, tailwindcss-animate@1.0.7, @tailwindcss/typography@0.5.19, space-grotesk-font, react-hook-form@7.71.2, @hookform/resolvers@5.2.2, zod@3.23.0]
  patterns: [locale-routing-middleware, css-variable-theming, dark-mode-class-strategy, gradient-utility-classes, next-font-variable, provider-nesting-layout]

key-files:
  created:
    - apps/web/components.json
    - apps/web/src/styles/globals.css
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/request.ts
    - apps/web/src/messages/pt-BR.json
    - apps/web/src/middleware.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/[locale]/page.tsx
    - apps/web/src/app/not-found.tsx
    - apps/web/src/lib/utils.ts
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/card.tsx
    - apps/web/src/components/ui/input.tsx
    - apps/web/src/components/ui/label.tsx
    - apps/web/src/components/ui/form.tsx
    - apps/web/src/components/ui/toast.tsx
    - apps/web/src/components/ui/toaster.tsx
    - apps/web/src/components/ui/sheet.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/src/components/ui/dropdown-menu.tsx
    - apps/web/src/components/ui/avatar.tsx
    - apps/web/src/components/ui/separator.tsx
    - apps/web/src/components/ui/skeleton.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/hooks/use-toast.ts
  modified:
    - apps/web/next.config.ts
    - apps/web/package.json
    - apps/web/tailwind.config.ts
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "Space Grotesk chosen as primary font for geometric/technical aesthetic fitting the dark immersive vibe"
  - "next-intl v4 used (latest) instead of v3 per research -- API compatible with plan patterns"
  - "CSS variables use HSL format for shadcn/ui compatibility with purple primary (263 84% 55%) and blue secondary (217 91% 60%)"
  - "Sonner used for toasts instead of shadcn toast component -- positioned bottom-right with rich colors"
  - "Old globals.css moved from src/app/ to src/styles/ for cleaner separation"

patterns-established:
  - "Theme: dark mode default via ThemeProvider attribute='class' defaultTheme='dark'"
  - "i18n: single locale (pt-BR) with next-intl routing and middleware, dynamic message import"
  - "Layout nesting: RootLayout (html/body/font) > LocaleLayout (providers/toaster) > Page content"
  - "CSS variables: --primary: 263 84% 55% (purple), --secondary: 217 91% 60% (blue) in both light/dark"
  - "Gradient utilities: .gradient-primary, .gradient-primary-hover, .gradient-text for purple-to-blue effects"
  - "Component library: shadcn/ui new-york style with lucide icons, CSS variables enabled"

requirements-completed: [INFRA-07, INFRA-09]

# Metrics
duration: 13min
completed: 2026-02-22
---

# Phase 1 Plan 06: Frontend Configuration Summary

**Next.js 15 configured with next-intl v4 PT-BR i18n, next-themes dark/light toggle with purple accent (#7C3AED), Tailwind CSS 3.4 with custom CSS variables, and shadcn/ui component library (14 components) using Space Grotesk font**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-22T01:32:57Z
- **Completed:** 2026-02-22T01:46:21Z
- **Tasks:** 1
- **Files modified:** 31

## Accomplishments
- next-intl v4 fully configured with PT-BR routing, middleware, request config, and comprehensive message file covering common, nav, auth, theme, errors, home, and notFound namespaces
- Dark theme as default with purple primary (#7C3AED) and blue secondary accent via CSS variables in both light and dark modes, with purple-to-blue gradient utility classes
- shadcn/ui initialized with 14 essential components (button, card, input, label, form, toast, toaster, sheet, dialog, dropdown-menu, avatar, separator, skeleton, badge)
- Locale layout wraps all pages with NextIntlClientProvider, ThemeProvider, and Sonner Toaster
- Space Grotesk loaded via next/font/google as the primary font for geometric/technical aesthetic
- Build passes cleanly (`pnpm --filter web build` and `pnpm --filter web type-check` both succeed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Next.js with next-intl, next-themes, Tailwind, and shadcn/ui** - `a33ca0a` (feat)

## Files Created/Modified
- `apps/web/next.config.ts` - Updated with next-intl plugin integration
- `apps/web/package.json` - Added next-intl, next-themes, lucide-react, sonner, shadcn/ui dependencies
- `apps/web/tailwind.config.ts` - Extended with shadcn/ui colors, Space Grotesk font family, container config, typography plugin
- `apps/web/components.json` - shadcn/ui configuration (new-york style, lucide icons, CSS variables, path aliases)
- `apps/web/src/styles/globals.css` - Tailwind directives with purple/blue CSS variables for light and dark themes, gradient utilities
- `apps/web/src/i18n/routing.ts` - next-intl routing with pt-BR locale
- `apps/web/src/i18n/request.ts` - next-intl request config loading locale-specific messages
- `apps/web/src/messages/pt-BR.json` - PT-BR translations (common, nav, auth, theme, errors, home, notFound)
- `apps/web/src/middleware.ts` - next-intl middleware for locale routing with path matcher
- `apps/web/src/app/layout.tsx` - Root layout with Space Grotesk font, suppressHydrationWarning, PT-BR lang
- `apps/web/src/app/[locale]/layout.tsx` - Locale layout with ThemeProvider, NextIntlClientProvider, Sonner Toaster
- `apps/web/src/app/[locale]/page.tsx` - Home page using useTranslations with gradient title
- `apps/web/src/app/page.tsx` - Root page redirecting to default locale
- `apps/web/src/app/not-found.tsx` - 404 page with PT-BR text and gradient styling
- `apps/web/src/lib/utils.ts` - cn() utility (clsx + tailwind-merge)
- `apps/web/src/components/ui/*.tsx` - 14 shadcn/ui components (button, card, input, label, form, toast, toaster, sheet, dialog, dropdown-menu, avatar, separator, skeleton, badge)
- `apps/web/src/hooks/use-toast.ts` - Toast state management hook

## Decisions Made
- **Space Grotesk font:** Chosen for its geometric, slightly technical character fitting the dark immersive "collector's vault" vibe. Loaded via next/font/google CSS variable strategy for optimal performance and flexibility.
- **next-intl v4 (not v3):** The research suggested v3.x but pnpm installed v4.8.3 (latest). The API is compatible -- `defineRouting`, `createMiddleware`, and `getRequestConfig` all work as expected. No issues with Next.js 15 App Router.
- **Purple-to-blue gradient utilities:** Created `.gradient-primary`, `.gradient-primary-hover`, and `.gradient-text` utility classes in globals.css for consistent purple-to-blue gradient application across buttons and headers per CONTEXT.md design spec.
- **Sonner for toasts:** Used Sonner's Toaster component in the locale layout for toast notifications (shadcn/ui recommended). Positioned bottom-right with rich colors and close button.
- **CSS file relocation:** Moved globals.css from `src/app/` to `src/styles/` for cleaner file organization, since the locale layout imports it (not the root layout).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] next-intl v4 instead of v3**
- **Found during:** Task 1 (dependency installation)
- **Issue:** Plan specified next-intl 3.x per research, but pnpm installed v4.8.3 (latest stable). The v4 API has the same core functions (defineRouting, createMiddleware, getRequestConfig) but exports from slightly different paths.
- **Fix:** Used next-intl v4 API directly -- `getRequestConfig` from `next-intl/server`, `createNextIntlPlugin` from `next-intl/plugin`. All function signatures compatible.
- **Files modified:** apps/web/src/i18n/request.ts, apps/web/next.config.ts
- **Verification:** `pnpm --filter web build` succeeds, middleware routes correctly
- **Committed in:** a33ca0a (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused useMessages import**
- **Found during:** Task 1 (build verification)
- **Issue:** Initial locale layout imported `useMessages` from next-intl which was unused (messages loaded via dynamic import instead)
- **Fix:** Removed unused import to eliminate ESLint warning
- **Files modified:** apps/web/src/app/[locale]/layout.tsx
- **Verification:** Build warning resolved
- **Committed in:** a33ca0a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor version difference (next-intl v4 vs v3) with compatible API. No scope creep. All plan deliverables met.

## Issues Encountered
- shadcn/ui `init` command not compatible with `pnpm --filter` flag -- ran from apps/web directory directly instead
- shadcn/ui defaulted to `new-york` style and `neutral` base color instead of `default` style and `slate` -- acceptable since CSS variables are fully customized with purple theme

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend is fully configured for Plan 01-06b (layout system with sidebar, header, theme toggle)
- All shadcn/ui components available for building UI pages in Phase 2+
- i18n message structure ready for expansion (new namespaces can be added to pt-BR.json)
- Theme variables ready for consistent styling across all future components
- Form components (form, input, label) + react-hook-form + @hookform/resolvers ready for auth forms in Phase 2

## Self-Check: PASSED
