# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Comics Trunk is a Brazilian comic book collector platform (gibis, HQs, mangás) that combines collection management, a peer-to-peer marketplace, and community features. Monetization: affiliate links (primary), marketplace commissions (secondary), subscriptions (complementary).

## Monorepo Structure

- **pnpm 9.15.0** workspaces + **Turborepo** for task orchestration
- `apps/api` — Express backend (Node.js, MySQL via Prisma, JWT auth)
- `apps/web` — Next.js 15 frontend (React 19, Tailwind CSS, shadcn/ui, next-intl)
- `packages/contracts` — Shared Zod schemas + TypeScript types (single source of truth for API contract)

## Commands

```bash
# Root (runs all via Turborepo)
pnpm dev                # Start API (3001) + Web (3000) in parallel
pnpm build              # Build contracts → API → Web (dependency order)
pnpm lint               # Lint all packages
pnpm type-check         # TypeScript check all packages

# API
pnpm --filter api dev              # Dev server with watch (tsx)
pnpm --filter api build            # Compile to dist/
pnpm --filter api db:migrate       # Create/apply Prisma migration (dev)
pnpm --filter api db:migrate:deploy # Apply pending migrations (production)
pnpm --filter api db:seed          # Run seed script
pnpm --filter api db:studio        # Prisma Studio GUI
pnpm --filter api db:generate      # Regenerate Prisma client

# Web
pnpm --filter web dev              # Next.js dev server (port 3000)
pnpm --filter web build            # Next.js production build
pnpm --filter web lint             # ESLint

# Contracts (must build before API/Web can consume)
pnpm --filter contracts build      # Compile to dist/
```

**Important:** After changing `packages/contracts`, rebuild it before API or Web can see the changes.

## Architecture

### API (`apps/api`)

Module-based structure under `src/modules/{feature}/`:
- **Routes** (`*.routes.ts`) — Express router, validation middleware, calls service, returns via `sendSuccess`/`sendPaginated`
- **Services** (`*.service.ts`) — All business logic lives here. Orchestrates Prisma queries, applies rules
- **No separate repository layer yet** — services use Prisma client directly via `shared/lib/prisma.ts`

Shared infrastructure in `src/shared/`:
- `middleware/validate.ts` — Zod schema validation middleware
- `middleware/authenticate.ts` — JWT Bearer token extraction, attaches `req.user`
- `middleware/authorize.ts` — Role-based access control
- `middleware/error-handler.ts` — Catches `ApiError` subclasses, returns standardized JSON
- `utils/api-error.ts` — Error hierarchy: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`, `InternalError`
- `utils/response.ts` — `sendSuccess(res, data, status)`, `sendError(res, error, status)`, `sendPaginated(res, data, pagination)`
- `lib/jwt.ts` — Token generation/verification (15min access, 7-day refresh with token family rotation)

**Response format:**
```json
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
{ "success": false, "error": { "message": "...", "code": "...", "details": ... } }
```

**Auth pattern:** Access token (15min, Bearer header) + refresh token (7-day, httpOnly cookie at `/api/v1/auth/refresh`). Token family tracks refresh chain for reuse detection.

**Middleware stack order:** Helmet → CORS → JSON parser → Cookie parser → Morgan → Routes → Error handler (last)

### Web (`apps/web`)

Next.js App Router with locale-based routing (`/[locale]/...`):
- `(auth)/` — Login, signup, forgot-password, reset-password (public card layout)
- `(public)/` — Homepage
- `(admin)/` — Admin pages
- `(collector)/` — Collector pages
- `(orders)/` — Order pages
- `(seller)/` — Seller pages

Key patterns:
- **Auth:** `AuthProvider` context with `useAuth` hook. Access token in-memory (not localStorage). Axios interceptor handles 401 → silent refresh → retry
- **API calls:** Axios instance in `lib/api-client.ts` with base URL from `NEXT_PUBLIC_API_URL`. Always goes through service layer, never raw fetch in components
- **i18n:** next-intl with `pt-BR` as only locale. All UI strings via translation files, never hardcoded
- **Theming:** next-themes with dark (default) and light mode. Class-based dark mode in Tailwind
- **UI components:** shadcn/ui (Radix UI primitives + Tailwind) in `components/ui/`. Feature components in `components/features/`, layout in `components/layout/`

### Contracts (`packages/contracts`)

Exports Zod schemas and inferred TypeScript types consumed by both API and Web:
- `signupSchema`, `loginSchema`, `resetPasswordRequestSchema`, `resetPasswordConfirmSchema`
- `updateProfileSchema`, `paginationSchema`
- Types: `AuthUser`, `AuthResponse`, `UserProfile`, `UserRole`, `ApiSuccessResponse`, `ApiErrorResponse`, `PaginatedResponse`
- `CONTRACT_VERSION` — semver string for API/client compatibility

## Database

**MySQL** via **Prisma ORM**. Schema at `apps/api/prisma/schema.prisma`.

The schema is defined upfront for all 10 project phases to avoid destructive migrations. Naming: models PascalCase, fields camelCase, tables `@@map("snake_case")`, multi-word columns `@map("snake_case")`. Primary keys are CUIDs.

Key models implemented so far: `User`, `RefreshToken`, `PasswordReset`. Future models (CatalogEntry, CollectionItem, Order, Cart, etc.) are defined but not yet used in code.

## Code Style

- **Prettier:** Single quotes, semicolons, trailing commas, 2-space indent, 100 char width, Tailwind plugin
- **ESLint:** `@typescript-eslint/recommended`, unused vars warning (ignore `_` prefix)
- **TypeScript:** Strict mode, ES2022 target, declaration maps enabled

## Deployment

cPanel Passenger deployment via scripts in `scripts/`:
- `deploy-api.sh` — Build + copy to cPanel + restart Passenger
- `deploy-web.sh` — Build Next.js standalone + sync to cPanel
- `backup-db.sh` — Daily MySQL backup with rotation

Next.js standalone output is conditional (`STANDALONE=true` or CI) because Windows dev lacks symlink permissions.

## Environment Variables

Documented in `apps/api/.env.example`. Key vars:
- `DATABASE_URL` — MySQL connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — 64-byte hex strings (must differ)
- `WEB_URL` — Frontend URL (CORS origin)
- `NEXT_PUBLIC_API_URL` — API URL exposed to frontend
- `PORT` — API port (default 3001)
