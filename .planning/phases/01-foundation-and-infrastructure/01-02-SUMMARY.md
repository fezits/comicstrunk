---
phase: 01-foundation-and-infrastructure
plan: 02
subsystem: database
tags: [prisma, mysql, schema, migrations, seed, bcryptjs]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm monorepo workspace with apps/api package
provides:
  - Complete Prisma schema with 40 models covering all 10 phases
  - Initial MySQL migration (804 lines SQL)
  - Seed script for admin user and plan configurations
  - Commission configs for FREE and BASIC plans
  - Prisma Client generated and importable from @prisma/client
  - DB convenience scripts (migrate, seed, studio, generate)
affects: [01-03, 01-04, 01-05, 01-06, all-phases]

# Tech tracking
tech-stack:
  added: [prisma@5.22.0, @prisma/client@5.22.0, bcryptjs@3.0.3, @types/bcryptjs@3.0.0]
  patterns: [prisma-upfront-schema, cuid-primary-keys, snake-case-mapping, decimal-money-fields, idempotent-upsert-seeds]

key-files:
  created:
    - apps/api/prisma/schema.prisma
    - apps/api/prisma/seed.ts
    - apps/api/prisma/migrations/20260221212422_init/migration.sql
    - apps/api/prisma/migrations/migration_lock.toml
    - apps/api/.gitignore
  modified:
    - apps/api/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Prisma 5.22.0 pinned (not latest) for Node.js 20.9.0 compatibility — latest Prisma requires 20.19+"
  - "Migration generated via prisma migrate diff --from-empty (no live DB needed) with manual migrations directory structure"
  - "All 40 models defined upfront so no destructive migrations in future phases"
  - "Seed uses upsert with deterministic IDs for idempotent reruns"

patterns-established:
  - "All monetary fields: @db.Decimal(10, 2)"
  - "All commission rates: @db.Decimal(5, 4)"
  - "All average ratings: @db.Decimal(3, 2)"
  - "Primary keys: @id @default(cuid())"
  - "Timestamps: createdAt @default(now()), updatedAt @updatedAt on every model"
  - "Table mapping: @@map('snake_case') on every model"
  - "Column mapping: @map('snake_case') on multi-word field names"
  - "Junction tables: composite primary key @@id([fk1, fk2])"
  - "Cascade deletes on auth-related User children (RefreshToken, PasswordReset)"

requirements-completed: [INFRA-03]

# Metrics
duration: 12min
completed: 2026-02-21
---

# Phase 1 Plan 02: Prisma Schema Summary

**Complete 40-model Prisma schema for MySQL covering all 10 phases with initial migration and idempotent seed script for admin user and subscription plans**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-21T21:15:16Z
- **Completed:** 2026-02-21T21:27:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Complete Prisma schema with 40 models across 15 domain areas (auth, catalog, collection, cart, orders, payments, commissions, banking, subscriptions, community, notifications, deals, homepage, disputes, legal/LGPD/contact)
- Initial migration generated as 804 lines of MySQL DDL with all tables, indexes, unique constraints, and foreign keys
- Seed script creates admin user (admin@comicstrunk.com, ADMIN role) and plan configs (FREE: 50 items / 10% commission, BASIC: 200 items / 8% commission / R$14.90)
- Prisma Client generated successfully and importable

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the complete Prisma schema for all 10 phases** - `e4f69fe` (feat)
2. **Task 2: Generate initial migration and create seed script** - `4348607` (feat)

## Files Created/Modified
- `apps/api/prisma/schema.prisma` - Complete database schema (40 models, 16 enums, all relations/indexes/constraints)
- `apps/api/prisma/seed.ts` - Idempotent seed script (admin user + plan configs + commission configs)
- `apps/api/prisma/migrations/20260221212422_init/migration.sql` - Initial migration (804 lines MySQL DDL)
- `apps/api/prisma/migrations/migration_lock.toml` - Migration lock file (provider: mysql)
- `apps/api/.gitignore` - Excludes node_modules and .env
- `apps/api/package.json` - Added prisma/bcryptjs dependencies, seed config, db convenience scripts
- `pnpm-lock.yaml` - Updated lockfile with new dependencies

## Decisions Made
- **Prisma 5.22.0 instead of latest:** Latest Prisma (7.x) requires Node.js 20.19+, but the development environment has Node.js 20.9.0. Prisma 5.22.0 supports Node.js >= 16.13 and is fully functional for this project's needs.
- **Migration via prisma migrate diff:** Since no local MySQL database is guaranteed to be accessible during plan execution, used `prisma migrate diff --from-empty --to-schema-datamodel` to generate the migration SQL without requiring a database connection. The migrations directory was structured manually to match Prisma's expected format.
- **Deterministic seed IDs:** Plan configs and commission configs use deterministic IDs (e.g., `plan-free-monthly`, `commission-basic`) to enable idempotent upserts. The admin user uses email-based upsert.
- **bcryptjs over bcrypt:** Following research recommendation -- pure JS implementation works on cPanel shared hosting without native build toolchain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downgraded Prisma to 5.22.0 for Node.js 20.9.0 compatibility**
- **Found during:** Task 1 (Prisma installation)
- **Issue:** Latest Prisma (7.x) requires Node.js 20.19+ but the development environment has Node.js 20.9.0. Installation failed with "Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+"
- **Fix:** Pinned Prisma to 5.22.0 which supports Node.js >= 16.13
- **Files modified:** apps/api/package.json, pnpm-lock.yaml
- **Verification:** `pnpm --filter api exec prisma validate` passes
- **Committed in:** e4f69fe (Task 1 commit)

**2. [Rule 3 - Blocking] Used prisma migrate diff instead of prisma migrate dev for migration generation**
- **Found during:** Task 2 (Migration generation)
- **Issue:** `prisma migrate dev --create-only` still requires a database connection in Prisma 5.x, and local MySQL credentials didn't match
- **Fix:** Used `prisma migrate diff --from-empty --to-schema-datamodel` to generate SQL, then created the migrations directory structure manually
- **Files modified:** apps/api/prisma/migrations/20260221212422_init/migration.sql, apps/api/prisma/migrations/migration_lock.toml
- **Verification:** Migration SQL contains all 40 CREATE TABLE statements with correct column types and constraints
- **Committed in:** 4348607 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were necessary to work around environment constraints (Node.js version and database availability). The schema and migration output are functionally identical to what `prisma migrate dev` would produce. No scope creep.

## Issues Encountered
- Node.js 20.9.0 on the development machine is below Prisma 7.x's minimum of 20.19 -- resolved by pinning to Prisma 5.22.0
- Local MySQL database not accessible with default credentials during execution -- resolved by using `prisma migrate diff` for offline migration generation

## User Setup Required
None - no external service configuration required. When a MySQL database becomes available, run `prisma migrate deploy` to apply the migration and `prisma db seed` to seed initial data.

## Next Phase Readiness
- Schema is complete and ready for all future phases to build on
- Prisma Client is generated and importable -- ready for Plan 01-04 (Auth) to build auth service with User/RefreshToken/PasswordReset models
- Migration can be applied to any MySQL database with `prisma migrate deploy`
- The `@prisma/client` package exposes all 40 model types for type-safe queries

## Self-Check: PASSED

- All 7 created/modified files verified to exist on disk
- Commit e4f69fe (Task 1) verified in git log
- Commit 4348607 (Task 2) verified in git log

---
*Phase: 01-foundation-and-infrastructure*
*Completed: 2026-02-21*
