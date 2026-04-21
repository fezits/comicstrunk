// Upload local covers to Cloudflare R2
// Usage: R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=yyy node scripts/upload-covers-r2.js

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const COVERS_DIR = path.join(__dirname, '..', 'apps', 'api', 'uploads', 'covers');
const BUCKET = 'comicstrunk';
const PREFIX = 'covers/';
const CONCURRENCY = 10;

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || 'https://941ce9d10317d15235e55932d1e9d5f2.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function fileExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(filepath, key) {
  const body = fs.readFileSync(filepath);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }));
  return body.length;
}

async function run() {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.log('Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars');
    process.exit(1);
  }

  const files = fs.readdirSync(COVERS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp'));
  console.log('=== UPLOAD COVERS TO R2 ===');
  console.log('Files: ' + files.length);
  console.log('Bucket: ' + BUCKET);
  console.log('Concurrency: ' + CONCURRENCY);
  console.log('');

  let uploaded = 0, skipped = 0, failed = 0;
  let totalBytes = 0;

  // Process in batches for concurrency
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (file) => {
      const key = PREFIX + file;
      const filepath = path.join(COVERS_DIR, file);

      try {
        const size = await uploadFile(filepath, key);
        uploaded++;
        totalBytes += size;
      } catch (e) {
        failed++;
        if (failed <= 10) console.log('  FAIL: ' + file + ' - ' + e.message.slice(0, 60));
      }
    });

    await Promise.all(promises);

    if ((i + CONCURRENCY) % 500 < CONCURRENCY) {
      const pct = Math.round((i / files.length) * 100);
      const mb = Math.round(totalBytes / 1024 / 1024);
      console.log(`  Progress: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed (${pct}%) — ${mb}MB`);
    }
  }

  console.log('\n=== DONE ===');
  console.log('Uploaded: ' + uploaded);
  console.log('Skipped: ' + skipped);
  console.log('Failed: ' + failed);
  console.log('Total size: ' + Math.round(totalBytes / 1024 / 1024) + 'MB');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
