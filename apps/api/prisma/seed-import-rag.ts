/**
 * Import comics from RAG project JSON files into ComicsTrunk database.
 * Sources: catalog.json (Rika) + catalog-panini.json (Panini)
 */
import { PrismaClient, ApprovalStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const RAG_DATA = 'C:\\Projetos\\Estudo\\rag-project\\data';
const ADMIN_ID = 'cmmwujcy90000chw9c2vkwf7n'; // admin seed user

interface RagItem {
  id: string;
  name: string;
  brand?: string;
  publisher?: string;
  universe?: string;
  series?: string;
  price?: number;
  oldPrice?: number;
  available?: boolean;
  image?: string;
  link?: string;
  pubDate?: string;
  pages?: string;
  coverFile?: string;
  categories?: string[];
}

interface RagCatalog {
  source: string;
  totalItems: number;
  items: RagItem[];
}

// Cache for created categories and series
const categoryCache = new Map<string, string>();
const seriesCache = new Map<string, string>();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePubDate(pubDate?: string): { year?: number; month?: number } {
  if (!pubDate) return {};
  // Format: "8/2024" or "12/2024"
  const match = pubDate.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    return { month: parseInt(match[1]), year: parseInt(match[2]) };
  }
  return {};
}

async function getOrCreateCategory(name: string): Promise<string> {
  if (categoryCache.has(name)) return categoryCache.get(name)!;

  const slug = slugify(name);
  let cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name, slug },
    });
  }
  categoryCache.set(name, cat.id);
  return cat.id;
}

async function getOrCreateSeries(title: string): Promise<string> {
  if (seriesCache.has(title)) return seriesCache.get(title)!;

  let series = await prisma.series.findFirst({ where: { title } });
  if (!series) {
    series = await prisma.series.create({
      data: { title, totalEditions: 0 },
    });
  }
  seriesCache.set(title, series.id);
  return series.id;
}

async function importItems(items: RagItem[], source: string) {
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 100;

  console.log(`  Importing ${items.length} items from ${source}...`);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (const item of batch) {
      try {
        // Skip items without a name
        if (!item.name || item.name.trim() === '') {
          skipped++;
          continue;
        }

        // Check if already exists by barcode (using source ID as barcode)
        const barcode = `${source}-${item.id}`;
        const existing = await prisma.catalogEntry.findFirst({
          where: { barcode },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const { year, month } = parsePubDate(item.pubDate);
        const pageCount = item.pages ? parseInt(item.pages) : null;

        // Determine cover image URL
        let coverImageUrl = item.image || null;
        if (coverImageUrl?.includes('placeholder')) {
          coverImageUrl = null;
        }

        // Create catalog entry
        const entry = await prisma.catalogEntry.create({
          data: {
            title: item.name.trim(),
            publisher: item.publisher || item.brand || null,
            barcode,
            coverImageUrl,
            coverPrice: item.price ? item.price : null,
            publishYear: year || null,
            publishMonth: month || null,
            pageCount: pageCount && !isNaN(pageCount) ? pageCount : null,
            coverFileName: item.coverFile || null,
            approvalStatus: ApprovalStatus.APPROVED,
            createdById: ADMIN_ID,
            seriesId: item.series ? await getOrCreateSeries(item.series) : null,
          },
        });

        // Link universe as category
        if (item.universe) {
          const catId = await getOrCreateCategory(item.universe);
          await prisma.catalogCategory.create({
            data: { catalogEntryId: entry.id, categoryId: catId },
          }).catch(() => {}); // ignore duplicates
        }

        created++;
      } catch (e: any) {
        errors++;
        if (errors <= 5) {
          console.log(`    Error on "${item.name}": ${e.message}`);
        }
      }
    }

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= items.length) {
      console.log(`    Progress: ${Math.min(i + batchSize, items.length)}/${items.length} (created: ${created}, skipped: ${skipped}, errors: ${errors})`);
    }
  }

  return { created, skipped, errors };
}

async function main() {
  console.log('=== RAG Import Script ===\n');

  // Load Rika catalog
  const rikaPath = path.join(RAG_DATA, 'catalog.json');
  if (fs.existsSync(rikaPath)) {
    const rikaRaw = fs.readFileSync(rikaPath);
    // Strip BOM if present
    const rikaStr = rikaRaw[0] === 0xEF ? rikaRaw.subarray(3).toString('utf-8') : rikaRaw.toString('utf-8');
    const rika: RagCatalog = JSON.parse(rikaStr);
    console.log(`Rika catalog: ${rika.totalItems} items`);
    const rikaResult = await importItems(rika.items, 'rika');
    console.log(`  Result: ${rikaResult.created} created, ${rikaResult.skipped} skipped, ${rikaResult.errors} errors\n`);
  } else {
    console.log('Rika catalog not found, skipping.\n');
  }

  // Load Panini catalog
  const paniniPath = path.join(RAG_DATA, 'catalog-panini.json');
  if (fs.existsSync(paniniPath)) {
    const paniniRaw = fs.readFileSync(paniniPath);
    const paniniStr = paniniRaw[0] === 0xEF ? paniniRaw.subarray(3).toString('utf-8') : paniniRaw.toString('utf-8');
    const panini: RagCatalog = JSON.parse(paniniStr);
    console.log(`Panini catalog: ${panini.totalItems} items`);
    const paniniResult = await importItems(panini.items, 'panini');
    console.log(`  Result: ${paniniResult.created} created, ${paniniResult.skipped} skipped, ${paniniResult.errors} errors\n`);
  } else {
    console.log('Panini catalog not found, skipping.\n');
  }

  console.log('=== Import complete ===');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
