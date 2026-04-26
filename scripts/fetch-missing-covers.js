#!/usr/bin/env node
/**
 * Fetch missing covers for Marvel/DC/Image entries from Amazon.com
 *
 * Usage:
 *   node scripts/fetch-missing-covers.js [--start N] [--limit N] [--dry-run]
 *
 * Reads entries from /tmp/missing-covers.tsv (exported from DB)
 * Downloads covers, compresses with sharp, uploads to R2, updates DB via SSH.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Resolve pnpm paths
const PNPM = path.join(__dirname, '..', 'node_modules', '.pnpm');
const pw = require(path.join(PNPM, 'playwright-core@1.58.2', 'node_modules', 'playwright-core'));
const sharp = require(path.join(PNPM, 'sharp@0.34.5', 'node_modules', 'sharp'));
const { S3Client, PutObjectCommand } = require(path.join(PNPM, '@aws-sdk+client-s3@3.1033.0', 'node_modules', '@aws-sdk', 'client-s3'));

// R2 config
const R2_ACCESS_KEY_ID = 'f8e4169e477c0b70940eb2198ba6e156';
const R2_SECRET_ACCESS_KEY = '623fe4eb704356d4f9f4756502bb3a14e2197b11d8173c3fd5afcf9297092422';
const R2_ENDPOINT = 'https://941ce9d10317d15235e55932d1e9d5f2.r2.cloudflarestorage.com';
const R2_BUCKET = 'comicstrunk';
const R2_PUBLIC_URL = 'https://covers.comicstrunk.com';

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// Parse args
const args = process.argv.slice(2);
const startIdx = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) : 0;
const limitCount = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity;
const dryRun = args.includes('--dry-run');

// Stats
let found = 0;
let notFound = 0;
let errors = 0;
let skipped = 0;

// Progress file to resume
const PROGRESS_FILE = path.join(__dirname, '..', 'docs', 'cover-fetch-progress.json');

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { completed: {} };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Load entries from TSV
function loadEntries() {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'docs', 'missing-covers.tsv'), 'utf8').trim().split('\n');
  return lines.map(line => {
    const [id, title, publisher, sourceKey] = line.split('\t');
    return { id, title, publisher, sourceKey };
  }).filter(e => e.id && e.title);
}

// Build search query - clean up title for Amazon search
function buildSearchQuery(title, publisher) {
  // Remove issue-specific noise
  let q = title
    .replace(/\[.*?\]/g, '') // Remove [Collector's Edition] etc.
    .replace(/#[\d,]+/g, (m) => '#' + m.replace(/,/g, '').replace('#', '')) // Clean number formatting
    .trim();

  // Add "comic" to help Amazon find the right product
  return `${q} comic book`;
}

// Search Amazon.com for cover image
async function searchAmazon(page, title, publisher) {
  const query = buildSearchQuery(title, publisher);

  try {
    const url = 'https://www.amazon.com/s?k=' + encodeURIComponent(query) + '&i=stripbooks';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Extract first result with a real image (not placeholder)
    const result = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const card of Array.from(cards).slice(0, 5)) {
        const img = card.querySelector('img.s-image');
        if (!img) continue;
        const src = img.src || '';
        // Skip placeholder images
        if (src.includes('placeholder') || src.includes('no-img')) continue;
        // Amazon images with SX/SY are real product images
        if (src.includes('images-na.ssl-images-amazon.com') || src.includes('m.media-amazon.com')) {
          // Get higher resolution version
          const hiRes = src.replace(/\._[^.]+_\./, '._SL600_.');
          return { image: hiRes };
        }
      }
      return null;
    });

    return result;
  } catch (err) {
    return null;
  }
}

// Search eBay as fallback
async function searchEbay(page, title) {
  try {
    const query = title.replace(/\[.*?\]/g, '').trim() + ' comic';
    const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query) + '&_sacat=63';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const items = document.querySelectorAll('.s-item__image-wrapper img');
      for (const img of Array.from(items).slice(0, 5)) {
        const src = img.src || '';
        if (src.includes('i.ebayimg.com') && !src.includes('00/s/')) {
          const hiRes = src.replace(/\/s-l\d+\./, '/s-l600.');
          return { image: hiRes };
        }
      }
      return null;
    });

    return result;
  } catch {
    return null;
  }
}

// Download image, compress with sharp, return buffer
async function downloadAndCompress(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());

  // Skip tiny images (likely placeholders)
  if (buffer.length < 5000) throw new Error('Image too small (placeholder?)');

  // Compress: max 600px width, JPEG quality 80
  const compressed = await sharp(buffer)
    .resize(600, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed;
}

// Upload to R2
async function uploadToR2(buffer) {
  const filename = `${crypto.randomUUID()}.jpg`;
  const key = `covers/${filename}`;

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }));

  return { url: `${R2_PUBLIC_URL}/${key}`, filename };
}

// Update DB via SSH
async function updateDB(entryId, coverUrl, coverFilename) {
  const { execSync } = require('child_process');
  const sql = `UPDATE catalog_entries SET cover_image_url='${coverUrl}', cover_file_name='${coverFilename}' WHERE id='${entryId}';`;

  try {
    execSync(
      `ssh ferna5257@server34.integrator.com.br "mysql -u ferna5257_comics -p'ComicsComics@123' ferna5257_comicstrunk_db -e \\"${sql}\\""`,
      { timeout: 10000, stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const entries = loadEntries();
  const progress = loadProgress();
  const total = Math.min(entries.length, startIdx + limitCount) - startIdx;

  console.log(`\n=== Cover Fetch: ${total} entries (${startIdx} to ${startIdx + total}) ===`);
  console.log(`Total missing: ${entries.length} | Dry run: ${dryRun}\n`);

  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  for (let i = startIdx; i < entries.length && i < startIdx + limitCount; i++) {
    const entry = entries[i];
    const idx = i + 1;

    // Skip already processed
    if (progress.completed[entry.id]) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${idx}/${entries.length}] ${entry.publisher} | ${entry.title.substring(0, 60)}... `);

    try {
      // Try Amazon first
      let result = await searchAmazon(page, entry.title, entry.publisher);
      let source = 'amazon';

      // Fallback to eBay
      if (!result) {
        result = await searchEbay(page, entry.title);
        source = 'ebay';
      }

      if (!result) {
        console.log('NOT FOUND');
        notFound++;
        progress.completed[entry.id] = { status: 'not_found' };
        if (idx % 20 === 0) saveProgress(progress);
        continue;
      }

      if (dryRun) {
        console.log(`FOUND (${source}): ${result.image.substring(0, 80)}`);
        found++;
        continue;
      }

      // Download + compress
      const buffer = await downloadAndCompress(result.image);

      // Upload to R2
      const { url, filename } = await uploadToR2(buffer);

      // Update DB
      const updated = await updateDB(entry.id, url, filename);

      if (updated) {
        console.log(`OK (${source}, ${Math.round(buffer.length / 1024)}KB)`);
        found++;
        progress.completed[entry.id] = { status: 'found', source, url };
      } else {
        console.log(`UPLOADED but DB update failed`);
        errors++;
        progress.completed[entry.id] = { status: 'db_error', url };
      }

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
      progress.completed[entry.id] = { status: 'error', message: err.message };
    }

    // Save progress every 10 entries
    if (idx % 10 === 0) saveProgress(progress);

    // Rate limit: 3-5 second random delay between requests
    const delay = 3000 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  }

  await browser.close();
  saveProgress(progress);

  console.log(`\n=== Results ===`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped (already done): ${skipped}`);
  console.log(`Progress saved to ${PROGRESS_FILE}`);
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
