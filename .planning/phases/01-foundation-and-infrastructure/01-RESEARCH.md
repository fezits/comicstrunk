# Phase 1: Foundation and Infrastructure - Research

**Researched:** 2026-02-21
**Domain:** Monorepo scaffold, cPanel deployment, JWT authentication, Prisma schema, i18n, theming, shared contracts
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire technical foundation: a pnpm + Turborepo monorepo with three packages (apps/api, apps/web, packages/contracts), a full Prisma schema covering all 10 phases of the platform, validated cPanel deployment for both the Express API and the Next.js frontend, custom JWT authentication with refresh token rotation, PT-BR internationalization via next-intl, and a dark/light theme system using next-themes + shadcn/ui + Tailwind CSS 3.4.

The most critical discovery is the cPanel deployment constraint. cPanel uses Phusion Passenger to manage Node.js applications -- not PM2. Passenger captures the `http.Server.listen()` call and proxies through Apache, meaning the app does NOT bind to its own port in production. The restart mechanism is `touch tmp/restart.txt`, not process signals. Environment variables are set via the cPanel UI, not `.env` files. This fundamentally shapes how both the API and frontend are deployed and must be validated before any application code is written.

The second critical finding is that the Next.js standalone output mode in a monorepo requires `outputFileTracingRoot` pointing to the monorepo root, and the standalone folder must NOT have `pnpm install` run inside it. Additionally, `bcryptjs` (pure JS) should be used instead of `bcrypt` (native C++ addon) because cPanel shared hosting may lack the build toolchain (node-gyp, python, make) required to compile native modules.

