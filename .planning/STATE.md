# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Collectors can catalog, track, and organize their physical comic book collection — knowing exactly what they have, what they've read, and what's missing from their series.
**Current focus:** Phase 1 — Foundation and Infrastructure

## Current Position

Phase: 1 of 10 (Foundation and Infrastructure)
Plan: 5 of 8 in current phase
Status: Executing
Last activity: 2026-02-22 — Completed 01-05-PLAN.md (shared contracts)

Progress: [████░░░░░░] 6%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 13 min
- Total execution time: 0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 4/8 | 51 min | 13 min |

**Recent Trend:**
- Last 5 plans: 01-01 (16 min), 01-02 (12 min), 01-03 (15 min), 01-05 (8 min)
- Trend: Steady

*Updated after each plan completion*
| Phase 01 P01 | 16min | 2 tasks | 22 files |
| Phase 01 P02 | 12min | 2 tasks | 7 files |
| Phase 01 P03 | 15min | 2 tasks | 8 files |
| Phase 01 P05 | 8min | 1 task | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phase 9 (Affiliate Deals) depends only on Phase 2 and can be pulled forward if early revenue is needed — currently placed at Phase 9 to maximize audience reach at launch
- [Roadmap]: Phase 7 (Community) and Phase 8 (Disputes) both depend on Phase 5; either can run second if sequencing needs to change
- [Infra]: cPanel deployment must be validated in Phase 1 before any application code beyond the scaffold — it is a go/no-go gate (research flag)
- [Payments]: Mercado Pago v2 SDK specifics for PIX QR generation should be verified against current developer docs before Phase 5 coding begins (research flag)
- [01-01]: API and contracts compile to CommonJS for Node.js/Passenger runtime compatibility
- [01-01]: Next.js standalone output disabled on Windows dev; will be enabled in cPanel plan (01-03)
- [01-01]: Turborepo v2 uses 'tasks' field not 'pipeline' (research doc had outdated example)
- [01-01]: Contracts package points main/types to dist/ (built CJS), not src/ (raw TS)
- [01-02]: Prisma 5.22.0 pinned (not latest) for Node.js 20.9.0 compatibility
- [01-02]: Migration generated offline via prisma migrate diff (no live DB required)
- [01-02]: All 40 models defined upfront so no destructive migrations in future phases
- [01-02]: Seed uses deterministic IDs and upsert for idempotent reruns
- [01-03]: Next.js standalone output enabled conditionally via CI or STANDALONE env var (avoids Windows symlink EPERM)
- [01-03]: Prisma client singleton created in shared/lib for reuse across API modules
- [01-03]: HTTPS enforcement handled by Apache .htaccess rewrite rules, not Express middleware
- [01-03]: cPanel production deployment deferred to later validation -- local dev confirmed working
- [01-05]: Contracts kept CJS build output (dist/) for Node.js runtime -- not switched to direct TS consumption
- [01-05]: Password schema reused between signup and reset-confirm via shared Zod constant
- [01-05]: Social handle transforms strip leading @ during Zod parse

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] cPanel production deployment not yet validated — deployment scripts and config ready, awaiting hosting environment setup (user approved deferral)
- [Phase 5] Mercado Pago v2 webhook payload structure may have changed; verify at developers.mercadopago.com before coding
- [Phase 2] Initial catalog seed data (Panini Brasil, Mythos, Devir titles) source and scope not yet defined

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 01-05-PLAN.md (shared contracts)
Resume file: .planning/phases/01-foundation-and-infrastructure/01-05-SUMMARY.md
