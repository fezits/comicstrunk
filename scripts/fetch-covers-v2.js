#!/usr/bin/env node
/**
 * Cover fetch v2 — multi-source: Amazon.com, Amazon BR, Open Library, Google Books
 * Reads docs/missing-covers-v2.tsv, downloads covers, uploads to R2, updates DB
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PNPM = path.join(__dirname, '..', 'node_modules', '.pnpm');
const pw = require(path.join(PNPM, 'playwright-core@1.58.2', 'node_modules', 'playwright-core'));
const sharp = require(path.join(PNPM, 'sharp@0.34.5', 'node_modules', 'sharp'));
const { S3Client, PutObjectCommand } = require(path.join(PNPM, '@aws-sdk+client-s3@3.1033.0', 'node_modules', '@aws-sdk', 'client-s3'));

const R2 = {
  accessKeyId: 'f8e4169e477c0b70940eb2198ba6e156',
  secretAccessKey: '623fe4eb704356d4f9f4756502bb3a14e2197b11d8173c3fd5afcf9297092422',
  endpoint: 'https://941ce9d10317d15235e55932d1e9d5f2.r2.cloudflarestorage.com',
  bucket: 'comicstrunk',
  publicUrl: 'https://covers.comicstrunk.com',
};
const r2 = new S3Client({ region: 'auto', endpoint: R2.endpoint, credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey } });

const args = process.argv.slice(2);
const startIdx = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) : 0;
const limitCount = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity;

const PROGRESS = path.join(__dirname, '..', 'docs', 'cover-fetch-v2-progress.json');
function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch { return { completed: {} }; } }
function saveProgress(p) { fs.writeFileSync(PROGRESS, JSON.stringify(p, null, 2)); }

function loadEntries() {
  return fs.readFileSync(path.join(__dirname, '..', 'docs', 'missing-covers-v2.tsv'), 'utf8')
    .trim().split('\n')
    .map(line => {
      const [id, title, publisher, sourceKey] = line.split('\t');
      return { id, title, publisher, sourceKey };
    }).filter(e => e.id && e.title);
}

async function searchAmazonCom(page, title) {
  try {
    const q = title.replace(/\[.*?\]/g, '').trim() + ' comic book';
    await page.goto('https://www.amazon.com/s?k=' + encodeURIComponent(q) + '&i=stripbooks', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
      const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const c of Array.from(cards).slice(0, 5)) {
        const img = c.querySelector('img.s-image');
        if (!img) continue;
        const src = img.src || '';
        if (src.includes('placeholder') || src.includes('no-img')) continue;
        if (src.includes('media-amazon.com') || src.includes('ssl-images-amazon.com')) {
          return { image: src.replace(/\._[^.]+_\./, '._SL600_.'), source: 'amazon-com' };
        }
      }
      return null;
    });
  } catch { return null; }
}

async function searchAmazonBr(page, title) {
  try {
    const q = title.replace(/\[.*?\]/g, '').trim();
    await page.goto('https://www.amazon.com.br/s?k=' + encodeURIComponent(q) + '&i=stripbooks', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
      const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const c of Array.from(cards).slice(0, 5)) {
        const img = c.querySelector('img.s-image');
        if (!img) continue;
        const src = img.src || '';
        if (src.includes('placeholder') || src.includes('no-img')) continue;
        if (src.includes('media-amazon.com')) {
          return { image: src.replace(/\._[^.]+_\./, '._SL600_.'), source: 'amazon-br' };
        }
      }
      return null;
    });
  } catch { return null; }
}

async function searchOpenLibrary(title, publisher) {
  try {
    const params = new URLSearchParams();
    params.set('title', title.replace(/\[.*?\]/g, '').trim().substring(0, 100));
    params.set('limit', '5');
    if (publisher) params.set('publisher', publisher);
    const res = await fetch('https://openlibrary.org/search.json?' + params.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    for (const doc of (data.docs || [])) {
      if (doc.cover_i) {
        return { image: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`, source: 'openlibrary' };
      }
    }
    return null;
  } catch { return null; }
}

async function downloadAndCompress(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error('Image too small');
  return sharp(buf).resize(600, undefined, { withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

async function uploadToR2(buffer) {
  const filename = `${crypto.randomUUID()}.jpg`;
  const key = `covers/${filename}`;
  await r2.send(new PutObjectCommand({
    Bucket: R2.bucket, Key: key, Body: buffer,
    ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000',
  }));
  return { url: `${R2.publicUrl}/${key}`, filename };
}

async function updateDB(entryId, coverUrl, coverFilename) {
  const sql = `UPDATE catalog_entries SET cover_image_url='${coverUrl}', cover_file_name='${coverFilename}' WHERE id='${entryId}';`;
  try {
    execSync(
      `ssh ferna5257@server34.integrator.com.br "mysql -u ferna5257_comics -p'ComicsComics@123' ferna5257_comicstrunk_db -e \\"${sql}\\""`,
      { timeout: 10000, stdio: 'pipe' }
    );
    return true;
  } catch { return false; }
}

async function run() {
  const entries = loadEntries();
  const progress = loadProgress();
  const total = Math.min(entries.length, startIdx + limitCount) - startIdx;

  console.log(`\n=== Cover Fetch v2: ${total} entries ===\n`);

  let found = 0, notFound = 0, errors = 0, skipped = 0;
  const browser = await pw.chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  for (let i = startIdx; i < entries.length && i < startIdx + limitCount; i++) {
    const e = entries[i];
    const idx = i + 1;

    if (progress.completed[e.id]) { skipped++; continue; }

    process.stdout.write(`[${idx}/${entries.length}] ${e.publisher} | ${e.title.substring(0, 55)}... `);

    try {
      // Try in order: Open Library (free), Amazon.com, Amazon BR
      let result = await searchOpenLibrary(e.title, e.publisher);
      if (!result) result = await searchAmazonCom(page, e.title);
      if (!result) result = await searchAmazonBr(page, e.title);

      if (!result) {
        console.log('NOT FOUND');
        notFound++;
        progress.completed[e.id] = { status: 'not_found' };
        if (idx % 20 === 0) saveProgress(progress);
        continue;
      }

      const buf = await downloadAndCompress(result.image);
      const up = await uploadToR2(buf);
      const ok = await updateDB(e.id, up.url, up.filename);

      if (ok) {
        console.log(`OK (${result.source}, ${Math.round(buf.length/1024)}KB)`);
        found++;
        progress.completed[e.id] = { status: 'found', source: result.source, url: up.url };
      } else {
        console.log('UPLOAD OK, DB FAILED');
        errors++;
        progress.completed[e.id] = { status: 'db_error' };
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
      progress.completed[e.id] = { status: 'error', message: err.message };
    }

    if (idx % 10 === 0) saveProgress(progress);
    // Mild rate limit
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
  }

  await browser.close();
  saveProgress(progress);
  console.log(`\n=== Done ===\nFound: ${found} | Not found: ${notFound} | Errors: ${errors} | Skipped: ${skipped}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