**Primary recommendation:** Validate the cPanel deployment pipeline with a trivial Express "hello world" and a minimal Next.js standalone build BEFORE writing any application code. This is the go/no-go gate for the entire project.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dark & immersive vibe -- deep backgrounds, collector's vault feel
- Purple dominant accent (#7C3AED range), blue as secondary accent
- Purple-to-blue gradients on primary UI elements (buttons, headers, hero sections)
- Dark mode is default; light mode available via toggle
- Theme choice persisted across sessions
- Follow PRD Section 7 design spec: sidebar nav for authenticated pages, centered card for public/auth pages, skeletons for loading, toasts for feedback, confirmation modals for destructive actions, badges for status, progress bars for series/goals
- GitHub Issues created from plan tasks during execution
- Branch per issue from `develop` (e.g., `feature/01-monorepo-scaffold`)
- Commit to branch, create PR to `develop`, await review
- Pull `develop` after merge, create branch for next issue
- comicstrunk.com is live on cPanel (currently empty Next.js stub)
- cPanel deployment is a go/no-go gate -- validate before writing application code

### Claude's Discretion
- Font choice (something fitting the dark/immersive vibe -- geometric or slightly technical)
- Exact color palette values for grays, surfaces, borders
- Spacing and typography scale
- Auth flow details (JWT storage strategy, token lifetimes, rate limiting thresholds)
- Database schema decisions (full upfront vs iterative migrations)
- Layout component architecture
- Sidebar navigation item ordering and grouping

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | cPanel deployment validated with Node.js backend + Next.js frontend running (go/no-go gate) | cPanel Passenger deployment pattern, standalone output, outputFileTracingRoot for monorepo, restart mechanism via tmp/restart.txt |
| INFRA-02 | Monorepo structure initialized (apps/api, apps/web, packages/contracts) with pnpm workspaces | pnpm-workspace.yaml + turbo.json configuration, @comicstrunk namespace, shared tsconfig pattern |
| INFRA-03 | MySQL database provisioned with Prisma ORM and migration pipeline | Prisma 5 schema design, DECIMAL(10,2) for money fields, prisma migrate deploy for production, full upfront schema approach |
| INFRA-04 | HTTPS enforced in production | cPanel handles HTTPS via Apache/Passenger -- app receives proxied traffic, enforce via redirect middleware or .htaccess |
| INFRA-05 | Automated daily database backups | cPanel MySQL backup via cron job or cPanel's built-in backup tool, mysqldump script |
| INFRA-06 | Health check endpoints with basic monitoring | GET /health returning 200 + uptime + timestamp, Prisma connection check |
| INFRA-07 | i18n architecture in place (PT-BR at launch, extensible) | next-intl 3.x with App Router, [locale] dynamic segment, defineRouting, middleware, message JSON files |
| INFRA-08 | Responsive layout system (mobile < 768px, tablet 768-1023px, desktop 1024px+) | Tailwind CSS 3.4 responsive prefixes (sm/md/lg/xl), sidebar layout component with mobile hamburger |
| INFRA-09 | Dark/light theme with toggle, dark as default, persisted across sessions | next-themes ThemeProvider with attribute="class", defaultTheme="dark", shadcn/ui CSS variables, localStorage persistence automatic |
| INFRA-10 | Shared contracts package (TypeScript types + Zod schemas) consumed by both apps | packages/contracts with Zod schemas, exported as @comicstrunk/contracts, consumed by both apps |
| AUTH-01 | User can sign up with name, email, and password (with complexity requirements) | Zod validation for password complexity, bcryptjs hashing (cost 12), express-rate-limit on signup endpoint |
| AUTH-02 | User can log in securely with rate limiting against brute force | express-rate-limit: 5 attempts per 15min per IP on /auth/login, JWT access token (15min) + refresh token (7 days) |
| AUTH-03 | User can recover password via email with temporary link (expires in 1h) | Crypto-random token stored hashed in DB, 1h TTL, sent via email (Resend or SMTP for Phase 1 -- email service is deferred to Phase 7 for full integration) |
| AUTH-04 | User session persists across browser refresh (JWT + refresh token) | Access token in memory, refresh token in httpOnly/secure/sameSite=strict cookie, axios interceptor for silent refresh |
| AUTH-05 | User can view and edit profile (avatar, personal info, social links) | GET/PUT /users/profile endpoints, Zod validation, avatar upload deferred to later phase if Cloudinary not yet configured |
| AUTH-06 | Three access levels enforced: User, Subscriber, Administrator | Role enum in users table (USER, SUBSCRIBER, ADMIN), middleware checks req.user.role |
| AUTH-07 | User must accept Terms of Use and Privacy Policy to complete registration | Boolean acceptedTerms + acceptedAt timestamp on registration, Zod schema requires acceptedTerms: true |
</phase_requirements>

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| pnpm | 9.x | Package manager + workspaces | Standard for Node.js monorepos, content-addressable store, fastest installs | HIGH |
| Turborepo | 2.x | Build orchestration | Task caching, parallel builds, pipeline config, pnpm-native | HIGH |
| TypeScript | 5.x | Language | Type safety across monorepo, native Next.js 15 support | HIGH |
| Express | 4.x (^4.21) | API framework | Battle-tested, universal cPanel compatibility, massive ecosystem | HIGH |
| Prisma | 5.x (^5.22) | ORM + migrations | Type-safe, MySQL support, Prisma Studio, migration pipeline | HIGH |
| @prisma/client | ^5.22 | Generated DB client | Auto-generated typed queries from schema | HIGH |
| Next.js | 15.x | Frontend framework | App Router, standalone output for cPanel, React 19 | HIGH |
| React | 19.x | UI library | Required by Next.js 15 App Router | HIGH |
| Tailwind CSS | 3.4.x | Utility CSS | Stable, full shadcn/ui compatibility. v4 exists but has compatibility issues with Next.js 15 and Turbopack -- stay on v3.4 | HIGH |
| shadcn/ui | CLI-based | Component library | Zero runtime, fully customizable, Radix primitives + Tailwind, dark mode native | HIGH |
| next-intl | 3.x | i18n | Built for Next.js App Router, typed translations, server + client support | HIGH |
| next-themes | 0.x | Theme toggle | No-flash dark mode, localStorage persistence, system preference detection | HIGH |
| Zod | ^3.23 | Validation | Shared between API and frontend via contracts package, TypeScript inference | HIGH |
| jsonwebtoken | ^9.0 | JWT signing/verify | Standard JWT library for Express | HIGH |
| bcryptjs | ^2.4 | Password hashing | Pure JS -- no native compilation needed on cPanel. Use instead of bcrypt | HIGH |
| express-rate-limit | ^7.x | Rate limiting | Auth endpoint brute-force protection | HIGH |
| cors | ^2.8 | CORS middleware | Required for web app calling API on different origin/subdomain | HIGH |
| helmet | ^8.x | Security headers | CSP, X-Frame-Options, etc. | HIGH |
| cookie-parser | ^1.4 | Cookie parsing | Required to read httpOnly refresh token cookies in Express | HIGH |
| react-hook-form | ^7.x | Form management | All auth forms (signup, login, reset), minimal re-renders, Zod resolver | HIGH |
| @hookform/resolvers | ^3.x | Validation bridge | Connects Zod schemas to react-hook-form | HIGH |
| axios | ^1.7 | HTTP client | API calls from frontend, interceptor for token refresh | HIGH |
| lucide-react | ^0.x | Icons | Default shadcn/ui icon library | HIGH |
| sonner | ^1.x | Toast notifications | shadcn/ui recommended toast library | HIGH |

### Supporting (Phase 1 only)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| dotenv | ^16.x | Env vars (dev only) | Local development -- NOT in production (cPanel Passenger handles env vars) | HIGH |
| tsx | ^4.x | TS runner | Run TypeScript scripts directly (seeds, migrations) | HIGH |
| ESLint | ^9.x | Linting | eslint-config-next for web, standard config for API | HIGH |
| Prettier | ^3.x | Formatting | prettier-plugin-tailwindcss for class sorting | HIGH |
| winston | ^3.x | Structured logging | Production logging in API | MEDIUM |
| morgan | ^1.10 | HTTP request logger | Request logging middleware | HIGH |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind 3.4 | Tailwind 4.x | v4 is newer with smaller CSS output, but has known compatibility issues with Next.js 15 Turbopack and custom configs. Stay on v3.4 for stability |
| bcryptjs | bcrypt | bcrypt is 20% faster (native C++), but requires node-gyp compilation which may fail on cPanel shared hosting |
| express-rate-limit | rate-limiter-flexible | rate-limiter-flexible has Redis support, but express-rate-limit is simpler and sufficient for in-memory rate limiting on single-process cPanel |
| axios | ky / native fetch | axios has interceptors for automatic token refresh which is critical for JWT auth flow |
| cookie-parser | Express built-in | Express 4 does not include cookie parsing built-in; cookie-parser is the standard middleware |

### Installation

```bash
# Root
pnpm add -D turbo typescript

# apps/api
pnpm --filter api add express @prisma/client zod jsonwebtoken bcryptjs cors helmet express-rate-limit cookie-parser winston morgan dotenv
pnpm --filter api add -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cors @types/morgan @types/cookie-parser tsx prisma vitest

# apps/web
pnpm --filter web add next react react-dom tailwindcss@^3.4 @tailwindcss/typography react-hook-form @hookform/resolvers zod axios next-intl next-themes lucide-react sonner
pnpm --filter web add -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next prettier prettier-plugin-tailwindcss autoprefixer postcss

# packages/contracts
pnpm --filter contracts add zod
pnpm --filter contracts add -D typescript
```

## Architecture Patterns

### Recommended Project Structure

```
comicstrunk/
├── apps/
│   ├── api/                          # Express 4 REST API
│   │   ├── src/
│   │   │   ├── modules/              # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.schema.ts    # Zod schemas for this module
│   │   │   │   │   └── auth.middleware.ts
│   │   │   │   └── users/
│   │   │   │       ├── users.routes.ts
│   │   │   │       ├── users.service.ts
│   │   │   │       └── users.schema.ts
│   │   │   ├── shared/
│   │   │   │   ├── middleware/       # authenticate, authorize, validate, rateLimit
│   │   │   │   ├── lib/              # prisma client singleton, logger
│   │   │   │   └── utils/            # response helpers, error classes
│   │   │   └── app.ts                # Express app setup + route registration
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Full schema (ALL tables for ALL phases)
│   │   │   └── migrations/           # Generated by prisma migrate dev
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                          # Next.js 15 App Router
│       ├── src/
│       │   ├── app/
│       │   │   ├── [locale]/         # next-intl locale segment
│       │   │   │   ├── (public)/     # Homepage, catalog browse (future)
│       │   │   │   ├── (auth)/       # Login, signup, password reset
│       │   │   │   ├── (collector)/  # Collection, favorites, series (future)
│       │   │   │   ├── (seller)/     # Seller dashboard (future)
│       │   │   │   ├── (orders)/     # Cart, checkout, orders (future)
│       │   │   │   ├── (admin)/      # Admin panel (future)
│       │   │   │   └── layout.tsx    # Locale layout with providers
│       │   │   ├── layout.tsx        # Root layout (html, body)
│       │   │   └── not-found.tsx
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   ├── layout/           # Sidebar, Header, ThemeToggle
│       │   │   └── auth/             # Auth-specific components
│       │   ├── lib/
│       │   │   ├── api/              # Typed API client (axios instance + interceptors)
│       │   │   └── auth/             # Token management, auth context
│       │   ├── i18n/
│       │   │   ├── routing.ts        # defineRouting config
│       │   │   └── request.ts        # getRequestConfig
│       │   ├── messages/
│       │   │   └── pt-BR.json        # PT-BR translation messages
│       │   └── styles/
│       │       └── globals.css       # Tailwind directives + shadcn CSS vars
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── contracts/                    # Shared types + Zod schemas
│       ├── src/
│       │   ├── index.ts              # Barrel export
│       │   ├── auth.ts               # Auth request/response types + Zod schemas
│       │   ├── users.ts              # User types
│       │   └── common.ts             # Shared enums (Role, etc.), pagination types
│       ├── tsconfig.json
│       └── package.json              # name: @comicstrunk/contracts
│
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json                # Shared TS config extended by all packages
├── .eslintrc.json                    # Root ESLint config
├── .prettierrc                       # Prettier config
└── package.json                      # Root (scripts: dev, build, lint)
```

### Pattern 1: cPanel Deployment with Phusion Passenger

**What:** cPanel manages Node.js apps through Phusion Passenger, which captures `http.Server.listen()` and proxies via Apache. The app does NOT listen on its own port in production. Restart is triggered by `touch tmp/restart.txt`. Environment variables are set via cPanel UI.

**When to use:** All production deployments to comicstrunk.com.

**Critical details:**
- The startup file (e.g., `app.js`) must call `http.createServer(app).listen()` -- Passenger intercepts this
- You cannot use PM2 on standard cPanel shared hosting
- After deploying new code, you MUST touch `tmp/restart.txt` to trigger Passenger restart
- Environment variables set in cPanel UI are injected into the process, NOT read from `.env`
- The app root in cPanel config must point to the built output directory
- For the API: compile TypeScript to `dist/`, point cPanel startup file at `dist/app.js`
- For the frontend: use `output: 'standalone'` in next.config.ts, copy public + .next/static into standalone folder, point cPanel at `.next/standalone/server.js`

**Example (API entry point for Passenger):**
```typescript
// apps/api/src/app.ts
import express from 'express';
import http from 'http';

const app = express();
// ... middleware, routes ...

const port = process.env.PORT || 3001;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

export default app;
```

### Pattern 2: Next.js Standalone in Monorepo for cPanel

**What:** Next.js `output: 'standalone'` creates a self-contained folder with minimal node_modules. In a monorepo, `outputFileTracingRoot` must point to the monorepo root so that workspace dependencies (like @comicstrunk/contracts) are traced and included.

**When to use:** Building apps/web for cPanel deployment.

**Critical details:**
- Set `outputFileTracingRoot: path.join(__dirname, '../../')` in next.config.ts (two levels up from apps/web to monorepo root)
- After `next build`, copy `public/` and `.next/static/` into `.next/standalone/`
- Do NOT run `pnpm install` inside the standalone folder -- it breaks traced node_modules
- The standalone server.js accepts `PORT` and `HOSTNAME` environment variables
- For monorepo, include shared packages in tracing: `outputFileTracingIncludes` if auto-trace misses them

**Example (next.config.ts for cPanel):**
```typescript
// apps/web/next.config.ts
import { join } from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

export default withNextIntl({
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'), // monorepo root
});
```

### Pattern 3: JWT Auth with Refresh Token Rotation

**What:** Access tokens are short-lived (15 min) stored in memory. Refresh tokens are long-lived (7 days) stored in httpOnly cookies. Each refresh issues a new refresh token and invalidates the old one. The refresh token hash is stored in the database for revocation.

**When to use:** All authenticated API communication.

**Security details:**
- Access token: JWT signed with HS256, contains `{ userId, role, iat, exp }`
- Refresh token: JWT signed with a separate secret, contains `{ userId, tokenFamily }`
- Store SHA-256 hash of refresh token in DB (not the raw token)
- Cookie config: `httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/refresh'`
- On refresh: verify token, check hash matches DB, issue new pair, store new hash, invalidate old
- On logout: delete refresh token from DB, clear cookie
- Token family tracking: if an old (already-rotated) refresh token is reused, invalidate all tokens for that family (stolen token detection)

**Example (refresh endpoint):**
```typescript
// modules/auth/auth.service.ts
async function refreshTokens(oldRefreshToken: string) {
  const payload = verifyRefreshToken(oldRefreshToken);
  const tokenHash = sha256(oldRefreshToken);

  const stored = await db.refreshToken.findFirst({
    where: { userId: payload.userId, tokenHash, revoked: false }
  });

  if (!stored) {
    // Token reuse detected -- revoke all tokens for this family
    await db.refreshToken.updateMany({
      where: { tokenFamily: payload.tokenFamily },
      data: { revoked: true }
    });
    throw new UnauthorizedError('Token reuse detected');
  }

  // Revoke old token
  await db.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true }
  });

  // Issue new pair
  const newAccessToken = signAccessToken({ userId: payload.userId, role: user.role });
  const newRefreshToken = signRefreshToken({ userId: payload.userId, tokenFamily: payload.tokenFamily });

  // Store new refresh token hash
  await db.refreshToken.create({
    data: {
      userId: payload.userId,
      tokenHash: sha256(newRefreshToken),
      tokenFamily: payload.tokenFamily,
      expiresAt: addDays(new Date(), 7),
    }
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

### Pattern 4: next-intl App Router Setup

**What:** next-intl provides i18n for Next.js App Router using a `[locale]` dynamic segment, middleware for locale detection, and typed message access via `useTranslations()`.

**When to use:** All text content in apps/web.

**Setup steps:**
1. Define routing config with `defineRouting({ locales: ['pt-BR'], defaultLocale: 'pt-BR' })`
2. Create middleware with `createMiddleware(routing)`
3. Add next-intl plugin to next.config.ts
4. Create `i18n/request.ts` with `getRequestConfig`
5. Wrap layout children with `NextIntlClientProvider`
6. Use `[locale]` dynamic segment in app directory
7. Store messages in `messages/pt-BR.json`

**Example (routing.ts):**
```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt-BR'],
  defaultLocale: 'pt-BR',
});
```

### Pattern 5: Dark/Light Theme with shadcn/ui

**What:** next-themes provides theme toggle with no-flash rendering. shadcn/ui uses CSS custom properties (HSL values) scoped to `.dark` and `:root` selectors. Tailwind 3.4 uses `darkMode: 'class'` to match.

**When to use:** All UI components.

**Setup steps:**
1. Install next-themes, configure ThemeProvider with `attribute="class"`, `defaultTheme="dark"`
2. Add `suppressHydrationWarning` to `<html>` tag in root layout
3. Configure Tailwind: `darkMode: 'class'` in tailwind.config.ts
4. Define CSS variables in globals.css for both `:root` (light) and `.dark` (dark) themes
5. Use shadcn/ui theming system -- all components reference CSS variables automatically
6. Purple dominant: customize `--primary` HSL to match #7C3AED (263 84% 55%)

**Example (globals.css theme variables):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 263 84% 55%;        /* #7C3AED purple */
    --primary-foreground: 0 0% 98%;
    --secondary: 217 91% 60%;     /* Blue accent */
    --secondary-foreground: 0 0% 98%;
    /* ... other shadcn variables */
  }

  .dark {
    --background: 240 10% 3.9%;    /* Deep dark background */
    --foreground: 0 0% 98%;
    --primary: 263 84% 55%;        /* Same purple */
    --primary-foreground: 0 0% 98%;
    --secondary: 217 91% 60%;
    --secondary-foreground: 0 0% 98%;
    /* ... dark variants for card, muted, accent, etc. */
  }
}
```

