/**
 * sync-catalog-remote.ts — Incremental sync from Rika (VTEX) + Panini (GraphQL)
 * that sends data to a remote ComicsTrunk API instead of writing to local DB.
 *
 * Usage: npx tsx scripts/sync-catalog-remote.ts [--dry-run] [--rika-only] [--panini-only] [--full]
 *
 * Environment:
 *   COMICSTRUNK_API_URL  — Remote API base (e.g., https://comicstrunk.com.br/api/v1)
 *   COMICSTRUNK_SYNC_EMAIL — Login email (default: sync@comicstrunk.com)
 *   COMICSTRUNK_SYNC_PASS  — Login password
 *
 * Falls back to local API (http://localhost:3005/api/v1) if no env vars set.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import type { Browser, Page } from 'playwright';

const API_URL = process.env.COMICSTRUNK_API_URL || 'http://localhost:3005/api/v1';
const SYNC_EMAIL = process.env.COMICSTRUNK_SYNC_EMAIL || 'sync@comicstrunk.com';
const SYNC_PASS = process.env.COMICSTRUNK_SYNC_PASS || 'SyncService2026!';

const DRY_RUN = process.argv.includes('--dry-run');
const RIKA_ONLY = process.argv.includes('--rika-only');
const PANINI_ONLY = process.argv.includes('--panini-only');
const FULL_SCAN = process.argv.includes('--full');
const STOP_AFTER_EXISTING = 100;
const BATCH_SIZE = 50; // Items per API call

interface SyncItem {
  sourceKey: string;
  title: string;
  publisher: string | null;
  coverPrice: number | null;
  categories: string[];
  imageUrl?: string | null;
}

interface SyncStats {
  source: string;
  fetched: number;
  sent: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  coversSent: number;
  coversCreated: number;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// AUTH
// ============================================================
let authToken = '';

async function login(): Promise<void> {
  console.log(`Logging in to ${API_URL}...`);
  // Try sync user first, fallback to admin
  for (const creds of [
    { email: SYNC_EMAIL, password: SYNC_PASS },
    { email: 'admin@comicstrunk.com', password: 'Admin123!' },
  ]) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const data = await res.json();
      if (data.data?.accessToken) {
        authToken = data.data.accessToken;
        console.log(`✅ Logged in as ${creds.email}`);
        return;
      }
    } catch { /* try next */ }
  }
  throw new Error('Failed to authenticate with remote API');
}

