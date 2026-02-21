# Stack Research

**Domain:** Comics collector platform — marketplace + collection management (Brazil)
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH (Next.js 15 verified via official blog; most versions verified via official changelogs; some library recommendations based on current ecosystem knowledge with LOW-confidence flags where noted)

---

## Context

This stack serves a **monorepo with two decoupled apps**:

- `apps/api` — Node.js REST API (Express or Fastify)
- `apps/web` — Next.js frontend (App Router)

Deployment: **cPanel** (shared/VPS hosting — NOT Vercel, NOT Docker-native).
Database: **MySQL** (pre-decided).
Market: **Brazil** — PIX payments are the primary payment method, BRL currency, PT-BR interface, LGPD compliance required.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS | API runtime | LTS version with long support window. Node 22 is the active LTS (released 2024-04-24, LTS from 2024-10-29). Minimum required by Next.js 15 is 18.18.0. Use 22 for maximum support. Confidence: HIGH |
| Next.js | 15.x | Frontend framework | Stable as of October 2024. App Router is now production-ready. React 19 support, Turbopack dev stable, self-hosting improvements critical for cPanel. Confidence: HIGH (verified via official blog) |
| React | 19.x | UI library | Next.js 15 uses React 19 in App Router. Stable release. Confidence: HIGH |
| Express | 4.x | API framework | Battle-tested, minimal, massive ecosystem. Alternative is Fastify. For a greenfield project with a solo/small team on cPanel, Express 4 is the lowest-risk choice — every deployment tutorial, PM2 guide, and cPanel node.js setup uses it. Express 5 is in RC but not fully stable for production. Confidence: HIGH |
| MySQL | 8.x | Primary database | Pre-decided. MySQL 8 is the current production-grade version. Full-text search, JSON columns, window functions all available. Confidence: HIGH |
| Prisma ORM | 5.x | Database access layer | Best-in-class TypeScript ORM for MySQL/Node.js. Type-safe queries, migrations, and schema management. Prisma 5 introduced significant performance improvements. Prisma Client generates fully-typed query builders. Works well across monorepo with shared package for the Prisma schema. Confidence: HIGH |
| TypeScript | 5.x | Language | Required for type-safety across the monorepo, especially for shared types between API and web. Next.js 15 has native TypeScript config support (`next.config.ts`). Confidence: HIGH |
| pnpm | 9.x | Package manager | Best monorepo support with workspaces. Significantly faster than npm, disk-space efficient with content-addressable store. pnpm workspaces are the current standard for Node.js monorepos. Confidence: HIGH |
| Turborepo | 2.x | Monorepo build orchestration | Task caching, parallel builds, pipeline configuration. Works natively with pnpm workspaces. Maintained by Vercel. Confidence: HIGH |

---

