#!/usr/bin/env tsx
/**
 * extract-gcd-data.ts — Extract Marvel/DC/Image issues from the GCD temp database
 * and import into ComicsTrunk catalog.
 *
 * Prerequisites: import gcd-2021-05-29.sql into MySQL database `gcd_temp`
 *
 * Usage:
 *   npx tsx scripts/extract-gcd-data.ts [options]
 *
 * Options:
 *   --dry-run           Extract and save JSON but don't import
 *   --publisher marvel  Filter: marvel | dc | image | all (default: all)
 *   --limit N           Max issues per publisher (default: 5000)
 *   --offset N          Skip first N issues (default: 0)
 *   --year-min N        Minimum publish year (default: 1960)
 *   --year-max N        Maximum publish year (default: 2021)
 *   --min-issues N      Minimum issues in series to include (default: 6)
 *   --test              Small test: 50 issues per publisher
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import {
  importFromJSON,
  type ImportProgressCallback,
} from '../src/modules/catalog/catalog-import.service';

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const IS_TEST = args.includes('--test');
const DRY_RUN = args.includes('--dry-run');
const PUBLISHER_FILTER = (getArg('--publisher') || 'all').toLowerCase();
const LIMIT = parseInt(getArg('--limit') || (IS_TEST ? '50' : '5000'), 10);
const OFFSET = parseInt(getArg('--offset') || '0', 10);
const YEAR_MIN = parseInt(getArg('--year-min') || '1960', 10);
const YEAR_MAX = parseInt(getArg('--year-max') || '2021', 10);
const MIN_ISSUES = parseInt(getArg('--min-issues') || (IS_TEST ? '1' : '6'), 10);

const OUTPUT_DIR = path.resolve(__dirname, '..', 'data', 'gcd');
const ADMIN_EMAIL = 'admin@comicstrunk.com';

// GCD Publisher IDs
const PUBLISHER_IDS: Record<string, number> = {
  marvel: 78,
  dc: 54,
  image: 709,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GCDIssueRow {
  issue_id: number;
  issue_number: string;
  issue_title: string;
  volume: string;
  publication_date: string;
  key_date: string;
  on_sale_date: string;
  price: string;
  page_count: number | null;
  isbn: string;
  barcode: string;
  indicia_publisher: string;
  series_id: number;
  series_name: string;
  publisher_id: number;
  publisher_name: string;
  year_began: number;
  variant_of_id: number | null;
}

interface GCDStoryRow {
  issue_id: number;
  type_name: string;
  title: string;
  script: string;
  pencils: string;
  genre: string;
  characters: string;
  synopsis: string;
}

interface ImportRow {
  name: string;
  id?: string;
  isbn?: string;
  sourceKey: string;
  publisher: string;
  author?: string;
  description?: string;
  series?: string;
  volumeNumber?: string;
  categories?: string[];
  tags?: string[];
  characters?: string[];
  price?: number;
  pubDate?: string;
  pages?: number;
  coverUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(priceStr: string): number | undefined {
  if (!priceStr) return undefined;
  const match = priceStr.match(/(\d+\.?\d*)\s*USD/i);
  if (match) return parseFloat(match[1]);
  const numMatch = priceStr.match(/(\d+\.?\d*)/);
  return numMatch ? parseFloat(numMatch[1]) : undefined;
}

function parseKeyDate(keyDate: string): string | undefined {
  if (!keyDate) return undefined;
  const match = keyDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (year < 1900 || year > 2100) return undefined;
    if (month >= 1 && month <= 12) return `${month}/${year}`;
    return `${year}`;
  }
  return undefined;
}

function cleanSeriesName(name: string): string {
  return name.replace(/\s*\(\d{4}\s+series\)/i, '').trim();
}

function buildTitle(seriesName: string, issueNumber: string, issueTitle: string): string {
  const clean = cleanSeriesName(seriesName);
  if (issueNumber && issueNumber !== '[nn]' && issueNumber.trim()) {
    return `${clean} #${issueNumber}`;
  }
  if (issueTitle) return `${clean}: ${issueTitle}`;
  return clean;
}

function extractCharacters(chars: string): string[] {
  if (!chars) return [];
  const result: string[] = [];
  const parts = chars.split(';');
  for (const part of parts) {
    const name = part.replace(/\[.*?\]/g, '').trim();
    if (name && name.length > 1 && name.length < 80) {
      result.push(name);
    }
  }
  return result.slice(0, 15);
}

function extractGenres(genre: string): string[] {
  if (!genre) return [];
  return genre.split(';').map((g) => g.trim().toLowerCase()).filter((g) => g.length > 1);
}

// Note: GCD covers use a separate cover_id (not issue_id), and the cover table
// is not included in the public data dump. Cover URLs can be fetched later via
// the GCD API (/api/issue/{id}/ → cover field) at ~20 requests/hour.

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (args.includes('--help')) {
    console.log(`
GCD Data Extractor — Extract Marvel/DC/Image from GCD temp database

Usage: npx tsx scripts/extract-gcd-data.ts [options]

Options:
  --dry-run             Save JSON but don't import
  --publisher marvel    Filter: marvel | dc | image | all
  --limit N             Max issues per publisher (default: 5000)
  --offset N            Skip first N issues
  --year-min N          Min publish year (default: 1960)
  --year-max N          Max publish year (default: 2021)
  --min-issues N        Min issues in series (default: 6)
  --test                Small test: 50 issues per publisher
`);
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log('  GCD Data Extractor — Marvel / DC / Image');
  console.log('='.repeat(60));
  console.log(`  Publisher: ${PUBLISHER_FILTER} | Limit: ${LIMIT} | Offset: ${OFFSET}`);
  console.log(`  Years: ${YEAR_MIN}–${YEAR_MAX} | Min issues: ${MIN_ISSUES}`);
  console.log(`  Mode: ${IS_TEST ? 'TEST' : 'FULL'} | Dry run: ${DRY_RUN}`);
  console.log('');

  // Connect to GCD temp database
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'admin',
    database: 'gcd_temp',
    charset: 'utf8mb4',
  });

  console.log('Connected to gcd_temp database.');

  // Check if tables exist
  const [tables] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'gcd_temp' AND TABLE_NAME IN ('gcd_publisher', 'gcd_series', 'gcd_issue', 'gcd_story', 'gcd_story_type')`,
  );
  console.log(`Found ${tables.length} required tables.`);
  if (tables.length < 3) {
    console.error('Missing required tables. Import the GCD dump first.');
    await conn.end();
    process.exit(1);
  }
  const hasStories = tables.some((t: mysql.RowDataPacket) => t.TABLE_NAME === 'gcd_story');

  // Check counts
  const [pubCount] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as c FROM gcd_publisher');
  const [seriesCount] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as c FROM gcd_series');
  const [issueCount] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as c FROM gcd_issue');
  console.log(`  Publishers: ${pubCount[0].c} | Series: ${seriesCount[0].c} | Issues: ${issueCount[0].c}`);

  // Determine publisher IDs to query
  const pubIds: number[] = [];
  if (PUBLISHER_FILTER === 'all') {
    pubIds.push(...Object.values(PUBLISHER_IDS));
  } else if (PUBLISHER_IDS[PUBLISHER_FILTER]) {
    pubIds.push(PUBLISHER_IDS[PUBLISHER_FILTER]);
  } else {
    console.error(`Unknown publisher: ${PUBLISHER_FILTER}`);
    await conn.end();
    process.exit(1);
  }

  // Verify publishers exist
  for (const pubId of pubIds) {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id, name FROM gcd_publisher WHERE id = ?', [pubId],
    );
    if (rows.length > 0) {
      console.log(`  Publisher #${pubId}: ${rows[0].name}`);
    } else {
      console.warn(`  Publisher #${pubId}: NOT FOUND`);
    }
  }

  // ── Extract issues ─────────────────────────────────────────────────────────

  console.log('\nExtracting issues...');

  const allRows: ImportRow[] = [];

  for (const pubId of pubIds) {
    const pubName = Object.entries(PUBLISHER_IDS).find(([, id]) => id === pubId)?.[0] || 'unknown';
    console.log(`\n--- ${pubName.toUpperCase()} (publisher #${pubId}) ---`);

    // Get series for this publisher in the US, English, with enough issues
    // Join with country table to filter US series
    const seriesQuery = `
      SELECT s.id, s.name, s.year_began, s.year_ended, s.issue_count,
             s.publishing_format, p.name as publisher_name
      FROM gcd_series s
      JOIN gcd_publisher p ON s.publisher_id = p.id
      JOIN stddata_country c ON s.country_id = c.id
      JOIN stddata_language l ON s.language_id = l.id
      WHERE s.publisher_id = ?
        AND c.code = 'us'
        AND l.code = 'en'
        AND s.issue_count >= ?
        AND s.year_began >= ?
        AND s.year_began <= ?
        AND s.deleted = 0
        AND s.is_comics_publication = 1
      ORDER BY s.issue_count DESC
    `;

    const [seriesRows] = await conn.query<mysql.RowDataPacket[]>(
      seriesQuery, [pubId, MIN_ISSUES, YEAR_MIN, YEAR_MAX],
    );

    console.log(`  Found ${seriesRows.length} qualifying series`);

    // Get issues for these series
    // We'll batch by series to avoid giant queries
    let pubIssueCount = 0;

    for (const series of seriesRows) {
      if (pubIssueCount >= LIMIT) break;

      const remaining = LIMIT - pubIssueCount;

      const issueQuery = `
        SELECT i.id as issue_id, i.number as issue_number, i.title as issue_title,
               i.volume, i.publication_date, i.key_date, i.on_sale_date,
               i.price, i.page_count, i.isbn, i.barcode,
               i.variant_of_id,
               s.name as series_name, s.year_began,
               p.name as publisher_name, p.id as publisher_id
        FROM gcd_issue i
        JOIN gcd_series s ON i.series_id = s.id
        JOIN gcd_publisher p ON s.publisher_id = p.id
        WHERE i.series_id = ?
          AND i.deleted = 0
          AND i.variant_of_id IS NULL
        ORDER BY i.sort_code ASC
        LIMIT ?
      `;

      const [issueRows] = await conn.query<mysql.RowDataPacket[]>(
        issueQuery, [series.id, remaining],
      );

      if (issueRows.length === 0) continue;

      // Get stories for characters and credits (if gcd_story table exists)
      const issueIds = issueRows.map((r: mysql.RowDataPacket) => r.issue_id);
      let storiesByIssue: Record<number, GCDStoryRow[]> = {};

      if (hasStories && issueIds.length > 0) {
        try {
          const storyQuery = `
            SELECT s.issue_id, st.name as type_name, s.title, s.script, s.pencils,
                   s.genre, s.characters, s.synopsis
            FROM gcd_story s
            JOIN gcd_story_type st ON s.type_id = st.id
            WHERE s.issue_id IN (${issueIds.map(() => '?').join(',')})
              AND s.deleted = 0
              AND st.name IN ('comic story', 'cover')
            ORDER BY s.issue_id, s.sequence_number
          `;
          const [storyRows] = await conn.query<mysql.RowDataPacket[]>(storyQuery, issueIds);
          for (const story of storyRows) {
            if (!storiesByIssue[story.issue_id]) storiesByIssue[story.issue_id] = [];
            storiesByIssue[story.issue_id].push(story as GCDStoryRow);
          }
        } catch {
          // gcd_story not available, continue without
        }
      }

      // Transform issues
      for (const issue of issueRows as GCDIssueRow[]) {
        const title = buildTitle(issue.series_name || series.name, issue.issue_number, issue.issue_title);
        if (!title || title.length < 2) continue;

        const stories = storiesByIssue[issue.issue_id] || [];
        const price = parsePrice(issue.price);
        const pubDate = parseKeyDate(issue.key_date);
        const characters = extractCharacters(
          stories.find((s) => s.type_name === 'comic story')?.characters || '',
        );
        const genres = extractGenres(
          stories.find((s) => s.type_name === 'comic story')?.genre || '',
        );
        const author = stories.find((s) => s.type_name === 'comic story' && s.script)?.script
          ?.replace(/\s*\(.*?\)/g, '').split(';')[0].trim() || undefined;

        // Categories based on publisher
        const categories: string[] = [];
        if (pubId === PUBLISHER_IDS.marvel) categories.push('Marvel', 'Super-herois');
        else if (pubId === PUBLISHER_IDS.dc) categories.push('DC Comics', 'Super-herois');
        else if (pubId === PUBLISHER_IDS.image) categories.push('Image Comics');

        for (const genre of genres) {
          if (genre.includes('superhero') && !categories.includes('Super-herois')) categories.push('Super-herois');
          else if (genre.includes('horror')) { if (!categories.includes('Horror')) categories.push('Horror'); }
          else if (genre.includes('science fiction')) { if (!categories.includes('Ficção Científica')) categories.push('Ficção Científica'); }
          else if (genre.includes('fantasy')) { if (!categories.includes('Fantasia')) categories.push('Fantasia'); }
          else if (genre.includes('crime')) { if (!categories.includes('Crime')) categories.push('Crime'); }
        }

        // Use the main publisher name (Marvel, DC, Image), not the indicia publisher
        // which can be obscure (e.g., "Non-Pareil Publishing Corp." for early Marvel)
        const publisherName = pubId === PUBLISHER_IDS.marvel ? 'Marvel Comics'
          : pubId === PUBLISHER_IDS.dc ? 'DC Comics'
          : pubId === PUBLISHER_IDS.image ? 'Image Comics'
          : (issue.publisher_name || series.publisher_name);

        const row: ImportRow = {
          name: title,
          sourceKey: `gcd:${issue.issue_id}`,
          publisher: publisherName,
          series: cleanSeriesName(issue.series_name || series.name),
          categories,
        };

        if (issue.barcode) row.id = issue.barcode;
        if (issue.isbn) row.isbn = issue.isbn;
        if (price && price > 0) row.price = price;
        if (pubDate) row.pubDate = pubDate;
        if (issue.page_count && issue.page_count > 0) row.pages = Math.round(issue.page_count);
        if (author) row.author = author;
        if (issue.volume) row.volumeNumber = issue.volume;
        if (characters.length > 0) row.characters = characters;
        if (genres.length > 0) row.tags = genres;

        allRows.push(row);
        pubIssueCount++;
      }

      if (issueRows.length > 0) {
        process.stdout.write(`\r  ${series.name} (${series.year_began}): ${issueRows.length} issues — total ${pubName}: ${pubIssueCount}     `);
      }
    }

    console.log(`\n  Total ${pubName}: ${pubIssueCount} issues extracted`);
  }

  await conn.end();
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total extracted: ${allRows.length} issues`);

  // Print summary
  const byPublisher: Record<string, number> = {};
  const bySeries: Record<string, number> = {};
  for (const row of allRows) {
    byPublisher[row.publisher] = (byPublisher[row.publisher] || 0) + 1;
    if (row.series) bySeries[row.series] = (bySeries[row.series] || 0) + 1;
  }

  console.log('\n--- By Publisher ---');
  for (const [pub, count] of Object.entries(byPublisher).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pub}: ${count.toLocaleString()}`);
  }

  console.log('\n--- Top 20 Series ---');
  const topSeries = Object.entries(bySeries).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [series, count] of topSeries) {
    console.log(`  ${series}: ${count}`);
  }

  // Save JSON output
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = path.join(OUTPUT_DIR, `gcd-extract-${timestamp}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(allRows, null, 2));
  console.log(`\nSaved to ${outputFile}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping database import.');
    return;
  }

  // Import to ComicsTrunk
  console.log('\n=== Importing to ComicsTrunk ===\n');

  const prisma = new PrismaClient();
  try {
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!admin) {
      console.error(`Admin user not found: ${ADMIN_EMAIL}`);
      return;
    }

    // Import in batches of 200
    const BATCH_SIZE = 200;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allRows.length / BATCH_SIZE);

      process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} — created: ${totalCreated}, skipped: ${totalSkipped}     `);

      try {
        const result = await importFromJSON(
          batch,
          admin.id,
          {
            defaultApprovalStatus: 'APPROVED',
            skipDuplicates: true,
            batchSize: 50,
            deduplication: 'any_identifier',
          },
        );

        totalCreated += result.created;
        totalSkipped += result.skipped;
        totalErrors += result.errors.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  Batch ${batchNum} error: ${msg}`);
        totalErrors += batch.length;
      }
    }

    console.log(`\n\n--- Import Summary ---`);
    console.log(`  Created:  ${totalCreated.toLocaleString()}`);
    console.log(`  Skipped:  ${totalSkipped.toLocaleString()}`);
    console.log(`  Errors:   ${totalErrors.toLocaleString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
