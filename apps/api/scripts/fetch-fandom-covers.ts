#!/usr/bin/env tsx
/**
 * fetch-fandom-covers.ts — Fetch cover images from Fandom wikis (DC, Marvel, Image).
 *
 * Uses the MediaWiki API which has no strict rate limit and returns cover URLs
 * from static.wikia.nocookie.net CDN.
 *
 * Wiki page naming: "{Series}_Vol_{Volume}_{Number}"
 * e.g. "Detective_Comics_Vol_2_27", "Amazing_Spider-Man_Vol_1_1", "Spawn_Vol_1_1"
 *
 * Usage:
 *   npx tsx scripts/fetch-fandom-covers.ts [options]
 *
 * Options:
 *   --limit N       Max entries to process (default: all)
 *   --publisher X   Filter: marvel | dc | image | all (default: all)
 *   --delay N       Delay between API calls in ms (default: 1000)
 *   --dry-run       Fetch but don't update database
 *   --status        Show stats only
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');
const PUBLISHER_FILTER = (getArg('--publisher') || 'all').toLowerCase();
const LIMIT = parseInt(getArg('--limit') || '0', 10);
const DELAY_MS = parseInt(getArg('--delay') || '1000', 10);

// ─── Fandom Wiki Config ──────────────────────────────────────────────────────

interface WikiConfig {
  apiUrl: string;
  publishers: string[];
}

const WIKIS: Record<string, WikiConfig> = {
  dc: {
    apiUrl: 'https://dc.fandom.com/api.php',
    publishers: ['DC Comics', 'DC'],
  },
  marvel: {
    apiUrl: 'https://marvel.fandom.com/api.php',
    publishers: ['Marvel Comics', 'Marvel'],
  },
  image: {
    apiUrl: 'https://imagecomics.fandom.com/api.php',
    publishers: ['Image Comics', 'Image'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Convert our entry data to Fandom wiki page title format.
 * Examples:
 *   "The Amazing Spider-Man #1" (volume 1) → "Amazing_Spider-Man_Vol_1_1"
 *   "Batman #50" (volume 1) → "Batman_Vol_1_50"
 *   "Spawn #100" (volume 1) → "Spawn_Vol_1_100"
 */