### Anti-Patterns to Avoid

- **Running `pnpm install` in the Next.js standalone folder:** Breaks traced node_modules. The standalone folder is self-contained -- do not modify it.
- **Using `bcrypt` (native) on cPanel:** Requires node-gyp compilation which may not be available. Use `bcryptjs` instead.
- **Storing refresh tokens in localStorage:** XSS-vulnerable. Use httpOnly cookies.
- **Storing access tokens in cookies:** Creates CSRF surface. Keep access tokens in memory only.
- **Using `dotenv` in production on cPanel:** Environment variables should be set via cPanel UI. dotenv is for development only.
- **Using Tailwind v4 with Next.js 15:** Known compatibility issues with Turbopack and custom configurations. Stay on v3.4.
- **Running `prisma migrate dev` in production:** Always use `prisma migrate deploy` in production. `dev` creates migrations interactively and resets data.
- **Defining the Prisma schema incrementally across phases:** The phase goal explicitly states "full database schema defined so no phase ever needs a destructive migration." Define ALL tables upfront.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | bcryptjs (cost 12) | Bcrypt is purpose-built for password hashing with adaptive cost factor; custom implementations are vulnerable |
| JWT token management | Manual token string parsing | jsonwebtoken library | Handles signature verification, expiry checking, and payload extraction correctly |
| Rate limiting | Custom IP counter middleware | express-rate-limit | Handles sliding windows, IP extraction behind proxies, customizable stores |
| Form validation | Manual field-by-field checks | Zod schemas + react-hook-form | Shared schemas between API and frontend eliminate drift; RHF handles re-render optimization |
| Dark mode no-flash | Custom script injection | next-themes | Handles SSR flash prevention, system preference, localStorage -- all edge cases covered |
| i18n routing | Manual locale detection | next-intl middleware | Handles locale negotiation, URL prefixing, redirect, App Router integration |
| CSS component library | Custom design system from scratch | shadcn/ui + Radix primitives | Accessible, keyboard-navigable, screen-reader friendly components out of the box |
| Responsive breakpoints | Custom media queries | Tailwind CSS responsive prefixes | Consistent, well-tested breakpoint system (sm/md/lg/xl) |
| Theme CSS variables | Manual CSS variable system | shadcn/ui theming + CSS custom properties | All shadcn components consume the variables automatically; changing theme = changing variables |

