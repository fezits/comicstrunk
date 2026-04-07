import { PrismaClient, ApprovalStatus } from '@prisma/client';
import type { SyncCatalogItem } from '@comicstrunk/contracts';
import * as fs from 'fs';
import * as path from 'path';

// Use a raw PrismaClient (without $extends) to access sourceKey
const syncPrisma = new PrismaClient();

const ADMIN_ID = 'cmmwujcy90000chw9c2vkwf7n';
const COVERS_DIR = path.resolve(__dirname, '..', '..', '..', 'uploads', 'covers');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getOrCreateCategory(name: string): Promise<string> {
  const slug = slugify(name);
  let cat = await syncPrisma.category.findUnique({ where: { slug } });
  if (!cat) {
    cat = await syncPrisma.category.create({ data: { name, slug } });
  }
  return cat.id;
}

export interface SyncResult {
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  details: string[];
}

export async function syncCatalogItems(items: SyncCatalogItem[]): Promise<SyncResult> {
  const result: SyncResult = {
    received: items.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  for (const item of items) {
    try {
      const existing = await syncPrisma.catalogEntry.findUnique({
        where: { sourceKey: item.sourceKey },
      });

      if (existing) {
        // Check if price changed
        const priceChanged =
          item.coverPrice != null &&
          existing.coverPrice !== null &&
          Math.abs(Number(existing.coverPrice) - item.coverPrice) > 0.01;

        if (priceChanged) {
          await syncPrisma.catalogEntry.update({
            where: { id: existing.id },
            data: { coverPrice: item.coverPrice },
          });
          result.updated++;
          result.details.push(`[UPDATED] ${item.sourceKey} price: ${existing.coverPrice} → ${item.coverPrice}`);
        } else {
          result.unchanged++;
        }
      } else {
        // Create new entry
        const entry = await syncPrisma.catalogEntry.create({
          data: {
            title: item.title,
            publisher: item.publisher || null,
            sourceKey: item.sourceKey,
            coverPrice: item.coverPrice || null,
            approvalStatus: ApprovalStatus.APPROVED,
            createdById: ADMIN_ID,
          },
        });

        // Link categories
        for (const catName of item.categories || []) {
          try {
            const catId = await getOrCreateCategory(catName);
            await syncPrisma.catalogCategory.create({
              data: { catalogEntryId: entry.id, categoryId: catId },
            });
          } catch {
            // ignore duplicate category links
          }
        }

        result.created++;
        result.details.push(`[CREATED] ${item.sourceKey} "${item.title.substring(0, 50)}"`);
      }
    } catch (e: any) {
      result.errors++;
      result.details.push(`[ERROR] ${item.sourceKey}: ${e.message}`);
    }
  }

  return result;
}

export interface CoverResult {
  sourceKey: string;
  coverFileName: string;
  status: 'created' | 'already_exists' | 'entry_not_found';
}

export async function syncCover(
  sourceKey: string,
  fileBuffer: Buffer,
  originalName: string,
): Promise<CoverResult> {
  // Find entry by sourceKey
  const entry = await syncPrisma.catalogEntry.findUnique({
    where: { sourceKey },
  });

  if (!entry) {
    return { sourceKey, coverFileName: '', status: 'entry_not_found' };
  }

  // Build filename from sourceKey: rika:123 → rika-123.jpg
  const coverFileName = sourceKey.replace(':', '-') + path.extname(originalName || '.jpg');

  const coverPath = path.join(COVERS_DIR, coverFileName);

  // Check if already exists
  if (fs.existsSync(coverPath)) {
    return { sourceKey, coverFileName, status: 'already_exists' };
  }

  // Save file
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }
  fs.writeFileSync(coverPath, fileBuffer);

  // Update entry
  await syncPrisma.catalogEntry.update({
    where: { id: entry.id },
    data: { coverFileName },
  });

  return { sourceKey, coverFileName, status: 'created' };
}

export async function getSyncStatus() {
  const totalEntries = await syncPrisma.catalogEntry.count();
  const withCover = await syncPrisma.catalogEntry.count({ where: { coverFileName: { not: null } } });
  const withoutCover = totalEntries - withCover;

  const rikaTotal = await syncPrisma.catalogEntry.count({ where: { sourceKey: { startsWith: 'rika:' } } });
  const rikaCover = await syncPrisma.catalogEntry.count({ where: { sourceKey: { startsWith: 'rika:' }, coverFileName: { not: null } } });
  const paniniTotal = await syncPrisma.catalogEntry.count({ where: { sourceKey: { startsWith: 'panini:' } } });
  const paniniCover = await syncPrisma.catalogEntry.count({ where: { sourceKey: { startsWith: 'panini:' }, coverFileName: { not: null } } });

  // Last sync file
  let lastSync: string | null = null;
  const syncFile = path.resolve(__dirname, '..', '..', '..', 'scripts', 'last-sync.json');
  if (fs.existsSync(syncFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(syncFile, 'utf-8'));
      lastSync = data.timestamp || null;
    } catch { /* ignore */ }
  }

  return {
    totalEntries,
    withCover,
    withoutCover,
    bySource: {
      rika: { total: rikaTotal, withCover: rikaCover },
      panini: { total: paniniTotal, withCover: paniniCover },
    },
    lastSync,
  };
}
