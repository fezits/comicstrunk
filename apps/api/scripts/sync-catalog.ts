/**
 * sync-catalog.ts — Incremental sync from Rika (VTEX) + Panini (GraphQL).
 * 
 * STRATEGY: Fetch newest items first (by release date). Stop when we hit
 * items that already exist in the DB (by sourceKey). This means daily runs
 * only fetch the handful of new releases instead of re-downloading everything.
 * 
 * Usage: npx tsx scripts/sync-catalog.ts [--dry-run] [--rika-only] [--panini-only] [--full]
 * 
 * --full: Force full scan (ignores early-stop optimization)
 */
import { PrismaClient, ApprovalStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const COVERS_DIR = path.resolve(__dirname, '..', 'uploads', 'covers');
const ADMIN_ID = 'cmmwujcy90000chw9c2vkwf7n';
const DRY_RUN = process.argv.includes('--dry-run');
const RIKA_ONLY = process.argv.includes('--rika-only');
const PANINI_ONLY = process.argv.includes('--panini-only');
const FULL_SCAN = process.argv.includes('--full');

// How many consecutive "already exists" items before we stop fetching
const STOP_AFTER_EXISTING = 100;

interface SyncStats {
  source: string;
  fetched: number;
  newItems: number;
  updated: number;
  unchanged: number;
  errors: number;
  newCovers: number;
  changes: string[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function downloadCover(url: string, filename: string): Promise<boolean> {
  try {
    if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
    const filepath = path.join(COVERS_DIR, filename);
    if (fs.existsSync(filepath)) return false;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateCategory(name: string): Promise<string> {
  const slug = slugify(name);
  let cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) cat = await prisma.category.create({ data: { name, slug } });
  return cat.id;
}

// ============================================================
// RIKA — VTEX Catalog API (incremental)
// ============================================================

const RIKA_SUBCATEGORIES = [
  'Super-herois/Marvel',
  'Super-herois/DC',
  'Super-herois/Vertigo',
  'Super-herois/Image',
  'Super-herois/ETC',
  'Super-herois',
];

async function syncRika(stats: SyncStats) {
  console.log('\n=== Syncing Rika (incremental) ===');
  const seenIds = new Set<string>();

  for (const subcat of RIKA_SUBCATEGORIES) {
    console.log(`  Fetching ${subcat}...`);
    let from = 0;
    const pageSize = 50;
    let consecutiveExisting = 0;
    let subcatNew = 0;

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

          const sourceKey = `rika:${productId}`;
          const existing = await prisma.catalogEntry.findUnique({ where: { sourceKey } });

          if (existing) {
            // Check price update
            const item = product.items?.[0];
            const seller = item?.sellers?.[0]?.commertialOffer;
            const newPrice = seller?.Price || 0;

            if (newPrice > 0 && existing.coverPrice !== null && Math.abs(Number(existing.coverPrice) - newPrice) > 0.01) {
              if (!DRY_RUN) {
                await prisma.catalogEntry.update({ where: { id: existing.id }, data: { coverPrice: newPrice } });
              }
              stats.updated++;
              stats.changes.push(`[PRICE] ${sourceKey} "${existing.title?.substring(0, 40)}": ${existing.coverPrice} → ${newPrice}`);
              consecutiveExisting = 0; // price changed = still interesting
            } else {
              stats.unchanged++;
              consecutiveExisting++;
            }
          } else {
            // New item!
            consecutiveExisting = 0;
            const item = product.items?.[0];
            const seller = item?.sellers?.[0]?.commertialOffer;
            const image = item?.images?.[0]?.imageUrl || null;
            const price = seller?.Price || 0;

            if (!DRY_RUN) {
              try {
                const entry = await prisma.catalogEntry.create({
                  data: {
                    title: product.productName.trim(),
                    publisher: product.brand || null,
                    sourceKey,
                    coverPrice: price > 0 ? price : null,
                    approvalStatus: ApprovalStatus.APPROVED,
                    createdById: ADMIN_ID,
                  },
                });

                if (image) {
                  const coverFile = `rika-${productId}.jpg`;
                  const downloaded = await downloadCover(image, coverFile);
                  if (downloaded) {
                    await prisma.catalogEntry.update({ where: { id: entry.id }, data: { coverFileName: coverFile } });
                    stats.newCovers++;
                  }
                }

                // Link categories
                for (const catPath of (product.categories || [])) {
                  const catName = catPath.split('/').filter(Boolean).pop();
                  if (catName) {
                    const catId = await getOrCreateCategory(catName);
                    await prisma.catalogCategory.create({ data: { catalogEntryId: entry.id, categoryId: catId } }).catch(() => {});
                  }
                }
              } catch (e: any) {
                stats.errors++;
              }
            }

            stats.newItems++;
            subcatNew++;
            stats.changes.push(`[NEW] ${sourceKey} "${product.productName?.substring(0, 50)}"`);
          }
        }

        // Early stop: if we've seen many consecutive existing items, we're past the new ones
        if (!FULL_SCAN && consecutiveExisting >= STOP_AFTER_EXISTING) {
          console.log(`    Early stop after ${consecutiveExisting} consecutive existing items`);
          break;
        }

        // Check range limit
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

    console.log(`    → ${subcatNew} new`);
    await sleep(1000);
  }
}

// ============================================================
// PANINI — Magento GraphQL API (incremental)
// ============================================================

const PANINI_CATEGORIES = [
  { id: 23, name: 'Marvel' },
  { id: 20, name: 'DC' },
  { id: 5, name: 'Panini Comics' },
  { id: 41, name: 'Planet Mangá' },
];

async function syncPanini(stats: SyncStats) {
  console.log('\n=== Syncing Panini (incremental) ===');

  for (const cat of PANINI_CATEGORIES) {
    console.log(`  Fetching ${cat.name} (id=${cat.id})...`);
    let currentPage = 1;
    const pageSize = 20;
    let consecutiveExisting = 0;
    let catNew = 0;

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
          } catch (retryErr: any) {
            if (attempt < 2) {
              console.log(`    Retry ${attempt + 1}/3 for page ${currentPage}...`);
              await sleep(3000);
            } else throw retryErr;
          }
        }
        if (!res) break;

        const json = await res.json();
        const products = json.data?.products;
        if (!products?.items?.length) break;

        for (const p of products.items) {
          stats.fetched++;
          const sourceKey = `panini:${p.sku}`;
          const existing = await prisma.catalogEntry.findUnique({ where: { sourceKey } });

          if (existing) {
            const newPrice = p.price_range?.minimum_price?.final_price?.value || 0;
            if (newPrice > 0 && existing.coverPrice !== null && Math.abs(Number(existing.coverPrice) - newPrice) > 0.01) {
              if (!DRY_RUN) {
                await prisma.catalogEntry.update({ where: { id: existing.id }, data: { coverPrice: newPrice } });
              }
              stats.updated++;
              stats.changes.push(`[PRICE] ${sourceKey} "${existing.title?.substring(0, 40)}": ${existing.coverPrice} → ${newPrice}`);
              consecutiveExisting = 0;
            } else {
              stats.unchanged++;
              consecutiveExisting++;
            }
          } else {
            consecutiveExisting = 0;
            const imageUrl = p.small_image?.url || null;
            const isPlaceholder = imageUrl?.includes('placeholder');
            const price = p.price_range?.minimum_price?.final_price?.value || 0;

            if (!DRY_RUN) {
              try {
                const entry = await prisma.catalogEntry.create({
                  data: {
                    title: p.name.trim(),
                    publisher: 'Panini',
                    sourceKey,
                    coverPrice: price > 0 ? price : null,
                    approvalStatus: ApprovalStatus.APPROVED,
                    createdById: ADMIN_ID,
                  },
                });

                if (imageUrl && !isPlaceholder) {
                  const coverFile = `panini-${p.sku}.jpg`;
                  const downloaded = await downloadCover(imageUrl, coverFile);
                  if (downloaded) {
                    await prisma.catalogEntry.update({ where: { id: entry.id }, data: { coverFileName: coverFile } });
                    stats.newCovers++;
                  }
                }
              } catch (e: any) {
                stats.errors++;
              }
            }

            stats.newItems++;
            catNew++;
            stats.changes.push(`[NEW] ${sourceKey} "${p.name?.substring(0, 50)}"`);
          }
        }

        // Early stop
        if (!FULL_SCAN && consecutiveExisting >= STOP_AFTER_EXISTING) {
          console.log(`    Early stop after ${consecutiveExisting} consecutive existing`);
          break;
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

    console.log(`    → ${catNew} new`);
    await sleep(1000);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=== ComicsTrunk Catalog Sync ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | ${FULL_SCAN ? 'FULL SCAN' : 'INCREMENTAL'}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const rikaStats: SyncStats = { source: 'Rika', fetched: 0, newItems: 0, updated: 0, unchanged: 0, errors: 0, newCovers: 0, changes: [] };
  const paniniStats: SyncStats = { source: 'Panini', fetched: 0, newItems: 0, updated: 0, unchanged: 0, errors: 0, newCovers: 0, changes: [] };

  if (!PANINI_ONLY) await syncRika(rikaStats);
  if (!RIKA_ONLY) await syncPanini(paniniStats);

  // Report
  console.log('\n========================================');
  console.log('          SYNC REPORT');
  console.log('========================================');

  for (const stats of [rikaStats, paniniStats]) {
    if ((RIKA_ONLY && stats.source === 'Panini') || (PANINI_ONLY && stats.source === 'Rika')) continue;
    console.log(`\n📦 ${stats.source}:`);
    console.log(`  Fetched:   ${stats.fetched}`);
    console.log(`  New:       ${stats.newItems}`);
    console.log(`  Updated:   ${stats.updated}`);
    console.log(`  Unchanged: ${stats.unchanged}`);
    console.log(`  Errors:    ${stats.errors}`);
    console.log(`  Covers:    ${stats.newCovers}`);
    if (stats.changes.length > 0 && stats.changes.length <= 30) {
      console.log(`  Changes:`);
      stats.changes.forEach((c) => console.log(`    ${c}`));
    } else if (stats.changes.length > 30) {
      console.log(`  Changes (showing last 20 of ${stats.changes.length}):`);
      stats.changes.slice(-20).forEach((c) => console.log(`    ${c}`));
    }
  }

  const totalNew = rikaStats.newItems + paniniStats.newItems;
  const totalUpdated = rikaStats.updated + paniniStats.updated;
  console.log(`\n✅ Total: ${totalNew} novos, ${totalUpdated} atualizados`);

  // Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    fullScan: FULL_SCAN,
    rika: { fetched: rikaStats.fetched, new: rikaStats.newItems, updated: rikaStats.updated, errors: rikaStats.errors, covers: rikaStats.newCovers },
    panini: { fetched: paniniStats.fetched, new: paniniStats.newItems, updated: paniniStats.updated, errors: paniniStats.errors, covers: paniniStats.newCovers },
  };
  fs.writeFileSync(path.join(__dirname, 'last-sync.json'), JSON.stringify(summary, null, 2));
  console.log('\nSaved to scripts/last-sync.json');
}

main()
  .catch((e) => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
