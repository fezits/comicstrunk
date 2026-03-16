import { Prisma, ApprovalStatus } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { BadRequestError } from '../../shared/utils/api-error';
import { jsonImportRowSchema } from '@comicstrunk/contracts';
import type { JsonImportRow, JsonImportOptions } from '@comicstrunk/contracts';
import slugify from 'slugify';

// === Types ===

export type ImportProgressCallback = (progress: {
  phase: 'validating' | 'preparing' | 'importing' | 'complete';
  current: number;
  total: number;
  message: string;
}) => void;

export interface ImportRowError {
  row: number;
  externalId: string;
  field?: string;
  message: string;
}

export interface JsonImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
  seriesCreated: string[];
  categoriesCreated: string[];
  durationMs: number;
}

// === Transformation Functions (pure, testable) ===

export function extractEditionNumber(name: string): number | null {
  const match = name.match(/#\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

export function parsePubDate(pubDate: string): { year: number | null; month: number | null } {
  const match = pubDate.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return { year: null, month: null };

  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  if (month < 1 || month > 12) return { year, month: null };
  if (year < 1900 || year > 2100) return { year: null, month };

  return { year, month };
}

export function parsePageCount(pages: string): number | null {
  const num = parseInt(pages, 10);
  return isNaN(num) || num <= 0 ? null : num;
}

// === Slug Generation (same pattern as seed-catalog.ts) ===

async function generateUniqueSlug(
  base: string,
  model: 'category' | 'tag' | 'character',
): Promise<string> {
  let slug = slugify(base, { lower: true, strict: true });
  let counter = 0;

  const exists = async (s: string) => {
    if (model === 'category') return prisma.category.findUnique({ where: { slug: s } });
    if (model === 'tag') return prisma.tag.findUnique({ where: { slug: s } });
    return prisma.character.findUnique({ where: { slug: s } });
  };

  while (await exists(slug)) {
    counter++;
    slug = `${slugify(base, { lower: true, strict: true })}-${counter}`;
  }
  return slug;
}

// === Pre-processing: Lookup or Create Series & Categories ===

async function ensureLookups(
  rows: JsonImportRow[],
): Promise<{
  seriesMap: Map<string, string>;
  categoryMap: Map<string, string>;
  seriesCreated: string[];
  categoriesCreated: string[];
}> {
  const seriesNames = new Set<string>();
  const categoryNames = new Set<string>();

  for (const row of rows) {
    if (row.series?.trim()) seriesNames.add(row.series.trim());
    if (row.universe?.trim()) categoryNames.add(row.universe.trim());
  }

  // Build series map
  const seriesMap = new Map<string, string>();
  const seriesCreated: string[] = [];

  for (const name of seriesNames) {
    const existing = await prisma.series.findFirst({ where: { title: name } });
    if (existing) {
      seriesMap.set(name, existing.id);
    } else {
      const created = await prisma.series.create({
        data: { title: name, description: null, totalEditions: 0 },
      });
      seriesMap.set(name, created.id);
      seriesCreated.push(name);
    }
  }

  // Build category map
  const categoryMap = new Map<string, string>();
  const categoriesCreated: string[] = [];

  for (const name of categoryNames) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      categoryMap.set(name, existing.id);
    } else {
      const slug = await generateUniqueSlug(name, 'category');
      const created = await prisma.category.create({
        data: { name, slug, description: null },
      });
      categoryMap.set(name, created.id);
      categoriesCreated.push(name);
    }
  }

  return { seriesMap, categoryMap, seriesCreated, categoriesCreated };
}

// === Deduplication ===

async function loadExistingBarcodes(barcodes: string[]): Promise<Set<string>> {
  if (barcodes.length === 0) return new Set();
  const existing = await prisma.catalogEntry.findMany({
    where: { barcode: { in: barcodes } },
    select: { barcode: true },
  });
  return new Set(existing.map((e) => e.barcode).filter(Boolean) as string[]);
}

// === Batch Helper ===

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// === Main Import Function ===

const DEFAULT_BATCH_SIZE = 50;
const MAX_IMPORT_ROWS = 10000;

