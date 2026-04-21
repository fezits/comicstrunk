// Fetch missing Newpop covers from Rika API
// Runs on the production server to avoid rate limits

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const COVERS_DIR = '/home/ferna5257/applications/api.comicstrunk.com/uploads/comicstrunk/covers';
const DELAY_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  // Get all Newpop entries without covers
  const entries = await prisma.catalogEntry.findMany({
    where: {
      publisher: 'Newpop',
      approvalStatus: 'APPROVED',
      coverImageUrl: null,
      sourceKey: { startsWith: 'rika:' },
    },
    select: { id: true, title: true, sourceKey: true },
  });

  console.log('Newpop entries without covers: ' + entries.length);
  let fetched = 0;
  let failed = 0;

  for (const entry of entries) {
    const rikaId = entry.sourceKey.replace('rika:', '');

    try {
      const resp = await fetch(
        'https://www.rika.com.br/api/catalog_system/pub/products/search?fq=productId:' + rikaId,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );

      const text = await resp.text();
      if (text.includes('Bad Request') || text.includes('Scripts are not allowed')) {
        console.log('  BLOCKED by Rika. Stopping.');
        break;
      }

      const data = JSON.parse(text);
      if (!Array.isArray(data) || data.length === 0) {
        console.log('  NOT FOUND: ' + entry.title);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const product = data[0];
      const imgUrl = product.items?.[0]?.images?.[0]?.imageUrl?.split('?')[0];

      if (!imgUrl || imgUrl.includes('indisponivel')) {
        console.log('  NO IMAGE: ' + entry.title);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      // Download and compress image
      const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) });
      if (!imgResp.ok) {
        console.log('  DOWNLOAD FAILED: ' + entry.title);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const buffer = Buffer.from(await imgResp.arrayBuffer());

      // Check if it's the placeholder (42169 bytes, hash 37eadb1f86601aa2aff6e288a03a8fd9)
      if (buffer.length === 42169) {
        console.log('  PLACEHOLDER: ' + entry.title);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      // Save cover file
      const coverFile = 'rika-' + rikaId + '.jpg';
      const filepath = path.join(COVERS_DIR, coverFile);

      // Compress with sharp if available, else save raw
      try {
        const sharp = require('sharp');
        await sharp(buffer)
          .resize(600, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);
      } catch {
        // sharp not available, save raw
        fs.writeFileSync(filepath, buffer);
      }

      // Update DB
      await prisma.catalogEntry.update({
        where: { id: entry.id },
        data: { coverFileName: coverFile },
      });

      fetched++;
      console.log('  OK: ' + entry.title + ' (' + Math.round(buffer.length / 1024) + 'KB -> ' + coverFile + ')');
    } catch (err) {
      console.log('  ERROR: ' + entry.title + ' - ' + err.message);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log('\nDone. Fetched: ' + fetched + ', Failed: ' + failed);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
