/**
 * fetch-missing-covers.ts — Fetch cover images for catalog entries that don't have one.
 *
 * Strategy:
 *   1. Query DB for entries with sourceKey but no cover
 *   2. Try Panini GraphQL first (fast, but often returns placeholder)
 *   3. If placeholder, scrape the product page HTML for CloudFront CDN image
 *   4. For Rika, use VTEX API by productId
 *
 * IMPORTANT — Rika placeholder protection (added 2026-04-27):
 *   Rika returns "imagem_indisponivel.jpg" (42169 ou 41189 bytes, md5
 *   37eadb1f86601aa2aff6e288a03a8fd9) when a comic has no cover. The OLD version
 *   of this script accepted them as valid covers because the size filter was
 *   `< 2000`. This script rejects them at THREE layers:
 *     1. URL-level: skip URLs containing "indisponivel"
 *     2. Size-level: reject 42169 and 41189 byte buffers
 *     3. Hash-level: reject buffers with the known placeholder md5
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
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const COVERS_DIR = path.resolve(__dirname, '..', 'uploads', 'comicstrunk', 'covers');
const DRY_RUN = process.argv.includes('--dry-run');
const PANINI_ONLY = process.argv.includes('--panini-only');
const RIKA_ONLY = process.argv.includes('--rika-only');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || 0;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Rika placeholder fingerprints. Update if Rika changes their "imagem_indisponivel" asset.
// Variants observed in production (2026-04-27): 15781 files of size 42169 (md5 37eadb...),
// and 4 files of size 41189 (md5 7ff089...) — same image, slightly different recompression.
const RIKA_PLACEHOLDER_SIZES = new Set([42169, 41189]);
const RIKA_PLACEHOLDER_HASHES = new Set([
  '37eadb1f86601aa2aff6e288a03a8fd9',
  '7ff0896bef20a722b1f0d010f71d6953',
]);

function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('indisponivel');
}

function isPlaceholderBuffer(buffer: Buffer): boolean {
  if (RIKA_PLACEHOLDER_SIZES.has(buffer.length)) return true;
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  return RIKA_PLACEHOLDER_HASHES.has(hash);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
    const filepath = path.join(COVERS_DIR, filename);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 5000) return true;

    // Layer 1 — URL contains the Rika placeholder marker
    if (isPlaceholderUrl(url)) return false;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 2000) return false; // Skip tiny/broken images

    // Layers 2 + 3 — exact size or md5 of known Rika placeholder
    if (isPlaceholderBuffer(buffer)) return false;

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
    .replace(/[̀-ͯ]/g, '')  // remove accents
    .replace(/�/g, '')           // remove replacement character
    .replace(/['\x60]/g, '')          // remove apostrophes/backticks
    .replace(/[^a-z0-9]+/g, '-')      // non-alphanumeric to hyphen
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
    const cfMatch = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/\S+-S897\S*/);
    if (cfMatch) return cfMatch[0];

    // Fallback: any CloudFront image (lower res)
    const cfAny = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/\S+/);
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
    const imageUrl = products[0]?.items?.[0]?.images?.[0]?.imageUrl || null;
    // Reject Rika "imagem_indisponivel.jpg" at the URL level
    if (isPlaceholderUrl(imageUrl)) return null;
    return imageUrl;
  } catch {
    return null;
  }
}

// === Main ===

async function main() {
  console.log('=== Fetch Missing Covers (v3 - placeholder-safe) ===');
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
  let placeholderBlocked = 0;
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
        // Defensive: only link if local file is NOT a placeholder
        try {
          const buf = fs.readFileSync(localPath);
          if (isPlaceholderBuffer(buf)) {
            placeholderBlocked++;
            continue;
          }
        } catch { /* ignore read errors */ }
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        alreadyLocal++;
        continue;
      }

      const imageUrl = await fetchRikaCover(productId);
      if (!imageUrl) {
        // Either not found OR rejected as placeholder URL
        notFound++;
        continue;
      }

      const ok = await downloadImage(imageUrl, coverFile);
      if (ok) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverFileName: coverFile },
        });
        downloaded++;
      } else {
        // Could be a placeholder caught at the size/hash layer or a real error
        placeholderBlocked++;
      }
      await sleep(300);
    }
  }

  // === Summary ===
  console.log('\n=== Summary ===');
  console.log(`Total processed:       ${entries.length}`);
  console.log(`Downloaded:            ${downloaded}`);
  console.log(`  via GraphQL:         ${graphqlHit}`);
  console.log(`  via page scrape:     ${pageHit}`);
  console.log(`Already local:         ${alreadyLocal}`);
  console.log(`Not found:             ${notFound}`);
  console.log(`Placeholder blocked:   ${placeholderBlocked}`);
  console.log(`Errors:                ${errors}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
