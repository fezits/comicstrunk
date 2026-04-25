#!/usr/bin/env tsx
/**
 * fetch-gcd-covers.ts — Fetch cover URLs from GCD API for entries without covers.
 *
 * The GCD API returns a `cover` field with a direct CDN URL per issue.
 * This script fetches that URL and saves it to coverImageUrl.
 *
 * Rate limit: ~20 requests/hour (anonymous). Script handles 429 gracefully.
 *
 * Usage:
 *   npx tsx scripts/fetch-gcd-covers.ts [options]
 *
 * Options:
 *   --limit N       Max entries to process per run (default: 18)
 *   --delay N       Delay between API calls in ms (default: 200000 = 3.3min)
 *   --batch N       Process N entries then stop (for cron usage, default: 18)
 *   --fast          Use 3s delay (risks rate limit, for testing)
 *   --dry-run       Fetch but don't update database
 *   --status        Just show how many entries need covers
 *   --continuous    Run forever until all covers are fetched (handles 429 auto)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GCD_API = 'https://www.comics.org/api';
const STATE_FILE = path.resolve(__dirname, '.gcd-covers-state.json');

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const IS_FAST = args.includes('--fast');
const DRY_RUN = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');
const CONTINUOUS = args.includes('--continuous');
const BATCH_SIZE = CONTINUOUS ? 999999 : parseInt(getArg('--batch') || getArg('--limit') || '18', 10);
// Default: 200s between calls = 18 calls/hour (safely under 20/hr limit)
const DELAY_MS = parseInt(getArg('--delay') || (IS_FAST ? '3000' : '200000'), 10);

// ─── State ────────────────────────────────────────────────────────────────────

interface CoverState {
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  lastProcessedId: string | null;
}

function loadState(): CoverState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return { processed: 0, found: 0, notFound: 0, errors: 0, lastProcessedId: null };
}

function saveState(state: CoverState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── API ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface GCDIssueResponse {
  cover: string;
  series_name: string;
  number: string;
}

interface FetchResult {
  coverUrl: string | null;
  rateLimited: boolean;
  retryAfterMs: number;
}

async function fetchCoverUrl(issueId: number): Promise<FetchResult> {
  const url = `${GCD_API}/issue/${issueId}/?format=json`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ComicsTrunk/1.0 (cover-fetch; https://comicstrunk.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '3600', 10);
        return { coverUrl: null, rateLimited: true, retryAfterMs: (retryAfter + 60) * 1000 };
      }

      if (res.status === 404) return { coverUrl: null, rateLimited: false, retryAfterMs: 0 };

      if (!res.ok) {
        console.warn(`  [${res.status}] Issue ${issueId}`);
        if (attempt < 3) { await sleep(5000); continue; }
        return { coverUrl: null, rateLimited: false, retryAfterMs: 0 };
      }

      const data = (await res.json()) as GCDIssueResponse;
      return { coverUrl: data.cover || null, rateLimited: false, retryAfterMs: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [ERR] Issue ${issueId}: ${msg} (attempt ${attempt})`);
      if (attempt < 3) await sleep(5000);
    }
  }
  return { coverUrl: null, rateLimited: false, retryAfterMs: 0 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Count entries needing covers
  const totalNeedCovers = await prisma.catalogEntry.count({
    where: {
      sourceKey: { startsWith: 'gcd:' },
      coverImageUrl: null,
    },
  });

  const totalGcd = await prisma.catalogEntry.count({
    where: { sourceKey: { startsWith: 'gcd:' } },
  });

  const alreadyHaveCovers = totalGcd - totalNeedCovers;

  console.log(`GCD Cover Fetcher`);
  console.log(`  Total GCD entries: ${totalGcd.toLocaleString()}`);
  console.log(`  Already have covers: ${alreadyHaveCovers.toLocaleString()}`);
  console.log(`  Need covers: ${totalNeedCovers.toLocaleString()}`);

  if (STATUS_ONLY) {
    const state = loadState();
    console.log(`  Lifetime processed: ${state.processed} (found: ${state.found}, not found: ${state.notFound}, errors: ${state.errors})`);
    const hoursRemaining = Math.ceil(totalNeedCovers / 18);
    console.log(`  Estimated time at 18/hr: ~${hoursRemaining} hours (~${Math.ceil(hoursRemaining / 24)} days)`);
    await prisma.$disconnect();
    return;
  }

  if (totalNeedCovers === 0) {
    console.log('  All GCD entries have covers!');
    await prisma.$disconnect();
    return;
  }

  console.log(`  Batch size: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms | Dry run: ${DRY_RUN}`);
  console.log('');

  const state = loadState();

  let totalProcessed = 0;

  // Main loop — supports both batch and continuous modes
  while (true) {
    const entries = await prisma.catalogEntry.findMany({
      where: {
        sourceKey: { startsWith: 'gcd:' },
        coverImageUrl: null,
      },
      select: { id: true, sourceKey: true, title: true },
      orderBy: { createdAt: 'asc' },
      take: Math.min(BATCH_SIZE - totalProcessed, 50),
    });

    if (entries.length === 0) {
      console.log('\n  All GCD entries have covers! Done.');
      break;
    }

    for (let i = 0; i < entries.length; i++) {
      if (totalProcessed >= BATCH_SIZE) break;

      const entry = entries[i];
      const issueId = parseInt(entry.sourceKey!.replace('gcd:', ''), 10);

      process.stdout.write(`  [${state.processed + 1}] ${entry.title} (gcd:${issueId})...`);

      const result = await fetchCoverUrl(issueId);

      if (result.rateLimited) {
        const waitMin = Math.ceil(result.retryAfterMs / 60000);
        console.log(`\n  [429] Rate limited. Sleeping ${waitMin} min...`);
        await sleep(result.retryAfterMs);
        i--; // Retry this entry
        continue;
      }

      if (result.coverUrl) {
        if (!DRY_RUN) {
          await prisma.catalogEntry.update({
            where: { id: entry.id },
            data: { coverImageUrl: result.coverUrl },
          });
        }
        state.found++;
        console.log(` found`);
      } else {
        state.notFound++;
        console.log(` no cover`);
      }

      state.processed++;
      totalProcessed++;
      state.lastProcessedId = entry.id;
      saveState(state);

      // Delay between calls
      if (i < entries.length - 1 || CONTINUOUS) {
        await sleep(DELAY_MS);
      }
    }

    if (totalProcessed >= BATCH_SIZE && !CONTINUOUS) break;
  }

  const remaining = totalNeedCovers - totalProcessed;
  console.log(`\n--- Summary ---`);
  console.log(`  This run: ${totalProcessed} processed`);
  console.log(`  Covers found: ${state.found} | No cover: ${state.notFound}`);
  console.log(`  Lifetime: ${state.processed} total`);
  if (remaining > 0) console.log(`  Remaining: ${remaining.toLocaleString()}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
