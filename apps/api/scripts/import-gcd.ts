#!/usr/bin/env tsx
/**
 * import-gcd.ts — Import comics from Grand Comics Database (comics.org) REST API.
 *
 * Uses the GCD REST API to search series, fetch issue data, and import
 * into the ComicsTrunk catalog. Respects rate limits and deduplicates
 * against existing entries.
 *
 * Usage:
 *   npx tsx scripts/import-gcd.ts [options]
 *
 * Options:
 *   --test              Run small test (20 issues per series, 3 series)
 *   --dry-run           Fetch and save JSON but don't import to DB
 *   --series "Name"     Import a specific series name (can repeat)
 *   --publisher marvel   Filter by publisher (marvel|dc|image|all) default: all
 *   --limit N           Max issues per series (default: unlimited, test=20)
 *   --delay N           Delay between API calls in ms (default: 2500)
 *   --resume            Resume from saved state file
 *   --list-only         Only list discovered series, don't fetch issues
 *
 * Data source: https://www.comics.org/api/
 * License: Creative Commons Attribution 3.0 (GCD data)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importFromJSON,
  type ImportProgressCallback,
} from '../src/modules/catalog/catalog-import.service';

// ─── Configuration ────────────────────────────────────────────────────────────

const GCD_API = 'https://www.comics.org/api';
const STATE_FILE = path.resolve(__dirname, '.gcd-import-state.json');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'data', 'gcd');
const ADMIN_EMAIL = 'admin@comicstrunk.com';

const PUBLISHERS: Record<string, { id: number; name: string; publisherUrl: string }> = {
  marvel: { id: 78, name: 'Marvel Comics', publisherUrl: `${GCD_API}/publisher/78/` },
  dc: { id: 54, name: 'DC Comics', publisherUrl: `${GCD_API}/publisher/54/` },
  image: { id: 709, name: 'Image Comics', publisherUrl: `${GCD_API}/publisher/709/` },
};

// Curated list of iconic series to search for per publisher
const SERIES_LIST: Record<string, string[]> = {
  marvel: [
    'The Amazing Spider-Man',
    'Uncanny X-Men',
    'The Avengers',
    'Fantastic Four',
    'Daredevil',
    'Captain America',
    'The Invincible Iron Man',
    'The Mighty Thor',
    'The Incredible Hulk',
    'Wolverine',
    'Deadpool',
    'X-Men',
    'Spider-Man',
    'New Avengers',
    'Guardians of the Galaxy',
    'Black Panther',
    'Moon Knight',
    'Punisher',
    'Ghost Rider',
    'Venom',
    'Silver Surfer',
    'Doctor Strange',
    'Hawkeye',
    'Ms. Marvel',
    'Iron Fist',
  ],
  dc: [
    'Batman',
    'Superman',
    'Wonder Woman',
    'Justice League of America',
    'The Flash',
    'Green Lantern',
    'Aquaman',
    'Teen Titans',
    'Nightwing',
    'Swamp Thing',
    'The Sandman',
    'Action Comics',
    'Detective Comics',
    'Green Arrow',
    'Batgirl',
    'Harley Quinn',
    'Suicide Squad',
    'Justice League',
    'Doom Patrol',
    'Hellblazer',
  ],
  image: [
    'Spawn',
    'Invincible',
    'The Walking Dead',
    'Saga',
    'Savage Dragon',
    'Witchblade',
    'Deadly Class',
    'East of West',
    'Descender',
    'Paper Girls',
    'Monstress',
    'Kill or Be Killed',
    'Criminal',
    'Sex Criminals',
    'Chew',
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GCDSeriesResult {
  api_url: string;
  name: string;
  country: string;
  language: string;
  active_issues: string[];
  issue_descriptors: string[];
  year_began: number;
  year_ended: number | null;
  publisher: string;
  publishing_format: string;
  color: string;
  dimensions: string;
  paper_stock: string;
  binding: string;
  notes: string;
}

interface GCDIssueResult {
  api_url: string;
  series_name: string;
  descriptor: string;
  number: string;
  volume: string;
  variant_name: string;
  title: string;
  publication_date: string;
  key_date: string;
  on_sale_date: string;
  price: string;
  page_count: string;
  editing: string;
  indicia_publisher: string;
  brand_emblem: string;
  isbn: string;
  barcode: string;
  rating: string;
  notes: string;
  variant_of: string | null;
  series: string;
  keywords: string;
  cover: string;
  story_set: GCDStory[];
}

interface GCDStory {
  type: string;
  title: string;
  feature: string;
  sequence_number: number;
  page_count: string;
  script: string;
  pencils: string;
  inks: string;
  colors: string;
  letters: string;
  editing: string;
  genre: string;
  characters: string;
  synopsis: string;
  notes: string;
  keywords: string;
}

interface GCDPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface DiscoveredSeries {
  apiUrl: string;
  seriesId: number;
  name: string;
  publisher: string;
  publisherId: number;
  yearBegan: number;
  yearEnded: number | null;
  issueCount: number;
  issueUrls: string[];
  format: string;
}

interface ImportState {
  phase: 'discover' | 'fetch_issues' | 'import';
  discoveredSeries: DiscoveredSeries[];
  fetchedIssues: Record<string, GCDIssueResult[]>; // seriesId → issues
  lastFetchedSeriesIdx: number;
  lastFetchedIssueIdx: number;
  totalFetched: number;
  totalErrors: number;
}

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function getArgMulti(flag: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      results.push(args[i + 1]);
    }
  }
  return results;
}

const IS_TEST = args.includes('--test');
const DRY_RUN = args.includes('--dry-run');
const LIST_ONLY = args.includes('--list-only');
const RESUME = args.includes('--resume');
const PUBLISHER_FILTER = (getArg('--publisher') || 'all').toLowerCase();
const CUSTOM_SERIES = getArgMulti('--series');
const ISSUE_LIMIT = parseInt(getArg('--limit') || (IS_TEST ? '20' : '0'), 10);
const DELAY_MS = parseInt(getArg('--delay') || '2500', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let requestCount = 0;
let lastRequestTime = 0;

async function gcdFetch<T>(url: string): Promise<T | null> {
  // Enforce rate limiting
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < DELAY_MS) {
    await sleep(DELAY_MS - elapsed);
  }

  const fullUrl = url.includes('format=json') ? url : `${url}${url.includes('?') ? '&' : '?'}format=json`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      lastRequestTime = Date.now();
      requestCount++;
      const res = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'ComicsTrunk/1.0 (catalog import; https://comicstrunk.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`  [429] Rate limited. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        console.warn(`  [${res.status}] ${fullUrl}`);
        if (attempt < 3) {
          await sleep(5000 * attempt);
          continue;
        }
        return null;
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [ERR] ${msg} (attempt ${attempt}/3)`);
      if (attempt < 3) await sleep(5000 * attempt);
    }
  }
  return null;
}

function extractIdFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?\??/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractPublisherIdFromUrl(url: string): number {
  const match = url.match(/publisher\/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getPublisherName(publisherUrl: string): string {
  const id = extractPublisherIdFromUrl(publisherUrl);
  for (const [, pub] of Object.entries(PUBLISHERS)) {
    if (pub.id === id) return pub.name;
  }
  return `Publisher #${id}`;
}

function parsePrice(priceStr: string): number | undefined {
  if (!priceStr) return undefined;
  // Extract first USD price: "2.95 USD; 4.50 CAD" → 2.95
  const match = priceStr.match(/(\d+\.?\d*)\s*USD/i);
  if (match) return parseFloat(match[1]);
  // Try first number
  const numMatch = priceStr.match(/(\d+\.?\d*)/);
  return numMatch ? parseFloat(numMatch[1]) : undefined;
}

function parseKeyDate(keyDate: string): { year: number | null; month: number | null } {
  if (!keyDate) return { year: null, month: null };
  const match = keyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    return {
      year: year >= 1900 && year <= 2100 ? year : null,
      month: month >= 1 && month <= 12 ? month : null,
    };
  }
  return { year: null, month: null };
}

function formatPubDate(keyDate: string): string | undefined {
  const { year, month } = parseKeyDate(keyDate);
  if (!year) return undefined;
  if (month) return `${month}/${year}`;
  return `${year}`;
}

function extractCharacters(storySet: GCDStory[]): string[] {
  const chars = new Set<string>();
  for (const story of storySet) {
    if (story.type !== 'comic story' && story.type !== 'cover') continue;
    if (!story.characters) continue;
    // GCD format: "Batman [Bruce Wayne]; Robin [Dick Grayson]; The Joker"
    const parts = story.characters.split(';');
    for (const part of parts) {
      const name = part.replace(/\[.*?\]/g, '').trim();
      if (name && name.length > 1 && name.length < 100) {
        chars.add(name);
      }
    }
  }
  return Array.from(chars).slice(0, 20); // Limit to 20 characters
}

function extractGenres(storySet: GCDStory[]): string[] {
  const genres = new Set<string>();
  for (const story of storySet) {
    if (!story.genre) continue;
    const parts = story.genre.split(';');
    for (const part of parts) {
      const g = part.trim().toLowerCase();
      if (g && g.length > 1) genres.add(g);
    }
  }
  return Array.from(genres);
}

function extractCreators(storySet: GCDStory[]): string | undefined {
  // Get the main comic story's writer
  for (const story of storySet) {
    if (story.type !== 'comic story') continue;
    if (story.script) {
      // Clean up: "Stan Lee (script)" → "Stan Lee"
      return story.script.replace(/\s*\(.*?\)/g, '').split(';')[0].trim() || undefined;
    }
  }
  return undefined;
}

function buildTitle(issue: GCDIssueResult): string {
  // "Batman: Dark Victory (1999 series)" → "Batman: Dark Victory"
  let seriesName = issue.series_name.replace(/\s*\(\d{4}\s+series\)/i, '').trim();

  if (issue.number && issue.number !== '[nn]') {
    return `${seriesName} #${issue.number}`;
  }
  if (issue.title) {
    return `${seriesName}: ${issue.title}`;
  }
  return seriesName;
}

function buildSeriesName(seriesName: string): string {
  return seriesName.replace(/\s*\(\d{4}\s+series\)/i, '').trim();
}

// ─── State Management ─────────────────────────────────────────────────────────

function loadState(): ImportState {
  if (RESUME && fs.existsSync(STATE_FILE)) {
    console.log('Resuming from saved state...');
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return {
    phase: 'discover',
    discoveredSeries: [],
    fetchedIssues: {},
    lastFetchedSeriesIdx: -1,
    lastFetchedIssueIdx: -1,
    totalFetched: 0,
    totalErrors: 0,
  };
}

function saveState(state: ImportState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Phase 1: Discover Series ─────────────────────────────────────────────────

async function discoverSeries(state: ImportState): Promise<void> {
  console.log('\n=== Phase 1: Discovering Series ===\n');

  const publisherIds = new Set<number>();
  const searchNames: string[] = [];

  if (CUSTOM_SERIES.length > 0) {
    // Custom series names from --series args
    searchNames.push(...CUSTOM_SERIES);
    if (PUBLISHER_FILTER !== 'all' && PUBLISHERS[PUBLISHER_FILTER]) {
      publisherIds.add(PUBLISHERS[PUBLISHER_FILTER].id);
    } else {
      Object.values(PUBLISHERS).forEach((p) => publisherIds.add(p.id));
    }
  } else {
    // Use curated list
    const publishers = PUBLISHER_FILTER === 'all'
      ? Object.keys(SERIES_LIST)
      : [PUBLISHER_FILTER];

    for (const pub of publishers) {
      if (!SERIES_LIST[pub]) {
        console.warn(`Unknown publisher: ${pub}`);
        continue;
      }
      publisherIds.add(PUBLISHERS[pub].id);
      const seriesList = IS_TEST ? SERIES_LIST[pub].slice(0, 1) : SERIES_LIST[pub];
      searchNames.push(...seriesList);
    }
  }

  console.log(`Searching for ${searchNames.length} series names...`);
  console.log(`Publisher filter: ${[...publisherIds].map((id) => {
    const entry = Object.entries(PUBLISHERS).find(([, p]) => p.id === id);
    return entry ? entry[1].name : `#${id}`;
  }).join(', ')}\n`);

  for (const name of searchNames) {
    process.stdout.write(`  Searching "${name}"...`);
    const url = `${GCD_API}/series/name/${encodeURIComponent(name)}/`;
    const data = await gcdFetch<GCDPaginatedResponse<GCDSeriesResult>>(url);

    if (!data || data.count === 0) {
      console.log(' no results');
      continue;
    }

    // Filter: US + English + matching publisher + main runs
    const matching = data.results.filter((s) => {
      if (s.country !== 'us') return false;
      if (s.language !== 'en') return false;
      const pubId = extractPublisherIdFromUrl(s.publisher);
      if (!publisherIds.has(pubId)) return false;
      if (s.active_issues.length === 0) return false;
      return true;
    });

    if (matching.length === 0) {
      console.log(` ${data.count} results, 0 matching filters`);
      // Try next page if there are more results
      if (data.next) {
        const page2 = await gcdFetch<GCDPaginatedResponse<GCDSeriesResult>>(data.next);
        if (page2) {
          const matching2 = page2.results.filter((s) => {
            if (s.country !== 'us') return false;
            if (s.language !== 'en') return false;
            const pubId = extractPublisherIdFromUrl(s.publisher);
            if (!publisherIds.has(pubId)) return false;
            if (s.active_issues.length === 0) return false;
            return true;
          });
          if (matching2.length > 0) {
            matching.push(...matching2);
          }
        }
      }
      if (matching.length === 0) continue;
    }

    // Pick the best match: longest running, most issues, exact name match
    // Sort by: exact name match first, then by issue count
    matching.sort((a, b) => {
      const aExact = a.name.toLowerCase() === name.toLowerCase() ? 1 : 0;
      const bExact = b.name.toLowerCase() === name.toLowerCase() ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      // Prefer series with "The" prefix matching
      const aHasThe = a.name.toLowerCase().startsWith('the ') && name.toLowerCase().startsWith('the ');
      const bHasThe = b.name.toLowerCase().startsWith('the ') && name.toLowerCase().startsWith('the ');
      if (aHasThe !== bHasThe) return aHasThe ? -1 : 1;
      return b.active_issues.length - a.active_issues.length;
    });

    // Take the top match (or top 2 if they're different eras)
    const picks = [matching[0]];
    if (matching.length > 1 && matching[1].active_issues.length > 50) {
      // Second pick only if it's also substantial
      const firstYear = matching[0].year_began;
      const secondYear = matching[1].year_began;
      if (Math.abs(firstYear - secondYear) > 10) {
        picks.push(matching[1]);
      }
    }

    for (const series of picks) {
      const seriesId = extractIdFromUrl(series.api_url);
      const pubId = extractPublisherIdFromUrl(series.publisher);

      // Skip if already discovered
      if (state.discoveredSeries.some((s) => s.seriesId === seriesId)) continue;

      const discovered: DiscoveredSeries = {
        apiUrl: series.api_url,
        seriesId,
        name: series.name,
        publisher: getPublisherName(series.publisher),
        publisherId: pubId,
        yearBegan: series.year_began,
        yearEnded: series.year_ended,
        issueCount: series.active_issues.length,
        issueUrls: series.active_issues,
        format: series.publishing_format || '',
      };

      state.discoveredSeries.push(discovered);
      console.log(
        ` found "${series.name}" (${series.year_began}${series.year_ended ? '-' + series.year_ended : '-present'}) — ${series.active_issues.length} issues`,
      );
    }
  }

  console.log(
    `\nDiscovered ${state.discoveredSeries.length} series with ${state.discoveredSeries.reduce((sum, s) => sum + s.issueCount, 0)} total issues`,
  );
  state.phase = 'fetch_issues';
  saveState(state);
}

// ─── Phase 2: Fetch Issue Details ─────────────────────────────────────────────

async function fetchIssues(state: ImportState): Promise<void> {
  console.log('\n=== Phase 2: Fetching Issue Details ===\n');

  const startSeriesIdx = state.lastFetchedSeriesIdx + 1;

  for (let si = startSeriesIdx; si < state.discoveredSeries.length; si++) {
    const series = state.discoveredSeries[si];
    const issueUrls = ISSUE_LIMIT > 0
      ? series.issueUrls.slice(0, ISSUE_LIMIT)
      : series.issueUrls;

    if (!state.fetchedIssues[series.seriesId]) {
      state.fetchedIssues[series.seriesId] = [];
    }

    const startIssueIdx = si === startSeriesIdx && state.lastFetchedIssueIdx >= 0
      ? state.lastFetchedIssueIdx + 1
      : state.fetchedIssues[series.seriesId].length;

    console.log(
      `[${si + 1}/${state.discoveredSeries.length}] ${series.name} (${series.publisher}) — ${issueUrls.length} issues`,
    );

    for (let ii = startIssueIdx; ii < issueUrls.length; ii++) {
      const issueUrl = issueUrls[ii];
      const issueId = extractIdFromUrl(issueUrl);

      process.stdout.write(
        `\r  Issue ${ii + 1}/${issueUrls.length} (ID: ${issueId}) — total: ${state.totalFetched} fetched, ${state.totalErrors} errors    `,
      );

      const issue = await gcdFetch<GCDIssueResult>(issueUrl);

      if (issue) {
        state.fetchedIssues[series.seriesId].push(issue);
        state.totalFetched++;
      } else {
        state.totalErrors++;
      }

      state.lastFetchedIssueIdx = ii;

      // Save state periodically (every 50 issues)
      if ((ii + 1) % 50 === 0) {
        saveState(state);
      }
    }

    console.log(
      `\n  ✓ ${state.fetchedIssues[series.seriesId].length} issues fetched for ${series.name}`,
    );

    state.lastFetchedSeriesIdx = si;
    state.lastFetchedIssueIdx = -1;
    saveState(state);
  }

  state.phase = 'import';
  saveState(state);
  console.log(`\nTotal: ${state.totalFetched} issues fetched, ${state.totalErrors} errors`);
}

// ─── Phase 3: Transform & Import ──────────────────────────────────────────────

interface ImportRow {
  name: string;
  id?: string;
  isbn?: string;
  sourceKey: string;
  publisher: string;
  imprint?: string;
  author?: string;
  description?: string;
  series?: string;
  volumeNumber?: number | string;
  categories?: string[];
  tags?: string[];
  characters?: string[];
  price?: number;
  pubDate?: string;
  pages?: number | string;
  coverUrl?: string;
}

function transformIssue(issue: GCDIssueResult, series: DiscoveredSeries): ImportRow | null {
  // Skip variants (they're duplicates with different covers)
  if (issue.variant_of) return null;
  if (issue.variant_name && issue.variant_name.toLowerCase().includes('variant')) return null;

  const title = buildTitle(issue);
  if (!title || title.length < 2) return null;

  const issueId = extractIdFromUrl(issue.api_url);
  const price = parsePrice(issue.price);
  const pubDate = formatPubDate(issue.key_date);
  const pageCount = issue.page_count ? Math.round(parseFloat(issue.page_count)) : undefined;
  const characters = extractCharacters(issue.story_set || []);
  const genres = extractGenres(issue.story_set || []);
  const author = extractCreators(issue.story_set || []);
  const seriesName = buildSeriesName(issue.series_name);

  // Map publisher to category
  const categories: string[] = [];
  if (series.publisherId === PUBLISHERS.marvel.id) categories.push('Marvel', 'Super-herois');
  else if (series.publisherId === PUBLISHERS.dc.id) categories.push('DC Comics', 'Super-herois');
  else if (series.publisherId === PUBLISHERS.image.id) categories.push('Image Comics');

  // Add genre-based categories
  for (const genre of genres) {
    if (genre.includes('superhero')) { if (!categories.includes('Super-herois')) categories.push('Super-herois'); }
    else if (genre.includes('horror')) categories.push('Horror');
    else if (genre.includes('science fiction')) categories.push('Ficção Científica');
    else if (genre.includes('fantasy')) categories.push('Fantasia');
    else if (genre.includes('crime')) categories.push('Crime');
    else if (genre.includes('war')) categories.push('Guerra');
  }

  const row: ImportRow = {
    name: title,
    sourceKey: `gcd:${issueId}`,
    publisher: issue.indicia_publisher || series.publisher,
    series: seriesName,
    categories,
    characters: characters.length > 0 ? characters : undefined,
    tags: genres.length > 0 ? genres : undefined,
    coverUrl: issue.cover || undefined,
  };

  if (issue.barcode) row.id = issue.barcode;
  if (issue.isbn) row.isbn = issue.isbn;
  if (price && price > 0) row.price = price;
  if (pubDate) row.pubDate = pubDate;
  if (pageCount && pageCount > 0) row.pages = pageCount;
  if (author) row.author = author;
  if (issue.volume) row.volumeNumber = issue.volume;

  return row;
}

async function transformAndImport(state: ImportState): Promise<void> {
  console.log('\n=== Phase 3: Transform & Import ===\n');

  // Transform all issues
  const allRows: ImportRow[] = [];
  const skippedVariants = { count: 0 };

  for (const series of state.discoveredSeries) {
    const issues = state.fetchedIssues[series.seriesId] || [];
    for (const issue of issues) {
      const row = transformIssue(issue, series);
      if (row) {
        allRows.push(row);
      } else {
        skippedVariants.count++;
      }
    }
  }

  console.log(`Transformed ${allRows.length} issues (${skippedVariants.count} variants skipped)`);

  // Save JSON output
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = path.join(OUTPUT_DIR, `gcd-import-${timestamp}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(allRows, null, 2));
  console.log(`Saved to ${outputFile}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping database import.');
    printSummary(allRows);
    return;
  }

  // Import to database
  console.log('\nImporting to database...\n');

  const prisma = new PrismaClient();
  try {
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!admin) {
      console.error(`Admin user not found: ${ADMIN_EMAIL}`);
      return;
    }

    const onProgress: ImportProgressCallback = (p) => {
      const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
      process.stdout.write(`\r  [${p.phase.toUpperCase()}] ${pct}% — ${p.message}          `);
      if (p.phase === 'complete') console.log('');
    };

    const result = await importFromJSON(
      allRows,
      admin.id,
      {
        defaultApprovalStatus: 'APPROVED',
        skipDuplicates: true,
        batchSize: 50,
        deduplication: 'any_identifier',
      },
      onProgress,
    );

    console.log('\n--- Import Summary ---');
    console.log(`  Total rows:           ${result.total}`);
    console.log(`  Created:              ${result.created}`);
    console.log(`  Skipped (duplicates): ${result.skipped}`);
    console.log(`  Updated:              ${result.updated}`);
    console.log(`  Errors:               ${result.errors.length}`);
    console.log(`  Series created:       ${result.seriesCreated.length}`);
    console.log(`  Categories created:   ${result.categoriesCreated.length}`);
    console.log(`  Tags created:         ${result.tagsCreated.length}`);
    console.log(`  Characters created:   ${result.charactersCreated.length}`);
    console.log(`  Duration:             ${(result.durationMs / 1000).toFixed(1)}s`);

    if (result.seriesCreated.length > 0) {
      console.log(`\n  New series: ${result.seriesCreated.join(', ')}`);
    }

    if (result.errors.length > 0) {
      console.log('\n--- Errors (first 20) ---');
      for (const err of result.errors.slice(0, 20)) {
        console.log(`  Row ${err.row}: ${err.message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

function printSummary(rows: ImportRow[]): void {
  const byPublisher: Record<string, number> = {};
  const bySeries: Record<string, number> = {};

  for (const row of rows) {
    byPublisher[row.publisher] = (byPublisher[row.publisher] || 0) + 1;
    if (row.series) bySeries[row.series] = (bySeries[row.series] || 0) + 1;
  }

  console.log('\n--- By Publisher ---');
  for (const [pub, count] of Object.entries(byPublisher).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pub}: ${count}`);
  }

  console.log('\n--- By Series (top 20) ---');
  const sortedSeries = Object.entries(bySeries).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [series, count] of sortedSeries) {
    console.log(`  ${series}: ${count}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (args.includes('--help')) {
    console.log(`
Grand Comics Database (comics.org) Importer

Usage: npx tsx scripts/import-gcd.ts [options]

Options:
  --test                Run small test (20 issues × 3 series)
  --dry-run             Fetch and save JSON but don't import
  --series "Name"       Specific series name (repeatable)
  --publisher marvel    Filter: marvel | dc | image | all (default: all)
  --limit N             Max issues per series (default: all)
  --delay N             API call delay in ms (default: 2500)
  --resume              Resume from saved state
  --list-only           List discovered series without fetching issues

Examples:
  npx tsx scripts/import-gcd.ts --test --dry-run
  npx tsx scripts/import-gcd.ts --publisher marvel --limit 50
  npx tsx scripts/import-gcd.ts --series "Batman" --series "Superman" --publisher dc
  npx tsx scripts/import-gcd.ts --resume
`);
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log('  Grand Comics Database (comics.org) Importer');
  console.log('  Data licensed under CC BY 3.0');
  console.log('='.repeat(60));
  console.log(`  Mode: ${IS_TEST ? 'TEST' : 'FULL'} | Dry run: ${DRY_RUN} | Publisher: ${PUBLISHER_FILTER}`);
  console.log(`  Delay: ${DELAY_MS}ms | Issue limit: ${ISSUE_LIMIT || 'none'}`);
  console.log(`  Requests so far: ${requestCount}`);
  console.log('');

  const state = loadState();

  // Phase 1: Discover series
  if (state.phase === 'discover') {
    await discoverSeries(state);
  }

  if (LIST_ONLY) {
    console.log('\n--- Discovered Series ---');
    for (const s of state.discoveredSeries) {
      console.log(`  [${s.publisherId}] ${s.name} (${s.yearBegan}${s.yearEnded ? '-' + s.yearEnded : '-present'}) — ${s.issueCount} issues`);
    }
    console.log(`\nTotal: ${state.discoveredSeries.reduce((sum, s) => sum + s.issueCount, 0)} issues across ${state.discoveredSeries.length} series`);
    return;
  }

  // Phase 2: Fetch issues
  if (state.phase === 'fetch_issues') {
    await fetchIssues(state);
  }

  // Phase 3: Transform & import
  if (state.phase === 'import') {
    await transformAndImport(state);
  }

  // Cleanup state file on success
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }

  console.log(`\nDone! Total API requests: ${requestCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
