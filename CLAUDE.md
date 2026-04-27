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

Module-based structure under `src/modules/{feature}/` — 31 modules:
admin, auth, banking, cart, catalog, categories, characters, collection, comments, commission, contact, cover-scan, cover-submissions, deals, disputes, favorites, homepage, legal, lgpd, marketplace, notifications, orders, payments, payouts, reviews, series, shipping, subscriptions, sync, tags, users

Each module contains:
- **Routes** (`*.routes.ts`) — Express router, validation middleware, calls service, returns via `sendSuccess`/`sendPaginated`
- **Services** (`*.service.ts`) — All business logic lives here. Orchestrates Prisma queries, applies rules
- Services use Prisma client directly via `shared/lib/prisma.ts`

Notable modules:
- **catalog** — Search matches words against title OR publisher OR author. Also handles JSON bulk import and sync endpoints
- **sync** — Remote catalog sync via HTTP (upsert by `sourceKey`, cover upload)
- **subscriptions** — Stripe integration with webhook handler (`stripe-webhook.routes.ts`)
- **payments** — PIX via pix-utils (static PIX, manual admin confirmation) with Mercado Pago as fallback. Webhook handler at `webhook.routes.ts`
- **collection** — Includes batch add (`POST /collection/batch`, up to 200 items per request). `addItem` accepts entries with status `PENDING`/`DRAFT` (only `REJECTED` blocked) — public catalog filters still require `APPROVED`
- **cover-scan** — Image-based catalog search. VLM (Llama 3.2 Vision via Cloudflare Workers AI) + textual search + external sources (MetronDB, Rika). Endpoints: `POST /search` (Phase 1, OCR fallback), `POST /recognize` (Phase 2 main), `POST /import` (creates PENDING entry from external source), `POST /choose` (telemetry). Logs in `cover_scan_logs` table. See "Cover Photo Scanner" section below.
- **cover-submissions** — User-uploaded covers awaiting admin approval (separate from cover-scan)

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
- `lib/cloudflare-ai.ts` — Cloudflare Workers AI client (Llama 3.2 Vision for cover recognition). Reads `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL`. Fail-open on errors.
- `lib/metron.ts` — MetronDB client (HTTP Basic Auth, rate-limited 20/min + 5000/day, in-memory LRU cache TTL 1h). Reads `METRON_USERNAME`/`METRON_PASSWORD`.
- `lib/rika.ts` — Rika BR scraper (VTEX `/api/catalog_system/pub/products/search`, throttled 200ms, in-memory cache).
- `lib/cloudinary.ts` — Image storage abstraction. **Currently uses Cloudflare R2** as primary (`r2Configured` check); Cloudinary kept as legacy fallback. Exports `uploadImage`, `localCoverUrl`, `LOCAL_API_BASE_URL`, `resolveCoverUrl`.

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
- `(collector)/` — Coleção, favoritos, notificações, assinatura, endereços, pagamentos, LGPD, carrinho, perfil, configurações, adicionar em lote, scan-capa (busca por foto)
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
- `CatalogEntry.sourceKey` — Internal dedup field (`rika:{id}`, `panini:{sku}`, `metron:{id}`, `gcd:{id}`), hidden from public API via Prisma `$extends`
- `CatalogEntry.coverImageUrl` — Can be NULL, external URL (Open Library, Metron static, etc.), or stored as `coverFileName` (resolved to R2 URL `covers.comicstrunk.com/covers/{filename}` via `resolveCoverUrl()`). Use `resolveCover()` in catalog.service.ts.
- `CatalogEntry.approvalStatus` — `DRAFT | PENDING | APPROVED | REJECTED`. **Public catalog queries (search, listings, series, marketplace) filter by `APPROVED`.** Personal collection (`addItem`) accepts everything except `REJECTED` since Phase 3 of cover-scan.
- `Series.slug` — URL-friendly unique slug
- `CoverScanLog` — One row per scan attempt. Fields: `userId`, `rawText` (VLM JSON response), `ocrTokens`, `candidateNumber`, `candidatesShown` (Json — `[{id, title, score, isExternal}]`), `chosenEntryId`, `durationMs`, `createdAt`. Used for rate limiting (30/day/user default) and analytics.
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
3. **ALWAYS follow the pre-deploy checklist** in `docs/DEPLOYMENT.md` section 0 before every deploy.
4. **ALWAYS test in production after deploy** — check HTTP status of homepage, catalog, collection, marketplace, and static CSS. Only communicate success after all tests pass.
5. **NEVER say "pronto" or "deployed" without testing first.**