### Backend — `apps/api`

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express` | ^4.21 | HTTP framework | All API routes, middleware, error handling |
| `prisma` | ^5.22 | ORM + migrations | All database access. Use `@prisma/client` at runtime |
| `@prisma/client` | ^5.22 | Type-safe DB client | Generated from schema, used in service layer |
| `zod` | ^3.23 | Input validation | Validate all request bodies, query params, path params. Pairs with Prisma for end-to-end type safety |
| `jsonwebtoken` | ^9.0 | JWT signing/verification | Access tokens (short-lived, 15min) and refresh tokens (7 days) |
| `bcrypt` | ^5.1 | Password hashing | Hashing user passwords. Use cost factor 12 minimum |
| `nodemailer` | ^6.9 | Email sending | Transactional emails. Works with any SMTP provider. On cPanel, use Resend or Brevo SMTP as relay |
| `resend` | ^4.x | Email delivery (recommended) | Modern email API with great deliverability and free tier. Use instead of raw SMTP where possible. Confidence: MEDIUM |
| `multer` | ^1.4 | File upload middleware | Handling multipart form data for image uploads |
| `sharp` | ^0.33 | Image processing | Resize, compress, convert comic cover images. Sharp is the Node.js standard for image processing. Required for cPanel since no Vercel image optimization |
| `stripe` | ^17.x | Stripe API client | Subscription billing. Use official Stripe Node SDK. Confidence: HIGH |
| `cors` | ^2.8 | CORS middleware | Allow web app to call API from different origin |
| `helmet` | ^8.x | HTTP security headers | Security hardening: Content-Security-Policy, X-Frame-Options, etc. |
| `express-rate-limit` | ^7.x | Rate limiting | Protect auth endpoints, contact form, brute-force prevention |
| `winston` | ^3.x | Structured logging | Application logging. More capable than `console.log` for production |
| `morgan` | ^1.10 | HTTP request logger | Log all incoming requests to Express |
| `dayjs` | ^1.11 | Date manipulation | Lightweight Moment.js replacement. Important for cart expiry, PIX expiration, subscription periods. Confidence: HIGH |
| `uuid` | ^10.x | UUID generation | Order numbers, idempotency keys, tokens |
| `csv-parse` | ^5.x | CSV parsing | Import collection/catalog from CSV uploads |
| `csv-stringify` | ^6.x | CSV serialization | Export collection/catalog to CSV downloads |
| `node-cron` | ^3.x | Cron jobs | Cart expiry (24h reservations), offer expiration, subscription enforcement. Runs inside the API process on cPanel |
| `dotenv` | ^16.x | Environment variables | Load `.env` files in development |

#### PIX Payment Integration

PIX requires a direct integration with a Brazilian payment gateway that issues QR codes. Stripe does NOT support PIX natively in Brazil for peer-to-peer marketplace payments.

| Option | Why Recommended |
|--------|-----------------|
| **Mercado Pago API** | Most widely adopted PIX gateway in Brazil. Has Node.js SDK (`mercadopago@^2`). Issues PIX QR codes directly. Has webhook support for payment confirmation. Free for basic usage, commissions only on transactions. Confidence: MEDIUM-HIGH |
| **Asaas** | Brazilian payment processor with full PIX support, subscription billing, and split payment (critical for marketplace where platform takes commission and vendor receives remainder). Good REST API. Confidence: MEDIUM |
| **PagSeguro/PagBank** | Alternative. Well-known in Brazil. Has PIX. SDK quality is lower than Mercado Pago. Confidence: MEDIUM |
| **Stripe (Brazil)** | Stripe does support PIX in Brazil as of 2023 but with caveats: PIX via Stripe requires Stripe account in Brazil (`stripe.com/br`), has higher fees than local processors for PIX, and split payments (marketplace payouts) need Stripe Connect which adds significant complexity. Only recommended if credit card (Stripe) and PIX need to be unified in one provider post-MVP. |

**Recommendation for MVP:** Use **Mercado Pago** for PIX (simple QR code generation, widely trusted in Brazil). Use **Stripe** separately for subscriptions only. This separation is clean: Stripe handles recurring billing, Mercado Pago handles marketplace transactions.

```bash
npm install mercadopago  # ^2.x — official MP Node SDK
npm install stripe       # ^17.x — for subscriptions
```

---

### Frontend — `apps/web`

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next` | ^15.x | Framework | App Router, SSR, SSG, API routes (not used — API is separate) |
| `react` | ^19.x | UI library | All components |
| `react-dom` | ^19.x | React DOM renderer | Required with React 19 |
| `typescript` | ^5.x | Type safety | All `.tsx` files |
| `tailwindcss` | ^3.4 | Utility-first CSS | Most productive CSS approach for React. Pairs perfectly with shadcn/ui. Note: Tailwind v4 is in beta as of early 2025 — stay on v3.4 until v4 is stable. Confidence: HIGH |
| `@tailwindcss/typography` | ^0.5 | Prose styling | Blog content, legal policy pages rendered from Markdown |
| `shadcn/ui` | (CLI-based) | Component library | NOT a package — it's a code generator. Run `npx shadcn@latest add button` to add components. Components are copied into your repo and fully customizable. Based on Radix UI primitives + Tailwind. The current standard for Next.js component libraries. Confidence: HIGH |
| `@radix-ui/react-*` | ^2.x | Accessible UI primitives | shadcn/ui uses these under the hood. May need direct access for custom components |
| `react-hook-form` | ^7.x | Form management | All forms — login, registration, catalog submission, order checkout. Minimal re-renders, great TypeScript support |
| `@hookform/resolvers` | ^3.x | Validation resolvers | Connect Zod schemas to react-hook-form |
| `zod` | ^3.23 | Schema validation | Share Zod schemas between API and web via `packages/contracts`. Validates form data on the client before submission |
| `@tanstack/react-query` | ^5.x | Server state management | Data fetching, caching, background refetch. The standard for API data in React. Works well with Next.js App Router. Replace `useEffect` + `fetch` patterns. Confidence: HIGH |
| `axios` | ^1.7 | HTTP client | API calls from the web app. More ergonomic than raw `fetch` for error handling and interceptors |
| `next-intl` | ^3.x | i18n | Internationalization for Next.js App Router. PT-BR at launch, extensible. Works with App Router routing. Config: add locale prefix, use `useTranslations()` hook in components. Confidence: HIGH |
| `lucide-react` | ^0.x | Icons | The default icon library for shadcn/ui projects. Clean, consistent, tree-shakeable |
| `next-themes` | ^0.x | Dark/light mode | Theme toggling with system preference detection and localStorage persistence. Designed for Next.js |
| `react-hot-toast` | ^2.x | Toast notifications | Or use shadcn/ui's Sonner (preferred if already using shadcn). Lightweight and accessible |
| `sonner` | ^1.x | Toast notifications | Recommended over react-hot-toast for shadcn/ui projects. Run `npx shadcn@latest add sonner` |
| `recharts` | ^2.x | Charts | Admin dashboard revenue charts, user collection stats. React-native charting library. Confidence: MEDIUM |
| `@stripe/stripe-js` | ^4.x | Stripe frontend | Load Stripe.js for subscription checkout flow |
| `@stripe/react-stripe-js` | ^2.x | Stripe React components | Stripe Elements for payment forms |
| `react-dropzone` | ^14.x | File upload UI | Drag-and-drop image uploads for comic covers and collection photos |
| `qrcode.react` | ^4.x | QR code display | Render PIX QR codes in the checkout flow |

