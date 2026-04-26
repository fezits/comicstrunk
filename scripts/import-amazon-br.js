#!/usr/bin/env node
/**
 * Import Amazon BR HQs into the catalog
 * - Downloads cover image
 * - Compresses with sharp (max 600px, JPEG 80)
 * - Uploads to R2
 * - Inserts catalog_entry with source_key='amazon:ASIN'
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PNPM = path.join(__dirname, '..', 'node_modules', '.pnpm');
const sharp = require(path.join(PNPM, 'sharp@0.34.5', 'node_modules', 'sharp'));
const { S3Client, PutObjectCommand } = require(path.join(PNPM, '@aws-sdk+client-s3@3.1033.0', 'node_modules', '@aws-sdk', 'client-s3'));

const R2_ACCESS_KEY_ID = 'f8e4169e477c0b70940eb2198ba6e156';
const R2_SECRET_ACCESS_KEY = '623fe4eb704356d4f9f4756502bb3a14e2197b11d8173c3fd5afcf9297092422';
const R2_ENDPOINT = 'https://941ce9d10317d15235e55932d1e9d5f2.r2.cloudflarestorage.com';
const R2_BUCKET = 'comicstrunk';
const R2_PUBLIC_URL = 'https://covers.comicstrunk.com';
const ADMIN_USER_ID = 'cmmwujcy90000chw9c2vkwf7n';

const r2 = new S3Client({
  region: 'auto', endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const PROGRESS_FILE = path.join(__dirname, '..', 'docs', 'amazon-import-progress.json');
function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { completed: {} }; } }
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

function genCuid() {
  // simple cuid-like ID
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(8).toString('hex');
  return 'cmaz' + ts + rand;
}

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 220);
}

async function downloadAndCompress(url) {
  // Get higher resolution version
  const hiRes = url.replace(/\._[^.]+_\./, '._SL600_.');
  const res = await fetch(hiRes, {
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
    Bucket: R2_BUCKET, Key: key, Body: buffer,
    ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000',
  }));
  return { url: `${R2_PUBLIC_URL}/${key}`, filename };
}

function escapeSql(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

function buildInsertSQL(entries) {
  const values = entries.map(e =>
    `(${escapeSql(e.id)}, ${escapeSql(e.title)}, ${escapeSql(e.slug)}, ${escapeSql(e.publisher)}, ${escapeSql(e.author)}, ${escapeSql(e.sourceKey)}, ${escapeSql(e.coverImageUrl)}, ${escapeSql(e.coverFileName)}, ${escapeSql(ADMIN_USER_ID)}, 'APPROVED', NOW(), NOW())`
  ).join(',\n');
  return `INSERT INTO catalog_entries (id, title, slug, publisher, author, source_key, cover_image_url, cover_file_name, created_by_id, approval_status, created_at, updated_at) VALUES\n${values};`;
}

async function flushBatch(batch) {
  if (batch.length === 0) return 0;
  const sql = buildInsertSQL(batch);
  const tmpFile = path.join(__dirname, '..', 'docs', '.batch-insert.sql');
  fs.writeFileSync(tmpFile, sql);
  // Upload via SCP and execute
  execSync(`scp ${tmpFile} ferna5257@server34.integrator.com.br:/tmp/.batch.sql`, { stdio: 'pipe' });
  execSync(`ssh ferna5257@server34.integrator.com.br "mysql -u ferna5257_comics -p'ComicsComics@123' ferna5257_comicstrunk_db < /tmp/.batch.sql"`, { stdio: 'pipe' });
  fs.unlinkSync(tmpFile);
  return batch.length;
}

async function run() {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'amazon-br-new.json'), 'utf8'));
  const progress = loadProgress();

  console.log(`\n=== Amazon BR Import: ${products.length} products ===\n`);

  let imported = 0, errors = 0, skipped = 0;
  let batch = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const idx = i + 1;

    if (progress.completed[p.asin]) { skipped++; continue; }

    // Clean publisher: try to detect from title or use 'Amazon' as fallback
    let publisher = '';
    const t = p.title.toLowerCase();
    if (t.includes('marvel')) publisher = 'Marvel Comics';
    else if (t.includes('batman') || t.includes('superman') || t.includes('dc compact') || t.includes('absolute')) publisher = 'DC Comics';
    else if (t.includes('berserk') || t.includes('blue lock') || t.includes('vagabond') || t.includes('slam dunk') || t.includes('dragon ball')) publisher = 'Manga';
    else if (t.includes('invincible') || t.includes('walking dead') || t.includes('savage dragon')) publisher = 'Image Comics';
    else publisher = '';

    process.stdout.write(`[${idx}/${products.length}] ${p.title.substring(0, 70)}... `);

    try {
      let coverImageUrl = null, coverFileName = null;
      if (p.image) {
        try {
          const buf = await downloadAndCompress(p.image);
          const up = await uploadToR2(buf);
          coverImageUrl = up.url;
          coverFileName = up.filename;
        } catch (e) {
          console.log(`(no cover: ${e.message})`);
        }
      }

      const entry = {
        id: genCuid() + i,
        title: p.title,
        slug: `${slugify(p.title)}-${p.asin.toLowerCase()}`,
        publisher: publisher || null,
        author: p.author || null,
        sourceKey: `amazon:${p.asin}`,
        coverImageUrl,
        coverFileName,
      };
      batch.push(entry);
      progress.completed[p.asin] = { status: 'queued', id: entry.id };
      imported++;
      console.log(`OK${coverImageUrl ? ' + cover' : ''}`);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
        batch = [];
        saveProgress(progress);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
      progress.completed[p.asin] = { status: 'error', message: err.message };
    }

    if (idx % 10 === 0) saveProgress(progress);
    await new Promise(r => setTimeout(r, 500));
  }

  if (batch.length > 0) await flushBatch(batch);
  saveProgress(progress);

  console.log(`\n=== Done ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped: ${skipped}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
