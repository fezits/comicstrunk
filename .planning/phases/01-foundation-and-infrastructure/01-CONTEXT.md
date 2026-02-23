# Phase 1: Foundation and Infrastructure - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Platform skeleton running in production on cPanel: monorepo scaffold (apps/api + apps/web + packages/contracts), full Prisma schema for all tables, cPanel deployment validated, JWT auth endpoints, i18n (PT-BR), responsive layout system, and dark/light theme. This is the foundation every subsequent phase builds on.

</domain>

<decisions>
## Implementation Decisions

### Theme & branding
- Dark & immersive vibe — deep backgrounds, collector's vault feel
- Purple dominant accent (#7C3AED range), blue as secondary accent
- Purple-to-blue gradients on primary UI elements (buttons, headers, hero sections)
- Dark mode is default; light mode available via toggle
- Theme choice persisted across sessions
- Follow PRD Section 7 design spec: sidebar nav for authenticated pages, centered card for public/auth pages, skeletons for loading, toasts for feedback, confirmation modals for destructive actions, badges for status, progress bars for series/goals

### Git workflow
- GitHub Issues created from plan tasks during execution
- Branch per issue from `develop` (e.g., `feature/01-monorepo-scaffold`)
- Commit to branch, create PR to `develop`, await review
- Pull `develop` after merge, create branch for next issue

### Deployment target
- comicstrunk.com is live on cPanel (currently empty Next.js stub)
- cPanel deployment is a go/no-go gate — validate before writing application code

### Claude's Discretion
- Font choice (something fitting the dark/immersive vibe — geometric or slightly technical)
- Exact color palette values for grays, surfaces, borders
- Spacing and typography scale
- Auth flow details (JWT storage strategy, token lifetimes, rate limiting thresholds)
- Database schema decisions (full upfront vs iterative migrations)
- Layout component architecture
- Sidebar navigation item ordering and grouping

</decisions>

<specifics>
## Specific Ideas

- "Dark & immersive" — feels like a collector's vault, not a generic dashboard
- Purple dominant with blue as supporting gradient color
- PRD Section 7 is the design source of truth (layout structure, navigation sections, feedback patterns)
- comicstrunk.com already deployed on cPanel — use as the production target

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-infrastructure*
*Context gathered: 2026-02-21*