export async function importFromJSON(
  rows: unknown[],
  adminId: string,
  options?: Partial<JsonImportOptions>,
  onProgress?: ImportProgressCallback,
): Promise<JsonImportResult> {
  const startTime = Date.now();
  const opts = {
    defaultApprovalStatus: options?.defaultApprovalStatus ?? 'APPROVED',
    skipDuplicates: options?.skipDuplicates ?? true,
    batchSize: options?.batchSize ?? DEFAULT_BATCH_SIZE,
  };

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(`Import exceeds maximum of ${MAX_IMPORT_ROWS} rows`);
  }

  // Phase 1: Validate all rows
  const errors: ImportRowError[] = [];
  const validRows: { index: number; data: JsonImportRow }[] = [];

  for (let i = 0; i < rows.length; i++) {
    onProgress?.({
      phase: 'validating',
      current: i + 1,
      total: rows.length,
      message: `Validating row ${i + 1}/${rows.length}`,
    });

    const result = jsonImportRowSchema.safeParse(rows[i]);
    if (!result.success) {
      const messages = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      errors.push({
        row: i + 1,
        externalId: (rows[i] as Record<string, unknown>)?.id?.toString() ?? 'unknown',
        message: messages,
      });
      continue;
    }
    validRows.push({ index: i + 1, data: result.data });
  }

  if (validRows.length === 0) {
    return {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors,
      seriesCreated: [],
      categoriesCreated: [],
      durationMs: Date.now() - startTime,
    };
  }

  // Phase 2: Pre-process — create series/categories
  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: validRows.length,
    message: 'Creating series and categories...',
  });

  const { seriesMap, categoryMap, seriesCreated, categoriesCreated } = await ensureLookups(
    validRows.map((r) => r.data),
  );

  // Phase 3: Load existing barcodes for deduplication
  const allBarcodes = validRows.map((r) => r.data.id).filter(Boolean);
  const existingBarcodes = opts.skipDuplicates
    ? await loadExistingBarcodes(allBarcodes)
    : new Set<string>();

  // Phase 4: Batch import
  let created = 0;
  let skipped = 0;
  const batches = chunkArray(validRows, opts.batchSize);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = batchIdx * opts.batchSize;

    onProgress?.({
      phase: 'importing',
      current: batchStart,
      total: validRows.length,
      message: `Importing batch ${batchIdx + 1}/${batches.length}...`,
    });

    await prisma.$transaction(async (tx) => {
      for (const { index, data } of batch) {
        // Skip duplicates
        if (existingBarcodes.has(data.id)) {
          skipped++;
          continue;
        }

        try {
          // Transform row
          const editionNumber = extractEditionNumber(data.name);
          const { year, month } = data.pubDate
            ? parsePubDate(data.pubDate)
            : { year: null, month: null };
          const pageCount = data.pages ? parsePageCount(data.pages) : null;
          const seriesId = data.series?.trim()
            ? seriesMap.get(data.series.trim()) ?? null
            : null;
          const categoryId = data.universe?.trim()
            ? categoryMap.get(data.universe.trim()) ?? null
            : null;

          // Create catalog entry
          const entry = await tx.catalogEntry.create({
            data: {
              title: data.name,
              barcode: data.id,
              publisher: data.publisher || null,
              seriesId,
              editionNumber,
              coverPrice: data.price ? new Prisma.Decimal(data.price) : null,
              publishYear: year,
              publishMonth: month,
              pageCount,
              coverFileName: data.coverFile || null,
              approvalStatus: opts.defaultApprovalStatus as ApprovalStatus,
              createdById: adminId,
            },
          });

          // Link category via junction table
          if (categoryId) {
            await tx.catalogCategory.create({
              data: {
                catalogEntryId: entry.id,
                categoryId,
              },
            });
          }

          created++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push({
            row: index,
            externalId: data.id,
            message,
          });
        }
      }
    });
  }

  onProgress?.({
    phase: 'complete',
    current: validRows.length,
    total: validRows.length,
    message: `Import complete: ${created} created, ${skipped} skipped, ${errors.length} errors`,
  });

  return {
    total: rows.length,
    created,
    skipped,
    errors,
    seriesCreated,
    categoriesCreated,
    durationMs: Date.now() - startTime,
  };
}
