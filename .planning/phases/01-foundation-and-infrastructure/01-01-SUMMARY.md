---
phase: 01-foundation-and-infrastructure
plan: 01
subsystem: infra
tags: [pnpm, turborepo, typescript, monorepo, eslint, prettier, express, nextjs, tailwindcss]

# Dependency graph
requires: []
provides:
  - pnpm monorepo workspace with apps/* and packages/* layout
  - Turborepo build pipeline (build, dev, lint, type-check tasks)
  - Shared TypeScript base configuration (ES2022, strict, bundler resolution)
  - Express API skeleton at apps/api with health endpoint
  - Next.js 15 App Router skeleton at apps/web with Tailwind CSS 3.4
  - Shared contracts package at packages/contracts (@comicstrunk/contracts)
  - ESLint and Prettier root configuration
affects: [all-phases, 01-02, 01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: [pnpm@9.15.0, turbo@2.8.10, typescript@5.9.3, express@4.x, next@15.5.12, react@19.2.4, tailwindcss@3.4.x, zod@3.x, cors, helmet, cookie-parser, morgan, dotenv, tsx, autoprefixer, postcss]
  patterns: [pnpm-workspaces, turborepo-tasks, cjs-api-output, workspace-protocol-deps]

key-files:
  created:
    - pnpm-workspace.yaml
    - turbo.json
    - tsconfig.base.json
    - package.json
    - .eslintrc.json
    - .prettierrc
    - .npmrc
    - .gitignore
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/src/app.ts
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.ts
    - apps/web/postcss.config.mjs
    - apps/web/tailwind.config.ts
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - packages/contracts/package.json
    - packages/contracts/tsconfig.json
    - packages/contracts/src/index.ts
  modified: []

key-decisions:
  - "API and contracts compile to CommonJS for Node.js/Passenger runtime compatibility"
  - "Next.js standalone output disabled on Windows dev (symlink EPERM); will be enabled in cPanel plan (01-03)"
  - "Turborepo v2 uses 'tasks' field not 'pipeline' (research doc had outdated example)"
  - "Contracts package points main/types to dist/ (built CJS), not src/ (raw TS)"

patterns-established:
  - "Workspace dependency: use workspace:* protocol for @comicstrunk/contracts"
  - "API entry point: http.createServer(app).listen() for Passenger compatibility"
  - "TypeScript base config: extended by all packages via tsconfig.base.json"
  - "Build pipeline: contracts builds first (^build dependency), then api and web in parallel"

requirements-completed: [INFRA-02]

# Metrics
duration: 16min
completed: 2026-02-21
---

# Phase 1 Plan 01: Monorepo Scaffold Summary

**pnpm + Turborepo monorepo with three workspace packages (apps/api, apps/web, packages/contracts), shared TypeScript config, and full build pipeline passing**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-21T20:54:20Z
- **Completed:** 2026-02-21T21:10:28Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Working pnpm monorepo with Turborepo orchestration -- `pnpm install` and `pnpm build` succeed across all packages
- Express API skeleton with /health endpoint returning JSON (status, uptime, timestamp, contractVersion)
- Next.js 15 App Router skeleton with Tailwind CSS 3.4, rendering a placeholder page in PT-BR
- @comicstrunk/contracts package importable from both apps/api and apps/web, verified by type-check and runtime

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize monorepo root with pnpm workspaces and Turborepo** - `da219a6` (feat)
2. **Task 2: Create apps/api, apps/web, and packages/contracts skeleton packages** - `eb0d7c7` (feat)

## Files Created/Modified
- `pnpm-workspace.yaml` - Workspace definition (apps/*, packages/*)
- `turbo.json` - Turborepo task pipeline (build, dev, lint, type-check)
- `tsconfig.base.json` - Shared TypeScript compiler options (ES2022, strict, bundler)
- `package.json` - Root package with turbo scripts and devDependencies
- `.eslintrc.json` - Root ESLint config (eslint:recommended + @typescript-eslint)
- `.prettierrc` - Formatting rules (semi, singleQuote, trailing comma, tailwind plugin)
- `.npmrc` - pnpm settings (no shameful hoist, relaxed peer deps)
- `.gitignore` - Monorepo-appropriate ignore patterns
- `apps/api/package.json` - API package with Express, cors, helmet dependencies
- `apps/api/tsconfig.json` - API TypeScript config (CommonJS output)
- `apps/api/src/app.ts` - Express app with health endpoint and Passenger-compatible listen()
- `apps/web/package.json` - Web package with Next.js 15, React 19, Tailwind 3.4
- `apps/web/tsconfig.json` - Web TypeScript config with Next.js paths
- `apps/web/next.config.ts` - Next.js config (standalone output commented for Windows dev)
- `apps/web/postcss.config.mjs` - PostCSS with Tailwind and Autoprefixer
- `apps/web/tailwind.config.ts` - Tailwind config with darkMode: 'class'
- `apps/web/src/app/globals.css` - Tailwind CSS directives
- `apps/web/src/app/layout.tsx` - Root layout (html lang="pt-BR", suppressHydrationWarning)
- `apps/web/src/app/page.tsx` - Placeholder page importing CONTRACT_VERSION
- `packages/contracts/package.json` - Contracts package (@comicstrunk/contracts)
- `packages/contracts/tsconfig.json` - Contracts TypeScript config (CommonJS output)
- `packages/contracts/src/index.ts` - Barrel export with CONTRACT_VERSION constant

## Decisions Made
- **API outputs CommonJS:** The API tsconfig overrides the base config's ESNext module setting with CommonJS + node moduleResolution, ensuring `node dist/app.js` works on cPanel Passenger without ESM loader flags
- **Contracts package builds to dist/:** The `main` and `types` fields point to `dist/index.js` and `dist/index.d.ts` respectively, so runtime require() resolves compiled CJS. TypeScript still resolves types via declaration maps.
- **Standalone output deferred:** Next.js `output: 'standalone'` fails on Windows dev due to symlink permissions (EPERM). This is a cPanel deployment concern handled in Plan 01-03, not a scaffold blocker. Commented out with documentation.
- **Turborepo tasks vs pipeline:** Research doc referenced `pipeline` field which was renamed to `tasks` in Turborepo 2.0. Fixed during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Turborepo pipeline field renamed to tasks in v2**
- **Found during:** Task 2 (full build pipeline test)
- **Issue:** turbo.json used `pipeline` key from research examples, but Turborepo 2.x requires `tasks`
- **Fix:** Renamed `pipeline` to `tasks` in turbo.json
- **Files modified:** turbo.json
- **Verification:** `pnpm build` succeeds
- **Committed in:** eb0d7c7 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Express type inference error with pnpm strict isolation**
- **Found during:** Task 2 (API type-check)
- **Issue:** TS2742 error: inferred type of `app` cannot be named without @types/express-serve-static-core reference
- **Fix:** Added explicit `Express` type annotation to the app variable
- **Files modified:** apps/api/src/app.ts
- **Verification:** `pnpm --filter api type-check` passes
- **Committed in:** eb0d7c7 (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed API and contracts CJS output for Node.js runtime**
- **Found during:** Task 2 (API runtime test with `node dist/app.js`)
- **Issue:** Base tsconfig used ESNext module output; compiled JS files used import/export syntax which Node.js CJS loader rejected. Contracts package main pointed to src/index.ts (raw TypeScript) which Node cannot load at runtime.
- **Fix:** Set module: CommonJS + moduleResolution: node in both api and contracts tsconfigs. Changed contracts main/types to point to dist/ output.
- **Files modified:** apps/api/tsconfig.json, packages/contracts/tsconfig.json, packages/contracts/package.json
- **Verification:** `node apps/api/dist/app.js` starts successfully, health endpoint returns JSON
- **Committed in:** eb0d7c7 (Task 2 commit)

**4. [Rule 3 - Blocking] Disabled Next.js standalone output on Windows**
- **Found during:** Task 2 (full build pipeline test)
- **Issue:** `output: 'standalone'` in next.config.ts caused EPERM errors on Windows during symlink creation in the trace/copy phase
- **Fix:** Commented out standalone/outputFileTracingRoot config with documentation. Will be re-enabled in cPanel deployment plan (01-03).
- **Files modified:** apps/web/next.config.ts
- **Verification:** `pnpm build` succeeds for all packages
- **Committed in:** eb0d7c7 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes were necessary for correctness and runtime compatibility. No scope creep. The standalone output deferral is aligned with the plan's separation of concerns (scaffold in 01-01, cPanel deployment in 01-03).

## Issues Encountered
- pnpm not pre-installed on the system; resolved by enabling via corepack (`corepack prepare pnpm@9.15.0 --activate`)
- The research doc's turbo.json example used the deprecated `pipeline` field name; updated to `tasks` per Turborepo 2.x requirements

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo scaffold is complete and all packages build and type-check
- Ready for Plan 01-02 (Prisma schema), 01-03 (cPanel deployment), 01-05 (contracts expansion)
- The @comicstrunk/contracts package is ready to be expanded with Zod schemas and shared types
- Express API is ready for route registration and middleware setup
- Next.js web app is ready for page/component development with Tailwind CSS

## Self-Check: PASSED

- All 22 created files verified to exist on disk
- Commit da219a6 (Task 1) verified in git log
- Commit eb0d7c7 (Task 2) verified in git log

---
*Phase: 01-foundation-and-infrastructure*
*Completed: 2026-02-21*
