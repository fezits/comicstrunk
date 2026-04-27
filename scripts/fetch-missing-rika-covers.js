// Fetch missing Rika covers — slow and respectful
// 1 request at a time, 3s delay, 30s retry on block

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const MISSING_FILE = path.join(__dirname, '..', 'docs', 'missing-covers.txt');
const DELAY_MS = 3000;
const BLOCK_WAIT_MS = 30000;

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://941ce9d10317d15235e55932d1e9d5f2.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'f8e4169e477c0b70940eb2198ba6e156',
    secretAccessKey: '623fe4eb704356d4f9f4756502bb3a14e2197b11d8173c3fd5afcf9297092422',
  },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let sharp;
try { sharp = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp')); } catch { sharp = null; }

const HEADERS = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

async function fetchRikaCover(productId) {
  const url = `https://www.rika.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`;
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    if (text.includes('Bad Request') || text.includes('Scripts') || text.includes('blocked')) {
      return { blocked: true, url: null };
    }
    const data = JSON.parse(text);
    const imgUrl = data[0]?.items?.[0]?.images?.[0]?.imageUrl?.split('?')[0];
    if (!imgUrl || imgUrl.includes('indisponivel')) return { blocked: false, url: null };
    return { blocked: false, url: imgUrl };
  } catch {
    return { blocked: false, url: null };
  }
}

async function downloadAndCompress(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return null;
    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length < 1000 || buffer.length === 42169) return null;
    if (sharp) {
      return await sharp(buffer).resize(600, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    }
    return buffer;
  } catch {
    return null;
  }
}

async function run() {
  const filenames = fs.readFileSync(MISSING_FILE, 'utf8').trim().split('\n').filter(Boolean).map(f => f.trim().replace(/\r/g, ''));

  // Resume support
  const progressFile = path.join(__dirname, '..', 'docs', 'missing-covers-progress.json');
  let done = new Set();
  if (fs.existsSync(progressFile)) {
    done = new Set(JSON.parse(fs.readFileSync(progressFile, 'utf8')));
    console.log('Resuming from ' + done.size + ' already processed');
  }

  const remaining = filenames.filter(f => !done.has(f));
  console.log('=== FETCH MISSING RIKA COVERS (SLOW MODE) ===');
  console.log('Total missing: ' + filenames.length);
  console.log('Remaining: ' + remaining.length);
  console.log('Delay: ' + DELAY_MS + 'ms | Block wait: ' + BLOCK_WAIT_MS + 'ms');
  console.log('');

  let found = 0, downloaded = 0, notFound = 0, blocked = 0;

  for (let i = 0; i < remaining.length; i++) {
    const filename = remaining[i];
    const match = filename.match(/rika-(\d+)\.jpg/);
    if (!match) { notFound++; done.add(filename); continue; }
    const productId = match[1];

    const result = await fetchRikaCover(productId);

    if (result.blocked) {
      blocked++;
      console.log('\n  BLOCKED at ' + i + '. Waiting ' + (BLOCK_WAIT_MS / 1000) + 's...');
      await sleep(BLOCK_WAIT_MS);
      i--; // Retry
      continue;
    }

    if (!result.url) {
      notFound++;
      done.add(filename);
    } else {
      found++;
      const buffer = await downloadAndCompress(result.url);
      if (buffer) {
        try {
          await r2.send(new PutObjectCommand({
            Bucket: 'comicstrunk', Key: `covers/${filename}`,
            Body: buffer, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000',
          }));
          downloaded++;
        } catch { /* skip */ }
      }
      done.add(filename);
    }

    // Progress
    if (i % 50 === 0) {
      fs.writeFileSync(progressFile, JSON.stringify(Array.from(done)));
      process.stdout.write(`  [${i}/${remaining.length}] found:${found} dl:${downloaded} notFound:${notFound} blocked:${blocked}\r`);
    }

    await sleep(DELAY_MS);
  }

  // Save final progress
  fs.writeFileSync(progressFile, JSON.stringify(Array.from(done)));

  console.log('\n\n=== DONE ===');
  console.log('Found: ' + found);
  console.log('Downloaded: ' + downloaded);
  console.log('Not found: ' + notFound);
  console.log('Blocked: ' + blocked + ' times');
}

run().catch(e => console.error('FATAL:', e));