async function apiPost(endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function uploadCover(sourceKey: string, imageUrl: string): Promise<boolean> {
  try {
    // Download image
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return false;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length < 1000) return false; // too small, probably placeholder

    // Upload to API
    const formData = new FormData();
    formData.append('sourceKey', sourceKey);
    formData.append('cover', new Blob([buffer], { type: 'image/jpeg' }), `${sourceKey.replace(':', '-')}.jpg`);

    const res = await fetch(`${API_URL}/sync/covers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return data.data?.status === 'created';
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================
// SEND BATCH
// ============================================================

async function sendBatch(items: SyncItem[], stats: SyncStats): Promise<void> {
  if (items.length === 0) return;
  stats.sent += items.length;

  if (DRY_RUN) {
    stats.created += items.length; // estimate
    return;
  }

  const payload = {
    items: items.map(i => ({
      sourceKey: i.sourceKey,
      title: i.title,
      publisher: i.publisher,
      coverPrice: i.coverPrice,
      categories: i.categories,
    })),
  };

  const result = await apiPost('/sync/catalog', payload);
  if (result.success) {
    stats.created += result.data.created || 0;
    stats.updated += result.data.updated || 0;
    stats.unchanged += result.data.unchanged || 0;
    stats.errors += result.data.errors || 0;
  } else {
    console.error('  Batch error:', result.error?.message || 'Unknown');
    stats.errors += items.length;
  }

  // Upload covers for items that have images
  for (const item of items) {
    if (item.imageUrl) {
      const created = await uploadCover(item.sourceKey, item.imageUrl);
      stats.coversSent++;
      if (created) stats.coversCreated++;
      await sleep(200); // rate limit cover uploads
    }
  }
}

// ============================================================
// RIKA — VTEX Catalog API
// ============================================================

const RIKA_SUBCATEGORIES = [
  'Super-herois/Marvel', 'Super-herois/DC', 'Super-herois/Vertigo',
  'Super-herois/Image', 'Super-herois/ETC', 'Super-herois',
];

async function syncRika(stats: SyncStats) {
  console.log('\n=== Syncing Rika ===');
  const seenIds = new Set<string>();
  let batch: SyncItem[] = [];

  for (const subcat of RIKA_SUBCATEGORIES) {
    console.log(`  ${subcat}...`);
    let from = 0;
    const pageSize = 50;
    let consecutiveExisting = 0;
    let subcatFetched = 0;

    while (true) {
      const to = from + pageSize - 1;
      const url = `https://www.rika.com.br/api/catalog_system/pub/products/search/${subcat}?_from=${from}&_to=${to}&O=OrderByReleaseDateDESC`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (res.status === 416 || res.status === 404) break;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        for (const product of data) {
          const productId = product.productId;
          if (seenIds.has(productId)) continue;
          seenIds.add(productId);
          stats.fetched++;
          subcatFetched++;

          const item = product.items?.[0];
          const seller = item?.sellers?.[0]?.commertialOffer;
          const price = seller?.Price || 0;
          const image = item?.images?.[0]?.imageUrl || null;
          const categories = (product.categories || [])
            .map((c: string) => c.split('/').filter(Boolean).pop())
            .filter(Boolean);

          batch.push({
            sourceKey: `rika:${productId}`,
            title: product.productName?.trim() || 'Sem título',
            publisher: product.brand || null,
            coverPrice: price > 0 ? price : null,
            categories,
            imageUrl: image,
          });

          if (batch.length >= BATCH_SIZE) {
            await sendBatch(batch, stats);
            batch = [];
          }
        }

        // Check early stop via sync/status (we can't check locally)
        // Instead, track by batch results - if all unchanged, increment counter
        // For remote mode, we rely on the API's response to know if items existed

        const resourcesHeader = res.headers.get('resources') || '';
        const match = resourcesHeader.match(/(\d+)-(\d+)\/(\d+)/);
        if (match) {
          const total = parseInt(match[3]);
          if (from + pageSize >= total || from >= 2500) break;
        }

        from += pageSize;
        await sleep(500);
      } catch (e: any) {
        console.error(`    Error: ${e.message}`);
        break;
      }
    }
    console.log(`    → fetched ${subcatFetched}`);
    await sleep(1000);
  }

  // Flush remaining
  if (batch.length > 0) await sendBatch(batch, stats);
}

// ============================================================
// PANINI — Magento GraphQL API
// ============================================================

const PANINI_CATEGORIES = [
  { id: 23, name: 'Marvel' },
  { id: 20, name: 'DC' },
  { id: 5, name: 'Panini Comics' },
  { id: 41, name: 'Planet Mangá' },
];

const PANINI_PLACEHOLDER = 'placeholder';

const PANINI_BROWSER_URLS: { name: string; url: string }[] = [
  { name: 'Marvel', url: 'https://panini.com.br/marvel' },
  { name: 'DC', url: 'https://panini.com.br/dc' },
  { name: 'Panini Comics', url: 'https://panini.com.br/panini-comics' },
  { name: 'Planet Mangá', url: 'https://panini.com.br/planet-manga' },
];