**Key insight:** Phase 1 has the highest hand-roll temptation because "it's just setup." But every pattern listed above has edge cases that consume days to debug when built from scratch. Use the standard tools.

## Common Pitfalls

### Pitfall 1: cPanel Passenger Mismatch with Local PM2 Development

**What goes wrong:** Developer builds and tests locally with PM2 or `node server.js`, then deploys to cPanel expecting the same behavior. Passenger captures `listen()` differently -- the app may fail to start, serve stale code, or not pick up environment variables.

**Why it happens:** cPanel's Node.js application manager uses Phusion Passenger, not PM2. Passenger intercepts `http.Server.listen()` and proxies through Apache. The restart mechanism is `touch tmp/restart.txt`, not process signals.

**How to avoid:**
1. Validate cPanel deployment FIRST with a trivial Express "hello world" that returns JSON
2. Document the exact cPanel setup steps: Node.js version, application root, startup file, environment variables
3. Create a deployment script that builds, copies files, and touches `tmp/restart.txt`
4. Add a `/health` endpoint that returns 200 with process uptime -- use as smoke test

**Warning signs:** No deployment runbook exists; first deployment attempted after significant code is written; environment variables only tested with `.env` files.

### Pitfall 2: Next.js Standalone Output Missing Files in Monorepo

