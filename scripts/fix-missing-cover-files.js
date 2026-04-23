// Fix entries that have coverImageUrl pointing to non-existent files
// Downloads from Panini page scrape and saves with correct filename
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const COVERS_DIR = path.resolve(__dirname, '..', 'uploads', 'comicstrunk', 'covers');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || 0;
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function titleToSlug(title) {
  return title.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\ufffd/g, '')
    .replace(/['`]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').replace(/-+/g, '-');
}

async function downloadAndResize(url, filepath) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return false;
    fs.writeFileSync(filepath, buf);
    return true;
  } catch { return false; }
}

async function fetchCoverUrl(sku, title) {
  // Try GraphQL first
  try {
    const query = `{ products(filter: { sku: { eq: "${sku}" } }, pageSize: 1) { items { small_image { url } } } }`;
    const res = await fetch('https://panini.com.br/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Store: 'default' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const json = await res.json();
      const url = json.data?.products?.items?.[0]?.small_image?.url;
      if (url && !url.includes('placeholder')) return url;
    }
  } catch {}

  // Fallback: page scrape
  const slug = titleToSlug(title);
  try {
    const res = await fetch(`https://panini.com.br/${slug}`, {
      signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA }, redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/\S+-S897\S*/);
    if (match) return match[0];
    const any = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/\S+/);
    return any ? any[0] : null;
  } catch { return null; }
}

async function main() {
  console.log('=== Fix Missing Cover Files ===');
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');

  // Find entries with coverImageUrl but missing coverFileName or file doesn't exist
  const entries = await prisma.catalogEntry.findMany({
    where: {
      AND: [
        { coverImageUrl: { not: null } },
        { coverFileName: null },
        { sourceKey: { startsWith: 'panini:' } },
      ],
    },
    select: { id: true, title: true, sourceKey: true, coverImageUrl: true },
    orderBy: { title: 'asc' },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log('Found:', entries.length, 'entries with URL but no file');
  let downloaded = 0, notFound = 0, alreadyLocal = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const sku = e.sourceKey.replace('panini:', '');
    const coverFile = `panini-${sku}.jpg`;
    const filepath = path.join(COVERS_DIR, coverFile);

    if (i > 0 && i % 50 === 0) {
      console.log(`  Progress: ${i}/${entries.length} | Downloaded: ${downloaded} | Not found: ${notFound}`);
    }

    // Check if file already exists locally
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 2000) {
      await prisma.catalogEntry.update({ where: { id: e.id }, data: { coverFileName: coverFile } });
      alreadyLocal++;
      continue;
    }

    if (DRY_RUN) { console.log(`  [DRY] ${sku} "${e.title.substring(0, 50)}"`); continue; }

    const imageUrl = await fetchCoverUrl(sku, e.title);
    if (!imageUrl) { notFound++; continue; }

    const ok = await downloadAndResize(imageUrl, filepath);
    if (ok) {
      await prisma.catalogEntry.update({ where: { id: e.id }, data: { coverFileName: coverFile } });
      downloaded++;
    } else { notFound++; }

    await sleep(500);
  }

  console.log('\n=== Summary ===');
  console.log('Downloaded:', downloaded);
  console.log('Already local:', alreadyLocal);
  console.log('Not found:', notFound);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