---

### Shared Packages — `packages/`

This is the critical architecture decision for the monorepo. Shared packages maintain decoupling via explicit contracts, not implementation sharing.

| Package | Contents | Why |
|---------|----------|-----|
| `packages/contracts` | TypeScript types, Zod schemas for API request/response shapes | Single source of truth. API and web never go out of sync on types. Eliminates "API changed and broke frontend" issues |
| `packages/config` | Shared ESLint, TypeScript, Tailwind configs | DRY configuration across apps |

**Do NOT share:** Prisma client, business logic, Express middleware, React components across apps. Each app owns its implementation.

---

### Auth Architecture

**Decision: Custom JWT-based auth (no auth library like NextAuth/Lucia)**

**Rationale:** This is a Node.js API + Next.js frontend, not a Next.js-only project. NextAuth/Auth.js is designed for Next.js API routes and Server Actions — it does not work well when the auth backend is a separate Express API. Lucia Auth is backend-framework-agnostic but adds complexity. For a separate Express API, implementing JWT auth directly is simpler, more controllable, and more educational.

**Implementation:**
- Express API handles all auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- Access token: short-lived JWT (15 min), stored in memory on the client (not localStorage)
- Refresh token: long-lived JWT (7 days), stored in `httpOnly` cookie
- Token rotation: each refresh issues a new refresh token and invalidates the old one
- Password reset: time-limited token (1h) stored in DB, sent via email

**Libraries:**
- `jsonwebtoken` — JWT signing/verification in Express
- Cookies managed by Express with `res.cookie()` + `httpOnly: true, secure: true, sameSite: 'strict'`
- Client-side: axios interceptors handle token refresh automatically

**Do NOT use:** NextAuth/Auth.js (wrong architecture for separate API backend), Passport.js (adds ceremony for simple JWT auth), sessions stored in MySQL (stateful, harder to scale, Redis not available on basic cPanel).

---

### Image Storage

**Challenge:** cPanel does not provide object storage (no S3). Comic cover images need to be served efficiently.