**What goes wrong:** `next build` with `output: 'standalone'` in a monorepo fails to include files from workspace packages (like @comicstrunk/contracts). The standalone folder is missing dependencies, and the production server crashes with "Cannot find module" errors.

**Why it happens:** Next.js traces from the app directory by default. In a monorepo, workspace packages live outside the app directory. Without `outputFileTracingRoot` pointing to the monorepo root, they are not traced.

**How to avoid:**
1. Set `outputFileTracingRoot: path.join(__dirname, '../../')` in next.config.ts
2. After build, verify the standalone folder contains the contracts package
3. Copy `public/` and `.next/static/` into standalone folder after build
4. Never run `pnpm install` in the standalone folder
5. Test the standalone build locally: `node .next/standalone/server.js`

**Warning signs:** Build succeeds but `node server.js` crashes; contracts types available in dev but not in production build.

### Pitfall 3: Full Prisma Schema With Circular Foreign Key Dependencies

**What goes wrong:** Defining all ~30 tables upfront creates circular foreign key references (e.g., users -> orders -> payments -> users). Prisma handles this with nullable fields, but MySQL's InnoDB engine may reject the migration if foreign keys reference tables that don't exist yet.

**Why it happens:** Prisma generates migrations as a single SQL file. If table A references table B and table B references table A, the creation order matters.

