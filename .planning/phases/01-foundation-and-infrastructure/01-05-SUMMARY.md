---
phase: 01-foundation-and-infrastructure
plan: 05
subsystem: contracts
tags: [zod, typescript, validation, schemas, shared-types, monorepo]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm monorepo with @comicstrunk/contracts package scaffold
provides:
  - Zod auth schemas (signup, login, password reset request, password reset confirm)
  - Zod user profile schema with social handle sanitization
  - Common types (UserRole enum, ApiResponse wrappers, PaginatedResponse, paginationSchema)
  - TypeScript inferred types for all schemas (SignupInput, LoginInput, etc.)
  - AuthResponse and MessageResponse interfaces for API responses
  - UserProfile interface for user data
affects: [01-06, 01-07, 02-auth-endpoints, 02-auth-frontend, all-api-routes, all-form-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-inferred-types, shared-validation-schemas, password-schema-reuse, social-handle-sanitization]

key-files:
  created:
    - packages/contracts/src/auth.ts
    - packages/contracts/src/users.ts
    - packages/contracts/src/common.ts
  modified:
    - packages/contracts/src/index.ts
    - packages/contracts/package.json

key-decisions:
  - "Kept CJS build output (dist/) for contracts instead of direct TS consumption -- Node.js runtime requires compiled JS"
  - "Password schema extracted as reusable constant shared between signup and reset-confirm"
  - "Social handle transforms strip leading @ during Zod parse"
  - "Added exports field to package.json for explicit module resolution"

patterns-established:
  - "Zod-first types: define Zod schema, infer TypeScript type with z.infer -- no manual type duplication"
  - "Password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number -- shared between signup and password reset"
  - "API response wrappers: ApiSuccessResponse<T> and ApiErrorResponse discriminated union"
  - "Pagination: coerce string query params to numbers via z.coerce, with sensible defaults"

requirements-completed: [INFRA-10]

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 1 Plan 05: Shared Contracts Summary

**Zod validation schemas for auth (signup/login/password-reset), user profiles, and common types (UserRole, ApiResponse, pagination) shared between API and web via @comicstrunk/contracts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T22:37:46Z
- **Completed:** 2026-02-22T01:14:53Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Auth Zod schemas (signupSchema, loginSchema, resetPasswordRequestSchema, resetPasswordConfirmSchema) with password complexity validation and email normalization
- User profile schema (updateProfileSchema) with optional fields and social handle @ stripping
- Common types package: UserRole enum as single source of truth, ApiResponse discriminated union, PaginatedResponse with pagination metadata, paginationSchema with string-to-number coercion
- All three packages (contracts, api, web) type-check successfully with contracts imports
- Runtime verification: Node.js require() resolves all exports correctly, Zod parse validates/rejects as expected

## Task Commits

Each task was committed atomically:

1. **Task 1: Define auth schemas, user types, and common contracts** - `c2db2d5` (feat)

## Files Created/Modified
- `packages/contracts/src/auth.ts` - Auth Zod schemas (signup, login, password reset) with inferred types and response interfaces
- `packages/contracts/src/users.ts` - User profile update schema with social handle sanitization and UserProfile interface
- `packages/contracts/src/common.ts` - UserRole enum, ApiResponse/ApiErrorResponse/ApiSuccessResponse wrappers, PaginatedResponse, paginationSchema
- `packages/contracts/src/index.ts` - Barrel re-export of auth, users, common modules (plus existing CONTRACT_VERSION)
- `packages/contracts/package.json` - Added exports field for explicit module resolution

## Decisions Made
- **Kept CJS build output:** The plan suggested switching to direct TypeScript consumption (`main: "src/index.ts"`), but the established pattern from 01-01 compiles contracts to `dist/` for Node.js runtime compatibility. The API runs as `node dist/app.js` which requires compiled CJS. Kept `main: "dist/index.js"` and added an `exports` field instead.
- **Reusable password schema:** Extracted password validation regex rules into a shared `passwordSchema` constant reused by both signupSchema and resetPasswordConfirmSchema, avoiding duplication.
- **Social handle sanitization at parse time:** The `twitterHandle` and `instagramHandle` fields use Zod `.transform()` to strip leading `@` during validation, ensuring clean data storage regardless of user input format.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept CJS build output instead of direct TS consumption**
- **Found during:** Task 1 (package.json configuration)
- **Issue:** Plan specified `main: "src/index.ts"` for direct TypeScript consumption, but the API compiles to CJS and runs as `node dist/app.js`. Node.js cannot require `.ts` files at runtime.
- **Fix:** Kept `main: "dist/index.js"` and `types: "dist/index.d.ts"` from the 01-01 pattern, added `exports` field for explicit resolution
- **Files modified:** packages/contracts/package.json
- **Verification:** `node -e "require('@comicstrunk/contracts')"` succeeds from apps/api, all type-checks pass
- **Committed in:** c2db2d5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Maintains runtime compatibility established in 01-01. All contract schemas, types, and exports match the plan specification exactly. Only the package.json resolution strategy differs.

## Issues Encountered
None - plan executed smoothly after the package.json resolution strategy was adjusted.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- @comicstrunk/contracts is the single source of truth for validation schemas and TypeScript types
- Auth schemas ready for use in API auth endpoints (Phase 1 Plan 06/07)
- User profile schema ready for profile endpoints
- Common types (ApiResponse, PaginatedResponse) ready for all API route handlers
- Form validation schemas ready for web app forms via react-hook-form + @hookform/resolvers/zod

## Self-Check: PASSED

- All 5 created/modified files verified to exist on disk
- Commit c2db2d5 (Task 1) verified in git log

---
*Phase: 01-foundation-and-infrastructure*
*Completed: 2026-02-22*
