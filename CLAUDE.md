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

Module-based structure under `src/modules/{feature}/` — 29 modules:
admin, auth, banking, cart, catalog, categories, characters, collection, comments, commission, contact, deals, disputes, favorites, homepage, legal, lgpd, marketplace, notifications, orders, payments, reviews, series, shipping, subscriptions, sync, tags, users

Each module contains:
- **Routes** (`*.routes.ts`) — Express router, validation middleware, calls service, returns via `sendSuccess`/`sendPaginated`
- **Services** (`*.service.ts`) — All business logic lives here. Orchestrates Prisma queries, applies rules
- Services use Prisma client directly via `shared/lib/prisma.ts`

Notable modules:
- **catalog** — Search matches words against title OR publisher. Also handles JSON bulk import and sync endpoints
- **sync** — Remote catalog sync via HTTP (upsert by `sourceKey`, cover upload)
- **subscriptions** — Stripe integration with webhook handler (`stripe-webhook.routes.ts`)
- **payments** — PIX via pix-utils (static PIX, manual admin confirmation) with Mercado Pago as fallback. Webhook handler at `webhook.routes.ts`
- **collection** — Includes batch add (`POST /collection/batch`, up to 200 items per request)

Shared infrastructure in `src/shared/`:
- `middleware/validate.ts` — Zod schema validation middleware
- `middleware/authenticate.ts` — JWT Bearer token extraction, attaches `req.user`
- `middleware/authorize.ts` — Role-based access control
- `middleware/error-handler.ts` — Catches `ApiError` subclasses, returns standardized JSON
- `utils/api-error.ts` — Error hierarchy: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`, `InternalError`
- `utils/response.ts` — `sendSuccess(res, data, status)`, `sendError(res, error, status)`, `sendPaginated(res, data, pagination)`
- `utils/slug.ts` — Slug generation with uniqueness check (supports category, tag, character, catalogEntry, series)
- `lib/jwt.ts` — Token generation/verification (15min access, 7-day refresh with token family rotation)
- `lib/pix.ts` — Static PIX QR code generation via pix-utils (no intermediary)

**Response format:**
```json
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
{ "success": false, "error": { "message": "...", "code": "...", "details": ... } }
```

**Auth pattern:** Access token (15min, Bearer header) + refresh token (7-day, httpOnly cookie with `sameSite: lax` at `/api/v1/auth/refresh`). Token family tracks refresh chain for reuse detection.

**Middleware stack order:** Helmet → CORS → JSON parser → Cookie parser → Morgan → Routes → Error handler (last)

### Web (`apps/web`)

Next.js App Router with locale-based routing (`/[locale]/...`):
- `(auth)/` — Login, signup, forgot-password, reset-password (public card layout)
- `(public)/` — Homepage, catálogo, marketplace, séries, deals, contato, políticas legais
- `(admin)/` — Painel admin (catálogo, usuários, comissões, deals, disputas, legal, LGPD, pagamentos, assinaturas, homepage)
- `(collector)/` — Coleção, favoritos, notificações, assinatura, endereços, pagamentos, LGPD, carrinho, perfil, configurações, adicionar em lote
- `(orders)/` — Pedidos e disputas do comprador
- `(seller)/` — Dashboard do vendedor, pedidos, dados bancários, disputas

Key patterns:
- **Auth:** `AuthProvider` context with `useAuth` hook. Access token in-memory (not localStorage). Axios interceptor handles 401 → silent refresh → retry
- **API calls:** Axios instance in `lib/api-client.ts` with base URL from `NEXT_PUBLIC_API_URL`. Always goes through service layer, never raw fetch in components
- **i18n:** next-intl with `pt-BR` as only locale. All UI strings via translation files (`messages/pt-BR.json`), never hardcoded. **Translation keys must be ASCII** (no accents) — values can have accents
- **Theming:** next-themes with dark (default) and light mode. Class-based dark mode in Tailwind
- **UI components:** shadcn/ui (Radix UI primitives + Tailwind) in `components/ui/`. Feature components in `components/features/`, layout in `components/layout/`
- **View modes:** `ViewToggle` component (`components/ui/view-toggle.tsx`) supports grid/compact/list — used in collection page, reusable anywhere
- **Slugs:** CatalogEntry and Series have `slug` fields. All public links use slug (`/catalog/{slug}`, `/series/{slug}`). Detail pages redirect CUID URLs to slug via `router.replace`

### Contracts (`packages/contracts`)

Exports Zod schemas and inferred TypeScript types consumed by both API and Web. 28 contract modules covering all features.

Collection limits: `COLLECTION_LIMITS = { FREE: 1000, BASIC: 5000 }`

## Database

**MySQL** via **Prisma ORM**. Schema at `apps/api/prisma/schema.prisma`.

Naming: models PascalCase, fields camelCase, tables `@@map("snake_case")`, multi-word columns `@map("snake_case")`. Primary keys are CUIDs.

**Important fields:**
- `CatalogEntry.slug` — URL-friendly unique slug (generated via `shared/utils/slug.ts`)
- `CatalogEntry.sourceKey` — Internal dedup field (`rika:{id}` or `panini:{sku}`), hidden from public API via Prisma `$extends`
- `CatalogEntry.coverImageUrl` — Can be NULL, external URL (rika.vteximg.com.br), or local (`api.comicstrunk.com/uploads/covers/...`). Use `resolveCover()` in catalog.service.ts to build URL from `coverFileName` when `coverImageUrl` is NULL
- `Series.slug` — URL-friendly unique slug
- Prisma Decimal fields (`averageRating`, `totalAmount`, `salePrice`, etc.) serialize as objects in JSON — always use `Number()` when mapping to API responses

## Code Style

- **Prettier:** Single quotes, semicolons, trailing commas, 2-space indent, 100 char width, Tailwind plugin
- **ESLint:** `@typescript-eslint/recommended`, unused vars warning (ignore `_` prefix)
- **TypeScript:** Strict mode, ES2022 target, declaration maps enabled

## Local Development Environment

- **OS:** Windows 11, shell: Git Bash
- **pnpm:** NOT in PATH. Always use `corepack pnpm` instead of bare `pnpm`
- **Node:** via nvm4w at `C:\nvm4w\nodejs\`
- **Git:** user.email/name may not be configured globally. Check `git config user.email` before first commit in a session
- **MySQL:** Docker container `comicstrunk-mysql` (MySQL 8.0, port 3306, root:admin). Start with `docker start comicstrunk-mysql`

## Deployment

cPanel Passenger deployment via scripts in `scripts/`. Full guide: `docs/DEPLOYMENT.md`.

**CRITICAL RULES:**
1. **NEVER run `pnpm install`, `npm install` or `next build` on the production server.** Server has 1GB shared RAM. Always build locally.
2. **ALWAYS confirm with the user before any production operation** — show exact command, explain impact, ask permission.
3. Deploy scripts: `./scripts/deploy.sh api` and manual web deploy steps in `docs/DEPLOYMENT.md`.
4. Web build MUST include: `NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1`
5. **ALWAYS replace server.js after `fix-standalone.js`** — the generated server.js doesn't serve static files. The custom server.js in `docs/DEPLOYMENT.md` section 3 handles `/_next/static/`, `public/`, and `decodeURIComponent` for `[locale]` paths. Uses `fs.statSync().isFile()` to avoid EISDIR errors.

**Web deploy steps (in order):**
1. Build: `CI=true NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1 corepack pnpm --filter web build`
2. Fix standalone: `node scripts/fix-standalone.js`
3. Copy build files into standalone (BUILD_ID, server/, static/, manifests)
4. **Replace server.js** with custom version from docs/DEPLOYMENT.md section 3
5. Send via tar+ssh
6. Symlink + restart

## Catalog Sync & Import

The platform imports catalog data from external sources (Rika VTEX API + Panini). Currently synced categories: Super-heróis + Mangás (9.4k+). Pending: Bonelli, ETC, Infanto-Juvenis, Raridades.

Key field: `sourceKey` (format: `rika:{id}` or `panini:{sku}`) — used for dedup on import.

**Rika image gotcha:** Correct image is at `items[0].images[0].imageUrl`. Some images are placeholders ("IMAGEM INDISPONIVEL") — identified by md5 hash `37eadb1f86601aa2aff6e288a03a8fd9` (42169 bytes). These should be set to NULL.

**Import rules:**
- Always check duplicates by `sourceKey` AND by title+publisher before importing
- Generate list for user approval before bulk imports
- Create backup before any mass DB operation

## PIX Payment

Static PIX via `pix-utils` library — generates BR Code + QR code locally without intermediary. Mercado Pago as optional fallback. Admin confirms payment manually via `/admin/payments`.

Environment vars: `PIX_KEY`, `MERCHANT_NAME`, `MERCHANT_CITY`

## Environment Variables

Documented in `apps/api/.env.example`. Key vars:
- `DATABASE_URL` — MySQL connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — 64-byte hex strings (must differ)
- `WEB_URL` — Frontend URL (CORS origin)
- `NEXT_PUBLIC_API_URL` — API URL exposed to frontend
- `PORT` — API port (default 3001)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Image upload
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Subscriptions
- `MERCADOPAGO_ACCESS_TOKEN` — PIX payments (optional, pix-utils used by default)
- `PIX_KEY`, `MERCHANT_NAME`, `MERCHANT_CITY` — Static PIX configuration
- `RESEND_API_KEY` — Transactional emails

## Workflow Rules

- When superpowers skills are available, **always use them proactively** — brainstorming before features, writing-plans before implementation, systematic-debugging before fixes. Do not wait for the user to ask.
- Communicate in Portuguese (pt-BR) matching the user's language.
- Be cordial, not dry. The user is direct but expects politeness back.