**How to avoid:**
1. Prisma handles this automatically in most cases -- it generates CREATE TABLE statements without foreign keys first, then adds them with ALTER TABLE
2. Test the full migration on a fresh MySQL database before deploying
3. If circular references cause issues, split into two migrations: tables first, then foreign keys
4. Use `prisma migrate dev --name init` for the initial migration, verify the generated SQL
5. For nullable foreign keys that will be populated later, use `?` (optional) in the Prisma schema

**Warning signs:** `prisma migrate deploy` fails with "Cannot add foreign key constraint"; migration works on SQLite but not MySQL.

### Pitfall 4: Token Refresh Race Condition on Frontend

**What goes wrong:** Multiple concurrent API requests detect an expired access token simultaneously. All of them try to refresh at the same time, consuming multiple refresh tokens. With rotation enabled, the second refresh attempt uses an already-rotated token and triggers the reuse detection, logging the user out.

**Why it happens:** Axios interceptors fire independently per request. Without coordination, multiple 401 responses trigger multiple refresh calls.

**How to avoid:**
1. Implement a single refresh promise that all interceptors await
2. When the first 401 is detected, set a "refreshing" flag and create one refresh promise
3. All subsequent 401 interceptors await the same promise instead of creating new refresh calls
4. After refresh completes, retry all queued requests with the new token
5. If refresh fails, redirect to login

**Warning signs:** Users get unexpectedly logged out during page transitions with multiple API calls; "Token reuse detected" errors in production logs.

### Pitfall 5: HTTPS Enforcement Without Understanding cPanel Proxy Chain

**What goes wrong:** Developer adds HTTPS redirect middleware in Express that checks `req.protocol === 'http'` and redirects to HTTPS. But behind Passenger + Apache, the request always arrives as HTTP because Apache terminates SSL and proxies to the app via HTTP internally. The app enters an infinite redirect loop.

**Why it happens:** SSL termination happens at the Apache/cPanel level, not at the application level. The Node.js app sees internal HTTP traffic even when the user connected via HTTPS.

**How to avoid:**
1. Do NOT add HTTPS redirect in Express middleware
2. Instead, handle HTTPS enforcement at the cPanel/Apache level via `.htaccess`
3. Or check `req.headers['x-forwarded-proto'] === 'https'` (Apache sets this header)
4. Set `app.set('trust proxy', 1)` in Express so `req.secure` works correctly behind a proxy

**Warning signs:** Infinite redirect loops in production; `req.protocol` always returns 'http' even on HTTPS URLs.

### Pitfall 6: Tailwind CSS v4 Incompatibility

**What goes wrong:** Developer installs Tailwind v4 (latest) thinking it's the production-ready version. Builds break with Next.js 15, especially with Turbopack dev server. Custom theme configurations from v3 don't work in v4 (no tailwind.config.js, different dark mode setup).

