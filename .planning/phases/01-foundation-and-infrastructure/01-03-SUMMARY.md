---
phase: 01-foundation-and-infrastructure
plan: 03
subsystem: infra
tags: [cpanel, passenger, https, htaccess, deployment, standalone, mysql-backup, health-check]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm monorepo with Express API skeleton and Next.js web app
  - phase: 01-02
    provides: Prisma schema and MySQL migration for health check DB connectivity test
provides:
  - Express API configured for cPanel Passenger with Prisma health check endpoint
  - Next.js standalone output enabled conditionally (CI/STANDALONE env var)
  - Apache .htaccess HTTPS enforcement via rewrite rules
  - Deployment scripts for API and Web (Passenger restart via tmp/restart.txt)
  - MySQL backup script with 7-day retention for cPanel cron
  - Environment variable documentation (.env.example)
  - Prisma client singleton (shared/lib/prisma.ts)
affects: [01-04, 01-05, 01-06, 01-06b, 01-07, all-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [passenger-listen, htaccess-https-redirect, standalone-conditional-build, prisma-singleton, deploy-scripts]

key-files:
  created:
    - .env.example
    - apps/api/.htaccess
    - apps/api/src/shared/lib/prisma.ts
    - scripts/deploy-api.sh
    - scripts/deploy-web.sh
    - scripts/backup-db.sh
  modified:
    - apps/api/src/app.ts
    - apps/web/next.config.ts

key-decisions:
  - "Next.js standalone output enabled conditionally via CI or STANDALONE env var (avoids Windows symlink EPERM)"
  - "Prisma client singleton created in shared/lib for reuse across API modules"
  - "HTTPS enforcement handled by Apache .htaccess rewrite rules, not Express middleware"
  - "cPanel production deployment deferred to later validation -- local dev confirmed working"

patterns-established:
  - "Deployment: touch tmp/restart.txt to trigger Passenger process restart"
  - "Database backup: mysqldump with 7-day retention via cPanel cron"
  - "Health endpoint: GET /health tests both uptime and Prisma DB connectivity"
  - "Prisma singleton: import from shared/lib/prisma.ts for all database access"

requirements-completed: [INFRA-01, INFRA-04, INFRA-05, INFRA-06]

# Metrics
duration: 15min
completed: 2026-02-21
---

# Phase 1 Plan 03: cPanel Deployment Summary

**cPanel Passenger deployment configured with Prisma health check, Apache HTTPS enforcement, standalone Next.js build, and deployment/backup scripts for production readiness**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-21T21:30:00Z
- **Completed:** 2026-02-21T21:45:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Express API updated with Prisma health check (DB connectivity test) and /api/v1 route prefix for cPanel Passenger
- Next.js standalone output enabled conditionally (CI/STANDALONE env var) to work on both Windows dev and cPanel production
- Apache .htaccess HTTPS enforcement via rewrite rules (SSL termination at Apache, not Express)
- Deployment scripts for API and Web with Passenger restart workflow (touch tmp/restart.txt)
- MySQL backup script with mysqldump and 7-day retention for cPanel daily cron job
- Complete .env.example documenting all required environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure API and Web for cPanel Passenger deployment with health check and HTTPS** - `318ffff` (feat)
2. **Task 2: Verify cPanel deployment in production** - checkpoint approved by user (local development confirmed, cPanel deployment deferred)

## Files Created/Modified
- `.env.example` - Documents all required environment variables (DATABASE_URL, JWT secrets, URLs, NODE_ENV, PORT)
- `apps/api/.htaccess` - Apache rewrite rules enforcing HTTPS redirect (301)
- `apps/api/src/app.ts` - Updated with Prisma health check, trust proxy, /api/v1 prefix
- `apps/api/src/shared/lib/prisma.ts` - Prisma client singleton for reuse across API modules
- `apps/web/next.config.ts` - Standalone output enabled conditionally via CI/STANDALONE env var
- `scripts/deploy-api.sh` - API deployment: build, copy dist, Passenger restart
- `scripts/deploy-web.sh` - Web deployment: standalone build, static asset copy, Passenger restart
- `scripts/backup-db.sh` - MySQL backup via mysqldump with 7-day retention

## Decisions Made
- **Conditional standalone output:** Instead of always enabling `output: 'standalone'` (which fails on Windows due to symlink EPERM), it is enabled only when `CI` or `STANDALONE` env var is set. This allows local dev on Windows while supporting cPanel production builds.
- **Prisma singleton pattern:** Created `apps/api/src/shared/lib/prisma.ts` as the single import point for database access, preventing multiple Prisma Client instances in development hot-reload.
- **HTTPS at Apache layer:** HTTPS redirect is handled by `.htaccess` rewrite rules, not Express middleware, following cPanel best practices where Apache handles SSL termination.
- **Deferred production validation:** User confirmed local development setup is sufficient for now. MySQL is running locally. cPanel production deployment will be validated when the hosting environment is ready.

## Deviations from Plan

None - plan executed exactly as written. The checkpoint was approved by the user with the understanding that cPanel production validation is deferred to when the hosting environment is configured.

## Issues Encountered
None - local verification of health endpoint and standalone build configuration completed successfully.

## User Setup Required

**External services require manual configuration when deploying to cPanel.** The plan's `user_setup` section documents:
- MySQL database and user creation in cPanel
- Node.js application setup for API and Web in cPanel Node.js Selector
- Environment variables configuration (DATABASE_URL, JWT secrets, URLs)
- HTTPS via Let's Encrypt / AutoSSL
- Daily backup cron job registration

These steps are deferred until the cPanel hosting environment is ready.

## Next Phase Readiness
- API is configured for cPanel Passenger deployment with health check and /api/v1 prefix
- Prisma client singleton is ready for use in Plan 01-04 (Authentication API)
- Deployment scripts are ready for when cPanel hosting is provisioned
- All environment variables are documented in .env.example
- Ready for Plan 01-04 (Auth), 01-05 (Contracts), and 01-06 (Frontend config)

## Self-Check: PASSED

- All 8 created/modified files verified to exist on disk
- Commit 318ffff (Task 1) verified in git log
- Task 2 was a checkpoint:human-verify approved by user (no separate commit)

---
*Phase: 01-foundation-and-infrastructure*
*Completed: 2026-02-21*
