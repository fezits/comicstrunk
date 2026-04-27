// Download and compress Open Library covers for a specific publisher
// Replaces external coverImageUrl with local coverFileName
// Usage: node compact-openlibrary-covers.js [publisher]
// Example: node compact-openlibrary-covers.js "DC Comics"

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const COVERS_DIR = path.join(__dirname, '..', 'uploads', 'covers');
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

async function downloadAndCompress(url, filename) {
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 1000) return null; // Too small, probably placeholder

    const outputPath = path.join(COVERS_DIR, filename);

    // Try sharp compression
    try {
      const sharp = require('sharp');
      await sharp(buffer)
        .resize(600, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      return fs.statSync(outputPath).size;
    } catch {
      // Fallback: save as-is
      fs.writeFileSync(outputPath, buffer);
      return buffer.length;
    }
  } catch (e) {
    return null;
  }
}

async function run() {
  const publisher = process.argv[2] || 'DC Comics';
  console.log('=== COMPACT COVERS: ' + publisher + ' ===\n');

  // Find entries with Open Library URLs
  const entries = await prisma.catalogEntry.findMany({
    where: {
      publisher: publisher,
      coverImageUrl: { contains: 'openlibrary' },
    },
    select: { id: true, title: true, slug: true, coverImageUrl: true },
    orderBy: { title: 'asc' },
  });

  console.log('Entries with Open Library covers: ' + entries.length);
  let downloaded = 0, failed = 0, skipped = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const filename = (entry.slug || slugify(entry.title)) + '.jpg';

    // Skip if already downloaded
    const outputPath = path.join(COVERS_DIR, filename);
    if (fs.existsSync(outputPath)) {
      // Update DB to use local file
      await prisma.catalogEntry.update({
        where: { id: entry.id },
        data: { coverFileName: filename, coverImageUrl: null },
      });
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.title.slice(0, 50)}... `);

    const size = await downloadAndCompress(entry.coverImageUrl, filename);
    if (size) {
      // Update DB: set coverFileName, clear coverImageUrl
      await prisma.catalogEntry.update({
        where: { id: entry.id },
        data: { coverFileName: filename, coverImageUrl: null },
      });
      downloaded++;
      console.log('OK (' + Math.round(size / 1024) + 'KB)');
    } else {
      failed++;
      console.log('FAILED');
    }

    await sleep(500); // Rate limit Open Library
  }

  console.log('\n=== RESULTS ===');
  console.log('Downloaded: ' + downloaded);
  console.log('Skipped (already local): ' + skipped);
  console.log('Failed: ' + failed);
  console.log('Total processed: ' + entries.length);

  // Show disk usage
  const files = fs.readdirSync(COVERS_DIR);
  let totalSize = 0;
  files.forEach(f => totalSize += fs.statSync(path.join(COVERS_DIR, f)).size);
  console.log('\nCovers directory: ' + files.length + ' files, ' + Math.round(totalSize / 1024 / 1024) + 'MB');

  await prisma.$disconnect();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