**Why it happens:** Tailwind v4 was a major rewrite. It removed the config file in favor of CSS-based configuration. Not all Next.js 15 features are fully compatible.

**How to avoid:** Explicitly pin Tailwind to v3.4.x in package.json. Use `tailwindcss@^3.4` not `tailwindcss@latest`.

**Warning signs:** `darkMode: 'class'` not recognized; Turbopack dev server crashes; shadcn/ui components unstyled.

## Code Examples

### Monorepo Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

```json
// Root package.json
{
  "name": "comicstrunk",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Express App with Passenger Compatibility

```typescript
// apps/api/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { errorHandler } from './shared/middleware/error-handler';
import { logger } from './shared/lib/logger';

const app = express();

// Security
app.set('trust proxy', 1); // Trust first proxy (Apache/Passenger)
app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true, // Required for cookies
}));

// Parsing
app.use(express.json());
app.use(cookieParser());
app.use(morgan('combined'));

// Health check
app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server -- Passenger will capture this listen() call
const port = process.env.PORT || 3001;
app.listen(port, () => {
  logger.info(`API server started on port ${port}`);
});

export default app;
```

### Prisma Schema (Key Auth Tables)

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  SUBSCRIBER
  ADMIN
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  passwordHash    String    @map("password_hash")
  role            UserRole  @default(USER)
  avatarUrl       String?   @map("avatar_url")
  bio             String?   @db.Text
  acceptedTermsAt DateTime  @map("accepted_terms_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  refreshTokens   RefreshToken[]
  passwordResets  PasswordReset[]
  // ... relations to other tables defined in full schema

  @@map("users")
}

model RefreshToken {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  tokenHash   String   @map("token_hash")
  tokenFamily String   @map("token_family")
  revoked     Boolean  @default(false)
  expiresAt   DateTime @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}

model PasswordReset {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_resets")
}
```

### Money Fields Pattern (for full schema)

```prisma
// Use Decimal for all monetary values
model OrderItem {
  id                     String  @id @default(cuid())
  // ... other fields
  priceSnapshot          Decimal @map("price_snapshot") @db.Decimal(10, 2)
  commissionRateSnapshot Decimal @map("commission_rate_snapshot") @db.Decimal(5, 4)
  sellerNetSnapshot      Decimal @map("seller_net_snapshot") @db.Decimal(10, 2)
  // ...
  @@map("order_items")
}
```

### Frontend Auth API Client with Token Refresh

```typescript
// apps/web/src/lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true, // Send cookies with requests
});

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 with coordinated refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Coordinate: only one refresh at a time
      if (!refreshPromise) {
        refreshPromise = apiClient.post('/auth/refresh')
          .then((res) => {
            const newToken = res.data.data.accessToken;
            setAccessToken(newToken);
            refreshPromise = null;
            return newToken;
          })
          .catch((err) => {
            setAccessToken(null);
            refreshPromise = null;
            // Redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/pt-BR/login';
            }
            throw err;
          });
      }

      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### Shared Contracts Example

```typescript
// packages/contracts/src/auth.ts
import { z } from 'zod';

// === Schemas (validation) ===

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Must accept terms' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
});

// === Types (inferred from schemas) ===

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;

// === Response types ===

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'USER' | 'SUBSCRIBER' | 'ADMIN';
  };
}