async function extractProductsFromPage(page: Page): Promise<SyncItem[]> {
  return page.evaluate(() => {
    const products: any[] = [];
    // Magento 2 uses .product-item-info as the container
    const items = document.querySelectorAll('.product-item-info, .product-item');
    items.forEach(item => {
      try {
        const nameEl = item.querySelector('.product-item-name a, .product-item-link, a.product-item-link');
        const title = nameEl?.textContent?.trim() || '';
        if (!title) return;

        const linkEl = nameEl as HTMLAnchorElement | null;
        const href = linkEl?.href || '';
        // SKU from URL slug: /batman-vol-1.html → extract from data attribute or URL
        const sku = (item.querySelector('[data-product-sku]') as HTMLElement)?.getAttribute('data-product-sku')
          || (item.closest('[data-product-id]') as HTMLElement)?.getAttribute('data-product-id')
          || href.replace(/.*\//, '').replace('.html', '')
          || '';

        let price: number | null = null;
        const priceAttr = item.querySelector('[data-price-amount]')?.getAttribute('data-price-amount');
        if (priceAttr) price = parseFloat(priceAttr);
        else {
          const priceEl = item.querySelector('.price');
          const priceText = priceEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.');
          if (priceText) price = parseFloat(priceText) || null;
        }

        const imgEl = item.querySelector('img.product-image-photo, img') as HTMLImageElement | null;
        let imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || null;
        if (imageUrl?.includes('placeholder')) imageUrl = null;

        products.push({ title, sku, price, imageUrl });
      } catch { /* skip */ }
    });
    return products;
  }).then(raw => raw.filter(p => p.sku).map(p => ({
    sourceKey: `panini:${p.sku}`,
    title: p.title,
    publisher: 'Panini' as string | null,
    coverPrice: p.price && p.price > 0 ? p.price : null,
    categories: [] as string[],
    imageUrl: p.imageUrl,
  })));
}

async function syncPaniniBrowser(stats: SyncStats): Promise<boolean> {
  console.log('\n=== Panini Browser Fallback ===');
  let browser: Browser;
  try {
    const pw = await import('playwright');
    browser = await pw.chromium.launch({ headless: true });
  } catch (e: any) {
    console.log('  ⚠️ Playwright not available:', e.message);
    return false;
  }

  let batch: SyncItem[] = [];
  let totalFetched = 0;

  for (const cat of PANINI_BROWSER_URLS) {
    console.log(`  ${cat.name}...`);
    const page = await browser.newPage();
    let pageNum = 1;
    let catFetched = 0;

    try {
      while (true) {
        const url = pageNum === 1
          ? `${cat.url}?product_list_limit=36`
          : `${cat.url}?product_list_limit=36&p=${pageNum}`;

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        const products = await extractProductsFromPage(page);
        if (products.length === 0) break;

        products.forEach(p => { p.categories = [cat.name]; });
        batch.push(...products);
        catFetched += products.length;
        stats.fetched += products.length;

        if (batch.length >= BATCH_SIZE) {
          await sendBatch(batch, stats);
          batch = [];
        }

        // Check if there's a next page
        const hasNext = await page.evaluate(() => {
          const nextLink = document.querySelector('.pages-items .next, a.action.next');
          return !!nextLink;
        });
        if (!hasNext) break;

        pageNum++;
        await sleep(1000);
      }
    } catch (e: any) {
      console.error(`    Error: ${e.message}`);
    } finally {
      await page.close();
    }
    console.log(`    → ${catFetched} products`);
    await sleep(1000);
  }

  if (batch.length > 0) await sendBatch(batch, stats);
  await browser.close();
  totalFetched = stats.fetched;
  console.log(`  Browser fallback total: ${totalFetched}`);
  return totalFetched > 0;
}

async function testPaniniApi(): Promise<boolean> {
  try {
    const res = await fetch('https://panini.com.br/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Store: 'default' },
      body: JSON.stringify({ query: '{ products(pageSize: 1, currentPage: 1) { total_count } }' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.data?.products?.total_count;
  } catch { return false; }
}

async function syncPanini(stats: SyncStats) {
  console.log('\n=== Syncing Panini ===');

  // Test if GraphQL API is available
  const apiAvailable = await testPaniniApi();
  if (!apiAvailable) {
    console.log('  ⚠️ Panini GraphQL API unavailable — trying browser fallback...');
    const browserWorked = await syncPaniniBrowser(stats);
    if (!browserWorked) {
      console.log('  ❌ Browser fallback also failed. Skipping Panini.');
    }
    return;
  }

  console.log('  GraphQL API available ✅');
  let batch: SyncItem[] = [];

  for (const cat of PANINI_CATEGORIES) {
    console.log(`  ${cat.name} (id=${cat.id})...`);
    let currentPage = 1;
    const pageSize = 20;
    let catFetched = 0;

    while (true) {
      const query = `{
        products(filter: { category_id: { eq: "${cat.id}" } }, pageSize: ${pageSize}, currentPage: ${currentPage}, sort: { position: ASC }) {
          total_count
          items { name sku price_range { minimum_price { final_price { value } } } stock_status small_image { url } }
        }
      }`;

      try {
        let res: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            res = await fetch('https://panini.com.br/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Store: 'default' },
              body: JSON.stringify({ query }),
              signal: AbortSignal.timeout(60000),
            });
            break;
          } catch {
            if (attempt < 2) { console.log(`    Retry ${attempt + 1}/3...`); await sleep(3000); }
            else throw new Error('Panini GraphQL timeout after 3 attempts');
          }
        }
        if (!res) break;

        const json = await res.json();
        const products = json.data?.products;
        if (!products?.items?.length) break;

        for (const p of products.items) {
          stats.fetched++;
          catFetched++;

          const imageUrl = p.small_image?.url || null;
          const isPlaceholder = imageUrl?.includes(PANINI_PLACEHOLDER);
          const price = p.price_range?.minimum_price?.final_price?.value || 0;

          batch.push({
            sourceKey: `panini:${p.sku}`,
            title: p.name?.trim() || 'Sem título',
            publisher: 'Panini',
            coverPrice: price > 0 ? price : null,
            categories: [cat.name],
            imageUrl: isPlaceholder ? null : imageUrl,
          });

          if (batch.length >= BATCH_SIZE) {
            await sendBatch(batch, stats);
            batch = [];
          }
        }

        const totalPages = Math.ceil(products.total_count / pageSize);
        if (currentPage >= totalPages) break;
        currentPage++;
        await sleep(500);
      } catch (e: any) {
        console.error(`    Error: ${e.message}`);
        break;
      }
    }
    console.log(`    → fetched ${catFetched}`);
    await sleep(1000);
  }

  // Flush remaining
  if (batch.length > 0) await sendBatch(batch, stats);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=== ComicsTrunk Remote Catalog Sync ===');
  console.log(`API: ${API_URL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | ${FULL_SCAN ? 'FULL SCAN' : 'INCREMENTAL'}`);
  console.log(`Time: ${new Date().toISOString()}`);

  await login();

  // Get current status
  const statusRes = await fetch(`${API_URL}/sync/status`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (statusRes.ok) {
    const status = await statusRes.json();
    console.log(`Current catalog: ${status.data.totalEntries} entries (${status.data.withCover} with cover)`);
  }

  const rikaStats: SyncStats = { source: 'Rika', fetched: 0, sent: 0, created: 0, updated: 0, unchanged: 0, errors: 0, coversSent: 0, coversCreated: 0 };
  const paniniStats: SyncStats = { source: 'Panini', fetched: 0, sent: 0, created: 0, updated: 0, unchanged: 0, errors: 0, coversSent: 0, coversCreated: 0 };

  if (!PANINI_ONLY) await syncRika(rikaStats);
  if (!RIKA_ONLY) await syncPanini(paniniStats);

  // Report
  console.log('\n========================================');
  console.log('          SYNC REPORT');
  console.log('========================================');

  for (const s of [rikaStats, paniniStats]) {
    if ((RIKA_ONLY && s.source === 'Panini') || (PANINI_ONLY && s.source === 'Rika')) continue;
    console.log(`\n📦 ${s.source}:`);
    console.log(`  Fetched:     ${s.fetched}`);
    console.log(`  Sent:        ${s.sent}`);
    console.log(`  Created:     ${s.created}`);
    console.log(`  Updated:     ${s.updated}`);
    console.log(`  Unchanged:   ${s.unchanged}`);
    console.log(`  Errors:      ${s.errors}`);
    console.log(`  Covers sent: ${s.coversSent} (${s.coversCreated} new)`);
  }

  const totalCreated = rikaStats.created + paniniStats.created;
  const totalUpdated = rikaStats.updated + paniniStats.updated;
  const totalCovers = rikaStats.coversCreated + paniniStats.coversCreated;
  console.log(`\n✅ Total: ${totalCreated} novos, ${totalUpdated} atualizados, ${totalCovers} capas novas`);

  // Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    dryRun: DRY_RUN,
    fullScan: FULL_SCAN,
    rika: { fetched: rikaStats.fetched, created: rikaStats.created, updated: rikaStats.updated, errors: rikaStats.errors, covers: rikaStats.coversCreated },
    panini: { fetched: paniniStats.fetched, created: paniniStats.created, updated: paniniStats.updated, errors: paniniStats.errors, covers: paniniStats.coversCreated },
  };
  const outPath = path.join(__dirname, 'last-remote-sync.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