**Web deploy steps (in order):**
1. Build contracts: `corepack pnpm --filter contracts build`
2. Build web: `CI=true NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1 corepack pnpm --filter web build` — verify "Compiled successfully" and NO "Type error"
3. Fix standalone: `node scripts/fix-standalone.js`
4. Copy build files into standalone (BUILD_ID, server/, static/, manifests, **required-server-files.json**)
5. **Verify `required-server-files.json` exists** in standalone — if missing, deploy will 503
6. **Replace server.js** with custom version from `docs/DEPLOYMENT.md` section 3 — verify first line is `const path = require("path")`
7. Send via tar+ssh
8. Symlink + restart (use `kill -9` if EADDRINUSE)
9. **Test all pages** — homepage, catalog, CSS, marketplace. If ANY returns non-200, investigate logs before communicating

## Catalog Sync & Import

The platform imports catalog data from external sources (Rika VTEX API + Panini). Currently synced categories: Super-heróis + Mangás (9.4k+). Pending: Bonelli, ETC, Infanto-Juvenis, Raridades.

Key field: `sourceKey` (format: `rika:{id}` or `panini:{sku}`) — used for dedup on import.

**Rika image gotcha:** Correct image is at `items[0].images[0].imageUrl`. Some images are placeholders ("IMAGEM INDISPONIVEL") — identified by md5 hash `37eadb1f86601aa2aff6e288a03a8fd9` (42169 bytes). These should be set to NULL.

**Import rules:**
- Always check duplicates by `sourceKey` AND by title+publisher before importing
- Generate list for user approval before bulk imports
- Create backup before any mass DB operation