**Options:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Store on cPanel filesystem** | Simple, no external service | No CDN, limited space, manual backups | OK for MVP |
| **Cloudinary (free tier)** | CDN, transformations, generous free tier (25GB storage, 25GB bandwidth/month) | External dependency | Recommended for MVP |
| **Cloudflare R2 + Images** | Cheap, fast, S3-compatible API | Requires Cloudflare account, slightly more setup | Best for scale |
| **AWS S3 + CloudFront** | Mature, reliable | Cost, complexity overkill for MVP | Post-MVP |

**Recommendation for MVP:** Use **Cloudinary** for comic cover images (catalog). The free tier is sufficient for launch. Use the `cloudinary` Node.js SDK (`^2.x`) in the API to upload and transform images. For user-uploaded exemplar photos (collection), filesystem storage on cPanel is acceptable for MVP — add Cloudinary or R2 post-MVP.

```bash
# In apps/api
npm install cloudinary  # ^2.x
```

**Image processing pipeline:**
1. User uploads cover image → API receives via multer
2. API processes with `sharp`: resize to max 800x1200px, convert to WebP, compress
3. Processed image uploaded to Cloudinary (or saved to filesystem for MVP)
4. Cloudinary URL (or local path) stored in MySQL

---

### Email Delivery

**Recommended: Resend**

Transactional email with a generous free tier (3,000 emails/month), excellent deliverability, React Email support for template design, and a clean REST API. Based in 2024/2025 this is the emerging standard replacing SendGrid for new projects.

Alternative: **Brevo (formerly Sendinblue)** — also has a free tier (300 emails/day), SMTP access (easier to configure in nodemailer), and a Brazilian user base.

**For MVP:** Use Resend via their Node.js SDK. They support sending from custom domains. Very simple setup:

```bash
npm install resend  # ^4.x
```

**Template approach:** Use `@react-email/components` to build email templates as React components, rendered server-side to HTML strings. This keeps email templates type-safe and co-located with the API codebase.

```bash
npm install @react-email/components  # ^0.x
npm install -D react-email           # preview server
```

---

### Development Tooling

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| TypeScript | ^5.x | Type checking | `tsc --noEmit` in CI, `ts-node` or `tsx` for scripts |
| ESLint | ^9.x | Linting | Next.js 15 ships with ESLint 9 support. Use `eslint-config-next` |
| Prettier | ^3.x | Code formatting | Consistent formatting. Use `prettier-plugin-tailwindcss` to sort Tailwind classes |
| `tsx` | ^4.x | TypeScript runner | Run TypeScript files directly without compiling (replaces `ts-node` for most use cases). Use for seeding, migrations, scripts |
| Vitest | ^2.x | Unit testing | Fast, Vite-native, better TypeScript support than Jest. Use for API service layer unit tests. Confidence: HIGH |
| `supertest` | ^7.x | API integration testing | Test Express routes in integration tests without starting a server |
| Playwright | ^1.x | E2E testing | Browser automation for critical user flows (checkout, auth). Use sparingly in MVP |
| `prisma-erd-generator` | latest | Schema visualization | Generate ERD diagrams from Prisma schema. Dev tool only |
| `dotenv-cli` | ^7.x | Env loading in scripts | Load `.env` files when running scripts from monorepo root |
| PM2 | ^5.x | Process management | Run Node.js API on cPanel as a persistent process. Use `ecosystem.config.js` for configuration. Essential for cPanel deployment |

---

### cPanel Deployment Strategy

cPanel deployment is the most significant constraint shaping infrastructure decisions.

**API (`apps/api`):**
- Deploy as a Node.js application via cPanel's Node.js Selector (if available) OR via PM2 in SSH
- Use PM2 for process management: auto-restart on crash, clustering if VPS
- Reverse proxy via `.htaccess` or cPanel's proxy rules to expose API on a subdomain (e.g., `api.comicstrunk.com.br`)
- Build: `tsc` compiles TypeScript to `dist/`, PM2 runs `dist/server.js`
- Environment: `.env` file on the server, never in repo

**Web (`apps/web`):**
- Build: `next build` generates a standalone output OR static export
- For cPanel: use `output: 'standalone'` in `next.config.ts` which bundles the minimal Node.js server
- Run the standalone server with PM2 (same as API)
- Alternatively: if only static pages are needed, use `output: 'export'` — but this disables SSR/API routes
- **Recommended:** Standalone mode + PM2 on cPanel, with separate subdomains for API and web