function buildWikiTitle(seriesName: string, issueNumber: string, volume: string): string[] {
  // Clean series name: remove "The " prefix (wiki pages don't use it)
  let clean = seriesName.replace(/^The\s+/i, '').trim();
  // Replace spaces with underscores
  clean = clean.replace(/\s+/g, '_');

  const vol = volume || '1';
  const num = issueNumber.replace(/^#/, '').trim();

  // Try multiple naming conventions (most common first)
  const candidates: string[] = [];

  // Always try Vol 1 first (most series are Vol 1)
  candidates.push(`${clean}_Vol_1_${num}`);

  // If a different volume was specified, try that too
  if (vol !== '1') {
    candidates.push(`${clean}_Vol_${vol}_${num}`);
  }

  // Try Vol 2 and 3 (common for relaunched series)
  candidates.push(`${clean}_Vol_2_${num}`);
  candidates.push(`${clean}_Vol_3_${num}`);

  // Without "The" prefix removed (some wiki pages keep it)
  if (seriesName.match(/^The\s+/i)) {
    const withThe = seriesName.trim().replace(/\s+/g, '_');
    candidates.push(`${withThe}_Vol_1_${num}`);
  }

  // Deduplicate
  return [...new Set(candidates)];
}

/**
 * Extract issue number from our title format "Series Name #123"
 */
function extractIssueNumber(title: string): string | null {
  const match = title.match(/#(\d+[a-zA-Z]?)$/);
  return match ? match[1] : null;
}

/**
 * Fetch cover image URL from Fandom MediaWiki API.
 * Uses pageimages prop which returns the main image of an article.
 */
async function fetchFandomCover(
  apiUrl: string,
  pageTitle: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: pageTitle,
    prop: 'pageimages',
    format: 'json',
    pithumbsize: '600',
  });

  try {
    const res = await fetch(`${apiUrl}?${params}`, {
      headers: { 'User-Agent': 'ComicsTrunk/1.0 (cover-fetch; https://comicstrunk.com)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    // The API returns pages keyed by page ID; -1 means not found
    for (const [pageId, page] of Object.entries(pages) as [string, any][]) {
      if (pageId === '-1') continue;
      if (page.thumbnail?.source) {
        // Get full resolution: remove the /scale-to-width-down/... part
        let url = page.thumbnail.source;
        // Try to get a larger version by replacing width
        url = url.replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/600');
        return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Try multiple wiki page title candidates for an entry.
 */
async function findCover(
  apiUrl: string,
  seriesName: string,
  issueNumber: string,
  volume: string,
): Promise<string | null> {
  const candidates = buildWikiTitle(seriesName, issueNumber, volume);

  for (const title of candidates) {
    const url = await fetchFandomCover(apiUrl, title);
    if (url) return url;
    await sleep(300); // Small delay between retries
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Determine which publishers to process
  const publisherNames: string[] = [];
  const wikiConfigs: { wiki: string; config: WikiConfig }[] = [];

  if (PUBLISHER_FILTER === 'all') {
    for (const [key, config] of Object.entries(WIKIS)) {
      wikiConfigs.push({ wiki: key, config });
      publisherNames.push(...config.publishers);
    }
  } else if (WIKIS[PUBLISHER_FILTER]) {
    wikiConfigs.push({ wiki: PUBLISHER_FILTER, config: WIKIS[PUBLISHER_FILTER] });
    publisherNames.push(...WIKIS[PUBLISHER_FILTER].publishers);
  } else {
    console.error(`Unknown publisher: ${PUBLISHER_FILTER}`);
    process.exit(1);
  }

  // Count entries needing covers
  const totalNeedCovers = await prisma.catalogEntry.count({
    where: {
      sourceKey: { startsWith: 'gcd:' },
      coverImageUrl: null,
      publisher: { in: publisherNames },
    },
  });

  console.log('Fandom Cover Fetcher');
  console.log(`  Need covers: ${totalNeedCovers.toLocaleString()}`);
  console.log(`  Publishers: ${publisherNames.join(', ')}`);
  console.log(`  Delay: ${DELAY_MS}ms | Dry run: ${DRY_RUN}`);

  if (STATUS_ONLY) {
    await prisma.$disconnect();
    return;
  }

  if (totalNeedCovers === 0) {
    console.log('  All entries have covers!');
    await prisma.$disconnect();
    return;
  }

  console.log('');

  let found = 0;
  let notFound = 0;
  let errors = 0;
  let processed = 0;

  // Process each publisher
  for (const { wiki, config } of wikiConfigs) {
    const entries = await prisma.catalogEntry.findMany({
      where: {
        sourceKey: { startsWith: 'gcd:' },
        coverImageUrl: null,
        publisher: { in: config.publishers },
      },
      select: {
        id: true,
        title: true,
        publisher: true,
        volumeNumber: true,
        series: { select: { title: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: LIMIT > 0 ? LIMIT : undefined,
    });

    if (entries.length === 0) continue;

    console.log(`--- ${wiki.toUpperCase()} (${entries.length} entries) ---`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const issueNumber = extractIssueNumber(entry.title);
      const seriesName = entry.series?.title || entry.title.replace(/#\d+[a-zA-Z]?$/, '').trim();
      // GCD import stored issue numbers in volumeNumber field.
      // Real comic volumes are rarely > 5, so anything higher is wrong data.
      // We try vol 1 first, then the stored value as fallback.
      const rawVol = entry.volumeNumber ? Number(entry.volumeNumber) : 1;
      const volume = rawVol > 5 ? '1' : String(rawVol);

      if (!issueNumber) {
        notFound++;
        processed++;
        continue;
      }

      process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.title}...`);

      try {
        const coverUrl = await findCover(config.apiUrl, seriesName, issueNumber, volume);

        if (coverUrl) {
          if (!DRY_RUN) {
            await prisma.catalogEntry.update({
              where: { id: entry.id },
              data: { coverImageUrl: coverUrl },
            });
          }
          found++;
          console.log(` found`);
        } else {
          notFound++;
          console.log(` not found`);
        }
      } catch (err: unknown) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(` error: ${msg}`);
      }

      processed++;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Processed: ${processed.toLocaleString()}`);
  console.log(`  Found: ${found.toLocaleString()}`);
  console.log(`  Not found: ${notFound.toLocaleString()}`);
  console.log(`  Errors: ${errors.toLocaleString()}`);
  console.log(`  Hit rate: ${processed > 0 ? ((found / processed) * 100).toFixed(1) : 0}%`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
