/**
 * fetch-missing-covers.ts — Fetch cover images for catalog entries that don't have one.
 *
 * Strategy:
 *   1. Query DB for entries with sourceKey but no cover
 *   2. Try Panini GraphQL first (fast, but often returns placeholder)
 *   3. If placeholder, scrape the product page HTML for CloudFront CDN image
 *   4. For Rika, use VTEX API by productId
 *
 * Usage: npx tsx scripts/fetch-missing-covers.ts [options]
 *
 *   --dry-run         Show what would be fetched without downloading
 *   --panini-only     Only fetch Panini covers
 *   --rika-only       Only fetch Rika covers
 *   --limit N         Max entries to process (default: all)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const COVERS_DIR = path.resolve(__dirname, '..', 'uploads', 'comicstrunk', 'covers');
const DRY_RUN = process.argv.includes('--dry-run');
const PANINI_ONLY = process.argv.includes('--panini-only');
const RIKA_ONLY = process.argv.includes('--rika-only');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || 0;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
    const filepath = path.join(COVERS_DIR, filename);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 5000) return true;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 2000) return false; // Skip tiny/broken images
    fs.writeFileSync(filepath, buffer);
    return true;
  } catch {
    return false;
  }
}

/** Convert title to Panini URL slug: lowercase, accents removed, spaces/punctuation to hyphens */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[''`]/g, '')            // remove apostrophes (Jojo's -> Jojos)
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric to hyphen
    .replace(/^-|-$/g, '')            // trim hyphens
    .replace(/-+/g, '-');             // collapse multiple hyphens
}

// === Panini: Scrape product page for CloudFront cover image ===

async function fetchPaniniCoverFromPage(title: string): Promise<string | null> {
  const slug = titleToSlug(title);
  const url = `https://panini.com.br/${slug}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Look for CloudFront CDN image (high-res: -S897)
    const cfMatch = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/[^"'\s]*-S897[^"'\s]*/);
    if (cfMatch) return cfMatch[0];

    // Fallback: any CloudFront image (lower res)
    const cfAny = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/[^"'\s]+/);
    if (cfAny) return cfAny[0];

    // Fallback: Magento catalog product image (not placeholder)
    const magentoMatch = html.match(/https?:\/\/panini\.com\.br\/media\/catalog\/product\/[A-Z][^"'\s]*\.jpg[^"'\s]*/);
    if (magentoMatch && !magentoMatch[0].includes('placeholder')) return magentoMatch[0];

    return null;
  } catch {
    return null;
  }
}

// === Panini: Try GraphQL first, fallback to page scrape ===

async function fetchPaniniCover(sku: string, title: string): Promise<string | null> {
  // 1. Try GraphQL (fast)
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
      const imageUrl = json.data?.products?.items?.[0]?.small_image?.url;
      if (imageUrl && !imageUrl.includes('placeholder')) return imageUrl;
    }
  } catch { /* fall through to page scrape */ }

  // 2. Fallback: scrape product page for CloudFront image
  return fetchPaniniCoverFromPage(title);
}

// === Rika: Fetch cover via VTEX API by productId ===

async function fetchRikaCover(productId: string): Promise<string | null> {
  try {
    const url = `https://www.rika.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const products = await res.json();
    if (!Array.isArray(products) || products.length === 0) return null;
    return products[0]?.items?.[0]?.images?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

// === Main ===

async function main() {
  console.log('=== Fetch Missing Covers (v2 - CloudFront scraper) ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Covers dir: ${COVERS_DIR}`);
  console.log('');

  const where = {
    AND: [
      { coverFileName: null },
      { coverImageUrl: null },
      { sourceKey: { not: null } },
      ...(PANINI_ONLY ? [{ sourceKey: { startsWith: 'panini:' } }] : []),
      ...(RIKA_ONLY ? [{ sourceKey: { startsWith: 'rika:' } }] : []),
    ],
  };

  const entries = await prisma.catalogEntry.findMany({
    where: where as any,
    select: { id: true, title: true, sourceKey: true },
    orderBy: { title: 'asc' },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  const paniniEntries = entries.filter(e => e.sourceKey?.startsWith('panini:'));
  const rikaEntries = entries.filter(e => e.sourceKey?.startsWith('rika:'));

  console.log(`Found ${entries.length} entries without covers`);
  console.log(`  Panini: ${paniniEntries.length}`);
  console.log(`  Rika: ${rikaEntries.length}`);
  console.log('');

  let downloaded = 0;
  let graphqlHit = 0;
  let pageHit = 0;
  let alreadyLocal = 0;
  let notFound = 0;
  let errors = 0;

  // === Process Panini ===
  if (paniniEntries.length > 0 && !RIKA_ONLY) {
    console.log('--- Panini Covers ---');

    for (let i = 0; i < paniniEntries.length; i++) {
      const entry = paniniEntries[i];
      const sku = entry.sourceKey!.replace('panini:', '');
      const coverFile = `panini-${sku}.jpg`;

      if (i > 0 && i % 50 === 0) {
        console.log(`  Progress: ${i}/${paniniEntries.length} | Downloaded: ${downloaded} | Not found: ${notFound}`);
      }

      if (DRY_RUN) {
        const slug = titleToSlug(entry.title);
        console.log(`  [DRY] ${sku} "${entry.title.substring(0, 50)}" -> panini.com.br/${slug}`);
        continue;
      }

      // Check if file already exists locally
      const localPath = path.join(COVERS_DIR, coverFile);
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        alreadyLocal++;
        continue;
      }

      // Fetch cover: GraphQL first, then page scrape
      const imageUrl = await fetchPaniniCover(sku, entry.title);

      if (!imageUrl) {
        notFound++;
        continue;
      }

      const isCloudFront = imageUrl.includes('cloudfront.net');

      // Download (WebP from CloudFront is fine, we save as .jpg but it works)
      const ok = await downloadImage(imageUrl, coverFile);
      if (ok) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        downloaded++;
        if (isCloudFront) pageHit++;
        else graphqlHit++;
      } else {
        errors++;
      }

      // Rate limit: 500ms between requests to be nice
      await sleep(500);
    }
  }

  // === Process Rika ===
  if (rikaEntries.length > 0 && !PANINI_ONLY) {
    console.log('--- Rika Covers ---');

    for (const entry of rikaEntries) {
      const productId = entry.sourceKey!.replace('rika:', '');
      const coverFile = `rika-${productId}.jpg`;

      if (DRY_RUN) {
        console.log(`  [DRY] Would fetch: ${coverFile} for "${entry.title.substring(0, 50)}"`);
        continue;
      }

      const localPath = path.join(COVERS_DIR, coverFile);
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        alreadyLocal++;
        continue;
      }

      const imageUrl = await fetchRikaCover(productId);
      if (!imageUrl) { notFound++; continue; }

      const ok = await downloadImage(imageUrl, coverFile);
      if (ok) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        downloaded++;
      } else {
        errors++;
      }
      await sleep(300);
    }
  }

  // === Summary ===
  console.log('\n=== Summary ===');
  console.log(`Total processed:  ${entries.length}`);
  console.log(`Downloaded:       ${downloaded}`);
  console.log(`  via GraphQL:    ${graphqlHit}`);
  console.log(`  via page scrape:${pageHit}`);
  console.log(`Already local:    ${alreadyLocal}`);
  console.log(`Not found:        ${notFound}`);
  console.log(`Errors:           ${errors}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