**Database:**
- MySQL is typically provided by cPanel's MySQL database manager
- Use cPanel's MySQL hostname (usually `localhost` or `127.0.0.1`)
- Prisma migrations run via SSH: `npx prisma migrate deploy`
- **Do NOT run `prisma migrate dev` in production** — always use `migrate deploy`

---

### Monorepo Structure

```
comicstrunk/
├── apps/
│   ├── api/          # Express + Prisma + Node.js
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── server.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   └── web/          # Next.js 15 App Router
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
├── packages/
│   ├── contracts/    # Shared types + Zod schemas
│   │   └── package.json
│   └── config/       # Shared ESLint, TS configs
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| API Framework | Express 4 | Fastify 4 | Fastify is faster and has built-in schema validation. However, Express has a much larger ecosystem, every cPanel tutorial uses it, and the performance difference doesn't matter at Brazilian indie-project scale. Revisit at 100k+ req/day |
| API Framework | Express 4 | Express 5 (RC) | Not fully stable as of early 2026. Breaking changes in error handling. Wait for GA |
| ORM | Prisma 5 | Drizzle ORM | Drizzle is newer, "lighter", and more SQL-close. Prisma has better migration tooling, Prisma Studio for DB inspection (extremely valuable for an admin platform), and is more battle-tested. Drizzle is viable but Prisma is lower-risk for a complex domain model |
| ORM | Prisma 5 | TypeORM | TypeORM has bugs, poor TypeScript inference, and stalled development. Avoid |
| ORM | Prisma 5 | Sequelize | Same issues as TypeORM — aging, poor TypeScript experience |
| Auth | Custom JWT | NextAuth/Auth.js | Auth.js is designed for Next.js-only apps (API routes or Server Actions). It fights against a separate Express API. Would require a custom provider implementation that negates most of its value |
| Auth | Custom JWT | Lucia Auth | Lucia v3 removed most abstractions and is essentially "build your own auth" anyway. Starting with JWT + jsonwebtoken is equally simple and more familiar |
| CSS | Tailwind CSS | CSS Modules | CSS Modules are fine but Tailwind + shadcn/ui is the dominant Next.js stack in 2025. The component ecosystem (shadcn/ui) only works with Tailwind |
| Components | shadcn/ui | Chakra UI | Chakra adds runtime overhead. shadcn/ui has zero runtime — components are compiled |
| Components | shadcn/ui | Material UI (MUI) | MUI has its own design system that's hard to customize to a dark-mode comics aesthetic. shadcn/ui is fully customizable |
| Components | shadcn/ui | Ant Design | Same issue as MUI — opinionated design system, large bundle size |
| Data fetching | TanStack Query | SWR | TanStack Query v5 is more feature-complete (mutations, infinite queries, devtools). SWR is simpler but too minimal for this app's complexity |
| i18n | next-intl | react-i18next | react-i18next works but lacks native App Router integration. next-intl was built specifically for Next.js App Router with typed translations |
| PIX | Mercado Pago | Stripe (PIX via Stripe BR) | Stripe PIX in Brazil requires Stripe Connect for marketplace splits, adds complexity, and has higher fees for PIX than local processors. Use Stripe only for subscriptions |
| PIX | Mercado Pago | Asaas | Asaas has better split payment features (needed for marketplace commissions), but less brand recognition for users. Mercado Pago is more trusted by Brazilian users |
| Email | Resend | SendGrid | SendGrid has become expensive for small projects. Resend has better free tier and modern API |
| Email | Resend | Amazon SES | SES has excellent deliverability and low cost but requires more configuration (bounce handling, DKIM, etc.). Good post-MVP when volume justifies it |
| Images | Cloudinary | AWS S3 | S3 requires CloudFront for CDN, ACM for certificates, IAM for permissions — overkill for MVP. Cloudinary free tier handles MVP scale easily |
| Package manager | pnpm | npm workspaces | npm workspaces work but are slower and have less mature monorepo tooling |
| Package manager | pnpm | Yarn Workspaces | Yarn Berry (v2+) has good monorepo support but PnP mode creates compatibility issues with some packages. pnpm is simpler |
| Monorepo orchestration | Turborepo | Nx | Nx is more powerful but overkill for a 2-app monorepo. Turborepo is simpler to configure |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TypeORM | Poor TypeScript inference, known bugs with complex relations, stalled development | Prisma 5 |
| Sequelize | Same era as TypeORM, poor TS experience, callback-style API | Prisma 5 |
| `mongoose` | MongoDB ODM — irrelevant, project uses MySQL | Prisma 5 |
| `moment.js` | 67kB, no tree-shaking, marked as "legacy" by maintainers | `dayjs` or `date-fns` |
| `passport.js` | Overkill for simple JWT auth. Adds abstraction that obscures what's happening. No value for this setup | `jsonwebtoken` directly |
| `next-auth`/`auth.js` v5 | Designed for Next.js-only auth. Fights against separate Express API. Database adapter complexity | Custom JWT in Express |
| `redux` / `redux-toolkit` | Server state (API data) should live in TanStack Query. UI state should live in `useState`/`useContext`. Redux is unnecessary complexity | TanStack Query + React state |
| `zustand` (as primary state) | Fine for UI state, but TanStack Query handles 90% of state in this app. Avoid adding zustand unless a specific need arises | TanStack Query |
| MySQL 5.7 | End of life October 2023. Security vulnerabilities, missing features | MySQL 8.x |
| `node-mysql` (mysql package) | Old MySQL driver, callback-based, not maintained | Prisma (manages its own connection via `@prisma/client`) |
| Pages Router (Next.js) | Next.js 15 App Router is mature and production-ready. Pages Router is in maintenance mode | App Router |
| `dotenv` in production | `.env` files should be loaded by the environment/process manager, not dotenv | PM2 ecosystem.config.js env vars |
| `body-parser` (standalone) | Included in Express 4.16+ via `express.json()`. Installing separately is redundant | `express.json()` |
| `csurf` | Deprecated package, removed from maintenance | Use `sameSite: 'strict'` cookies + CORS properly configured |

---

## Stack Patterns by Variant

**For admin-only image uploads (catalog covers):**
- Accept via `multer` (memory storage for small files)
- Process with `sharp` (resize to 800px max width, convert to WebP)
- Upload to Cloudinary via their Node.js SDK
- Store Cloudinary `public_id` and `secure_url` in MySQL

**For PIX payment flow:**
- Create order in MySQL with status `PENDING`
- Call Mercado Pago API to generate PIX QR code and payment ID
- Store MP payment ID in order record
- Return QR code data (base64 image + `pix_code` string) to frontend
- Frontend polls `GET /orders/:id/payment-status` every 5 seconds (MVP — no webhooks until they're configured)
- Mercado Pago sends webhook to `POST /webhooks/mercadopago` on payment confirmation
- Webhook handler updates order to `PAID` status and triggers fulfillment flow
- Implement idempotency: check MP payment ID before processing to prevent duplicates (RN14)

**For Stripe subscription flow:**
- User selects BASIC plan → frontend calls `POST /subscriptions/checkout`
- API creates Stripe Checkout Session with `mode: 'subscription'`
- Frontend redirects to Stripe-hosted checkout page
- On success, Stripe sends `checkout.session.completed` webhook
- Webhook handler creates/updates subscription record in MySQL
- On `customer.subscription.updated` / `customer.subscription.deleted`, sync status to MySQL
- Stripe Customer Portal for self-service subscription management

**For CSV import (collection):**
- Accept CSV upload via `multer` (disk storage, temp file)
- Parse with `csv-parse` stream API (handles large files without loading all into memory)
- Validate each row against Zod schema
- Match to catalog items by barcode or title+edition
- Report: `{ imported: N, failed: N, errors: [{row, reason}] }`
- Delete temp file after processing

**For cPanel deployment (Node.js API):**
```javascript
// ecosystem.config.js (PM2)
module.exports = {
  apps: [{
    name: 'comicstrunk-api',
    script: './dist/server.js',
    instances: 1,  // or 'max' if VPS with multiple cores
    autorestart: true,
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      // other env vars set here or via cPanel
    }
  }]
}
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.x | Node.js >= 18.18.0 | Use Node.js 22 LTS for best support |
| Next.js 15.x | React 19 (App Router) | React 18 supported on Pages Router only |
| Prisma 5.x | Node.js >= 16.13 | Node.js 22 is fully supported |
| Prisma 5.x | MySQL 5.7, 8.0 | Use MySQL 8.0. MySQL 5.7 is EOL |
| TypeScript 5.x | Node.js 16+ | All fine with Node.js 22 |
| Tailwind CSS 3.4 | PostCSS 8 | Required. Bundled with Next.js 15 setup |
| react-hook-form 7 | React 18, React 19 | Compatible with React 19 |
| TanStack Query 5 | React 18, React 19 | v5 dropped React 16/17 support |
| next-intl 3.x | Next.js 15 | Compatible. Check next-intl docs for App Router setup |
| stripe 17.x | Node.js >= 12 | Stripe v17 requires updating from v14/15 — breaking changes in error types |
| mercadopago 2.x | Node.js >= 14 | V2 is a complete rewrite from v1. Use v2 only |