export interface MessageResponse {
  message: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router (Next.js) | App Router (Next.js 15) | Stable since Next.js 14 (Oct 2023) | All routing, layouts, and server components use App Router patterns |
| next-i18next | next-intl 3.x | 2024 | next-intl has native App Router integration; next-i18next is Pages Router only |
| Tailwind CSS v3 config file | Tailwind CSS v4 CSS-based config | Jan 2025 | v4 removes tailwind.config.js -- but stay on v3.4 for stability with Next.js 15 |
| bcrypt (native) | bcryptjs (pure JS) on cPanel | Ongoing | Native addons problematic on restricted hosting; bcryptjs is the safe choice |
| Manual dark mode scripts | next-themes library | 2023+ | Handles SSR flash, system preference, localStorage automatically |
| Custom i18n routing | next-intl middleware | 2024 | Middleware handles locale detection, URL rewriting, routing automatically |
| PassportJS for auth | Direct jsonwebtoken | 2024+ trend | Passport adds abstraction without value for simple JWT auth on a separate API |
| Express session (cookie-based) | JWT access + httpOnly refresh cookie | Current best practice | Stateless access tokens + database-backed refresh tokens -- best of both worlds |

**Deprecated/outdated:**
- `csurf` package: Deprecated. Use `sameSite: 'strict'` cookies + proper CORS instead
- `body-parser` standalone: Built into Express 4.16+ via `express.json()`
- `dotenv` in production: Use environment variable injection from the host (cPanel UI)
- Tailwind v4 with Next.js 15: Not yet stable enough for production; stay on v3.4

## Open Questions

1. **cPanel Specific Version and Features**
   - What we know: comicstrunk.com already exists as an empty Next.js stub on cPanel
   - What's unclear: Exact cPanel version, whether Node.js Selector is available, which Node.js versions are installed, whether SSH access is available for running migrations
   - Recommendation: The deployment validation plan (01-03) must probe these specifics first. If Node.js Selector is not available but SSH is, PM2 becomes an option. If neither is available, the project may need a VPS upgrade.

2. **Subdomain vs Path Routing for API**
   - What we know: API and frontend are separate Express and Next.js apps
   - What's unclear: Whether cPanel allows two Node.js applications (one for API, one for web) or if they need to share one application entry point
   - Recommendation: Research during deployment validation. Options: (a) `api.comicstrunk.com` subdomain for API (cleanest), (b) reverse proxy in `.htaccess` routing `/api/*` to the Express app, (c) single entry point that routes to either app based on path

3. **Email Sending in Phase 1**
   - What we know: Password reset (AUTH-03) requires sending an email with a reset link
   - What's unclear: Whether to integrate Resend/email service now or defer full email setup to Phase 7
   - Recommendation: Use a minimal approach for Phase 1 -- either cPanel's built-in SMTP (most hosting includes email) via nodemailer, or Resend with a simple `sendEmail()` function. Full email template system deferred to Phase 7.

4. **Profile Avatar Upload in Phase 1**
   - What we know: AUTH-05 requires user profile editing including avatar
   - What's unclear: Whether Cloudinary integration should happen now or later
   - Recommendation: Defer avatar upload to Phase 2 or 3 when Cloudinary is needed for catalog covers anyway. Phase 1 profile endpoint accepts text fields only; avatar field exists in schema but upload UI comes later.

## Sources

### Primary (HIGH confidence)
- [Next.js Official Docs - output configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) - Standalone output, outputFileTracingRoot, monorepo tracing
- [Next.js Official Docs - Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) - Self-hosting configuration, PORT/HOSTNAME, caching, image optimization
- [next-intl Official Docs - App Router setup](https://next-intl.dev/docs/getting-started/app-router) - Complete i18n setup with defineRouting, middleware, NextIntlClientProvider
- [shadcn/ui Official Docs - Theming](https://ui.shadcn.com/docs/theming) - CSS variables, dark mode, custom colors
- [shadcn/ui Official Docs - Dark Mode Next.js](https://ui.shadcn.com/docs/dark-mode/next) - next-themes integration steps
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - ThemeProvider configuration, suppressHydrationWarning
- [pnpm Workspaces Docs](https://pnpm.io/workspaces) - Workspace configuration
- [Turborepo Docs - Repository Structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - Apps/packages split, pipeline configuration
- [Prisma Official Docs - Getting Started with Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) - Migration workflow, dev vs deploy
- [Prisma Discussion #10160](https://github.com/prisma/prisma/discussions/10160) - Decimal type for money fields

### Secondary (MEDIUM confidence)
- [cPanel Node.js Deployment Guides](https://help.lws-hosting.com/en/How-to-use-a-Nodejs-application-on-cPanel-hosting) - Passenger integration, environment variables, restart mechanism
- [Next.js GitHub Discussion #55411](https://github.com/vercel/next.js/discussions/55411) - Community experience deploying Next.js on cPanel
- [Next.js GitHub Discussion #35437](https://github.com/vercel/next.js/discussions/35437) - Standalone build in monorepos, outputFileTracingRoot usage
- [freeCodeCamp - JWT Refresh Tokens](https://www.freecodecamp.org/news/how-to-build-a-secure-authentication-system-with-jwt-and-refresh-tokens/) - Token rotation, httpOnly cookies, security best practices
- [bcrypt vs bcryptjs comparison](https://codeforgeek.com/bcrypt-vs-bcryptjs/) - Native vs pure JS, performance difference, platform compatibility

### Tertiary (LOW confidence)
- Tailwind CSS v4 stability with Next.js 15 -- based on community reports and blog posts, not official compatibility matrix. Recommendation to stay on v3.4 is conservative but safe.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries are well-established, versions verified against official docs and changelogs
- Architecture patterns: HIGH -- Monorepo structure, JWT auth flow, and Next.js standalone patterns are well-documented
- cPanel deployment: MEDIUM -- Passenger behavior is documented but varies by hosting provider; must be validated empirically
- Pitfalls: HIGH -- Race conditions, token refresh coordination, and cPanel-specific issues are well-known in the community

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days -- stable technologies, no fast-moving dependencies)