**Image rules:**
- ALL cover images MUST be compressed before storing: max 600px width, JPEG quality 80
- **Storage primary: Cloudflare R2** (bucket `comicstrunk`, public domain `covers.comicstrunk.com`). Free 10GB, zero egress. Configure via `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. When configured, `uploadImage()` writes to R2 and `localCoverUrl()` returns R2 public URLs.
- **Storage fallback: local filesystem** at `apps/api/uploads/covers/` (legacy, only when R2 not configured).
- `downloadCover()` in `sync-catalog.ts` uses sharp for compression automatically
- Cron job also runs `mogrify -resize 600x> -quality 80` on images > 500KB
- Skip Rika placeholder images (42169 bytes / hash `37eadb1f86601aa2aff6e288a03a8fd9`)
- Never store external "IMAGEM INDISPONIVEL" images — set `cover_image_url = NULL` instead

## Cover Photo Scanner (busca por foto)

User uploads a comic cover photo, system identifies it via VLM and finds candidates.

**Architecture (3 phases, all live in production):**

1. **Phase 1 (legacy fallback):** OCR via Tesseract.js in browser → `POST /api/v1/cover-scan/search` does textual search against catalog. Kept available; rarely used now.
2. **Phase 2 (primary path):** Browser compresses photo to JPEG max 800px → base64 → `POST /api/v1/cover-scan/recognize` → server calls Cloudflare Workers AI (Llama 3.2 Vision) → parses structured JSON (`title, issue_number, publisher, authors, series, ocr_text, confidence`) → does textual search with must/boost token buckets + fuzzy stem (5-char prefix to match "absolute"↔"absoluta") + edition number filter (with regex fallback when VLM returns `null`).
3. **Phase 3 (federated external sources):** In parallel with Phase 2 textual search, `external-search.service.ts` queries MetronDB (US comics) + Rika (BR) via `Promise.allSettled`. External candidates are dedup'd against local catalog (title fuzzy + edition + publisher). External candidates marked `isExternal: true` and styled with amber dashed border in UI. Click on external triggers `POST /api/v1/cover-scan/import` → creates `CatalogEntry` with `approval_status='PENDING'`, downloads cover to R2, adds to user's collection.

**Sources & licensing:**
- **MetronDB** (`metron.cloud`) — CC BY-SA 4.0. Attribution "Powered by Metron" shown on `/scan-capa` page. HTTP Basic Auth via `METRON_USERNAME`/`METRON_PASSWORD`. Rate limit 20/min + 5000/day.
- **Rika** (`rika.com.br`) — VTEX scraping, no auth. Throttled 200ms between requests, identified User-Agent.
- ~~ComicVine~~ — non-commercial ToS, NEVER use in production.

**Cost (measured):** ~R$ 0,00075 per scan (Llama 3.2 Vision tokens). Volume B (15k/month) ≈ R$ 11/mês. Cloudflare free tier (10k neurons/day) covers most. Metron + Rika gratuitos.

**Constants:**
- `COVER_SCAN_DAILY_LIMIT` — env var, default 30. Rate limit per user per 24h.
- VLM model: `@cf/meta/llama-3.2-11b-vision-instruct` (override via `CLOUDFLARE_AI_MODEL`).
- Body parser limit for `/cover-scan/recognize` and `/cover-scan/import`: 5mb (default Express 100kb stoura images).

**Frontend:**
- Page: `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx`
- Component: `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` — reusable, also embedded in `/collection/add`
- Image compression utility: `apps/web/src/lib/utils/compress-image.ts` (Canvas API, max 800px JPEG q=80)

## PIX Payment

Static PIX via `pix-utils` library — generates BR Code + QR code locally without intermediary. Mercado Pago as optional fallback. Admin confirms payment manually via `/admin/payments`.

Environment vars: `PIX_KEY`, `MERCHANT_NAME`, `MERCHANT_CITY`

## Environment Variables

Documented in `apps/api/.env.example`. Key vars:
- `DATABASE_URL` — MySQL connection string (DB local: `comicstrunk` no Docker `comicstrunk-mysql`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — 64-byte hex strings (must differ)
- `WEB_URL` — Frontend URL (CORS origin)
- `NEXT_PUBLIC_API_URL` — API URL exposed to frontend
- `PORT` — API port (default 3001)
- **Image storage (Cloudflare R2 — primary):** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- **Image storage (Cloudinary — legacy fallback):** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Cloudflare Workers AI (cover scanner):** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (permission `Workers AI: Read+Edit`), `CLOUDFLARE_AI_MODEL` (default `@cf/meta/llama-3.2-11b-vision-instruct`)
- **Cover scan rate limit:** `COVER_SCAN_DAILY_LIMIT` (default 30 per user per 24h)
- **MetronDB (cover-scan external source):** `METRON_USERNAME`, `METRON_PASSWORD` (HTTP Basic Auth, free signup at `metron.cloud`)
- **Stripe (subscriptions):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **PIX payments:** `MERCADOPAGO_ACCESS_TOKEN` (optional fallback), `PIX_KEY`, `MERCHANT_NAME`, `MERCHANT_CITY`
- **Email:** `RESEND_API_KEY`

## Workflow Rules

- When superpowers skills are available, **always use them proactively** — brainstorming before features, writing-plans before implementation, systematic-debugging before fixes. Do not wait for the user to ask.
- Communicate in Portuguese (pt-BR) matching the user's language.
- Be cordial, not dry. The user is direct but expects politeness back.