---

## Installation

```bash
# Monorepo root
pnpm install

# apps/api — core dependencies
pnpm --filter api add express prisma @prisma/client zod jsonwebtoken bcrypt nodemailer resend @react-email/components multer sharp cloudinary stripe mercadopago cors helmet express-rate-limit winston morgan dayjs uuid csv-parse csv-stringify node-cron dotenv

# apps/api — dev dependencies
pnpm --filter api add -D typescript @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/multer @types/cors @types/morgan tsx vitest supertest prisma

# apps/web — core dependencies
pnpm --filter web add next react react-dom tailwindcss @tailwindcss/typography @tanstack/react-query axios zod react-hook-form @hookform/resolvers next-intl next-themes lucide-react sonner recharts @stripe/stripe-js @stripe/react-stripe-js react-dropzone qrcode.react

# apps/web — dev dependencies
pnpm --filter web add -D typescript @types/node eslint eslint-config-next prettier prettier-plugin-tailwindcss

# packages/contracts — shared types
pnpm --filter contracts add zod typescript
```

---

## Sources

- Next.js 15 official blog (https://nextjs.org/blog/next-15) — Next.js version, React 19 support, self-hosting improvements, ESLint 9 — VERIFIED HIGH confidence
- Prisma documentation — MySQL support, version compatibility — MEDIUM confidence (based on training data, current as of Aug 2025)
- Mercado Pago developer docs — PIX integration in Brazil — MEDIUM confidence (training data)
- Node.js release schedule — LTS versions — HIGH confidence (LTS dates are publicly documented)
- Stripe Node.js SDK changelog — version 17 — MEDIUM confidence
- next-intl GitHub and docs — App Router support — MEDIUM confidence
- shadcn/ui official site — component library approach — HIGH confidence (widely documented)
- TanStack Query v5 migration docs — React 19 support — MEDIUM confidence
- Cloudinary free tier — 25GB storage, 25GB bandwidth — LOW confidence (free tier limits change frequently; verify before launch)
- Resend pricing — free tier limits — LOW confidence (verify current limits at resend.com)

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Core framework choices (Node.js, Next.js 15, Express, MySQL, Prisma) | HIGH | Verified/stable technology choices with clear rationale |
| Next.js 15 features and caching semantics | HIGH | Verified via official Next.js blog |
| Auth approach (custom JWT) | HIGH | Architectural reasoning is sound; library choices are standard |
| Tailwind + shadcn/ui component approach | HIGH | Current dominant Next.js stack in 2025 |
| PIX via Mercado Pago | MEDIUM | MP is the leading PIX provider in Brazil; verify current SDK version before implementation |
| Resend for email | MEDIUM | Emerging standard; verify free tier limits at launch time |
| Cloudinary for images | MEDIUM | Good choice for MVP; verify free tier limits |
| Mercado Pago v2 SDK specifics | LOW | SDK internals change; verify against official MP docs during implementation |
| Stripe v17 specifics | MEDIUM | Breaking changes from v14 — verify migration guide |
| cPanel deployment specifics | MEDIUM | PM2 + reverse proxy approach is standard; cPanel version and available features vary by host |

---

*Stack research for: Comics Trunk — Node.js + Next.js + MySQL comics collector platform (Brazil)*
*Researched: 2026-02-21*
