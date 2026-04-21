import { Prisma, ApprovalStatus } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { BadRequestError } from '../../shared/utils/api-error';
import { jsonImportRowSchema } from '@comicstrunk/contracts';
import type { JsonImportRow, JsonImportOptions, ImportDuplicateMatch } from '@comicstrunk/contracts';
import slugify from 'slugify';

// === Types ===

export type ImportProgressCallback = (progress: {
  phase: 'validating' | 'preparing' | 'deduplicating' | 'importing' | 'complete';
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
  updated: number;
  errors: ImportRowError[];
  duplicates: ImportDuplicateMatch[];
  seriesCreated: string[];
  categoriesCreated: string[];
  tagsCreated: string[];
  charactersCreated: string[];
  durationMs: number;
}

// === Transformation Functions (pure, testable) ===

export function extractEditionNumber(name: string): number | null {
  // Match patterns: #42, # 42, Vol. 42, Vol 42, Volume 42, Edicao 42, Ed. 42
  const patterns = [
    /#\s*(\d+)/,
    /Vol\.?\s*(\d+)/i,
    /Volume\s+(\d+)/i,
    /Edi[cç][aã]o\s+(\d+)/i,
    /Ed\.?\s*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export function parsePubDate(pubDate: string): { year: number | null; month: number | null } {
  // Format: M/YYYY
  let match = pubDate.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    return {
      year: year >= 1900 && year <= 2100 ? year : null,
      month: month >= 1 && month <= 12 ? month : null,
    };
  }

  // Format: DD/MM/YYYY
  match = pubDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return {
      year: year >= 1900 && year <= 2100 ? year : null,
      month: month >= 1 && month <= 12 ? month : null,
    };
  }

  // Format: YYYY (year only)
  match = pubDate.match(/^(\d{4})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    return {
      year: year >= 1900 && year <= 2100 ? year : null,
      month: null,
    };
  }

  return { year: null, month: null };
}

export function parsePageCount(pages: string | number): number | null {
  const num = typeof pages === 'number' ? pages : parseInt(String(pages), 10);
  return isNaN(num) || num <= 0 ? null : num;
}

export function parseVolumeNumber(vol: string | number | undefined): number | null {
  if (vol === undefined || vol === null) return null;
  const num = typeof vol === 'number' ? vol : parseInt(String(vol), 10);
  return isNaN(num) || num <= 0 ? null : num;
}

/** Parse tags/characters from string (comma-separated) or array */
export function parseStringOrArray(input: string | string[] | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((s) => s.trim()).filter(Boolean);
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Normalize title for fuzzy comparison: lowercase, remove accents, extra spaces, punctuation */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s]/g, ' ')        // punctuation to spaces
    .replace(/\s+/g, ' ')            // collapse spaces
    .trim();
}

/** Calculate similarity score between two normalized strings (0-100) */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 100;
  // Levenshtein-based similarity for short strings
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(na, nb);
  return Math.round((1 - dist / maxLen) * 100);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

// === Slug Generation ===

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

// === Pre-processing: Lookup or Create Series, Categories, Tags, Characters ===

async function ensureLookups(rows: JsonImportRow[]): Promise<{
  seriesMap: Map<string, string>;
  categoryMap: Map<string, string>;
  tagMap: Map<string, string>;
  characterMap: Map<string, string>;
  seriesCreated: string[];
  categoriesCreated: string[];
  tagsCreated: string[];
  charactersCreated: string[];
}> {
  const seriesNames = new Set<string>();
  const categoryNames = new Set<string>();
  const tagNames = new Set<string>();
  const characterNames = new Set<string>();

  for (const row of rows) {
    if (row.series?.trim()) seriesNames.add(row.series.trim());
    if (row.universe?.trim()) categoryNames.add(row.universe.trim());
    if (row.categories) row.categories.forEach((c) => c.trim() && categoryNames.add(c.trim()));
    for (const t of parseStringOrArray(row.tags)) tagNames.add(t);
    for (const c of parseStringOrArray(row.characters)) characterNames.add(c);
  }

  // Series
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

  // Categories
  const categoryMap = new Map<string, string>();
  const categoriesCreated: string[] = [];
  for (const name of categoryNames) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      categoryMap.set(name, existing.id);
    } else {
      const slug = await generateUniqueSlug(name, 'category');
      const created = await prisma.category.create({ data: { name, slug, description: null } });
      categoryMap.set(name, created.id);
      categoriesCreated.push(name);
    }
  }

  // Tags
  const tagMap = new Map<string, string>();
  const tagsCreated: string[] = [];
  for (const name of tagNames) {
    const existing = await prisma.tag.findFirst({ where: { name } });
    if (existing) {
      tagMap.set(name, existing.id);
    } else {
      const slug = await generateUniqueSlug(name, 'tag');
      const created = await prisma.tag.create({ data: { name, slug } });
      tagMap.set(name, created.id);
      tagsCreated.push(name);
    }
  }

  // Characters
  const characterMap = new Map<string, string>();
  const charactersCreated: string[] = [];
  for (const name of characterNames) {
    const existing = await prisma.character.findFirst({ where: { name } });
    if (existing) {
      characterMap.set(name, existing.id);
    } else {
      const slug = await generateUniqueSlug(name, 'character');
      const created = await prisma.character.create({ data: { name, slug, description: null } });
      characterMap.set(name, created.id);
      charactersCreated.push(name);
    }
  }

  return {
    seriesMap, categoryMap, tagMap, characterMap,
    seriesCreated, categoriesCreated, tagsCreated, charactersCreated,
  };
}

// === Multi-Criteria Deduplication ===

type DeduplicationStrategy = 'barcode' | 'isbn' | 'source_key' | 'any_identifier' | 'fuzzy';

async function loadExistingSourceKeys(sourceKeys: string[]): Promise<Map<string, { id: string; coverPrice: any }>> {
  if (sourceKeys.length === 0) return new Map();
  const existing = await prisma.catalogEntry.findMany({
    where: { sourceKey: { in: sourceKeys } },
    select: { id: true, sourceKey: true, coverPrice: true },
  });
  const map = new Map<string, { id: string; coverPrice: any }>();
  for (const e of existing) {
    if (e.sourceKey) map.set(e.sourceKey, { id: e.id, coverPrice: e.coverPrice });
  }
  return map;
}

async function findDuplicates(
  rows: { index: number; data: JsonImportRow }[],
  strategy: DeduplicationStrategy,
): Promise<{
  duplicateSet: Set<number>;
  matches: ImportDuplicateMatch[];
}> {
  const duplicateSet = new Set<number>();
  const matches: ImportDuplicateMatch[] = [];

  const barcodes = rows.filter((r) => r.data.id).map((r) => r.data.id!);
  const isbns = rows.filter((r) => r.data.isbn).map((r) => r.data.isbn!);
  const sourceKeys = rows.filter((r) => r.data.sourceKey).map((r) => r.data.sourceKey!);

  const existingByBarcode = new Map<string, { id: string; title: string }>();
  const existingByIsbn = new Map<string, { id: string; title: string }>();
  const existingBySourceKey = new Map<string, { id: string; title: string }>();

  if (['barcode', 'any_identifier', 'fuzzy'].includes(strategy) && barcodes.length > 0) {
    const entries = await prisma.catalogEntry.findMany({
      where: { barcode: { in: barcodes } },
      select: { id: true, title: true, barcode: true },
    });
    for (const e of entries) {
      if (e.barcode) existingByBarcode.set(e.barcode, { id: e.id, title: e.title });
    }
  }

  if (['isbn', 'any_identifier', 'fuzzy'].includes(strategy) && isbns.length > 0) {
    const entries = await prisma.catalogEntry.findMany({
      where: { isbn: { in: isbns } },
      select: { id: true, title: true, isbn: true },
    });
    for (const e of entries) {
      if (e.isbn) existingByIsbn.set(e.isbn, { id: e.id, title: e.title });
    }
  }

  if (['source_key', 'any_identifier', 'fuzzy'].includes(strategy) && sourceKeys.length > 0) {
    const entries = await prisma.catalogEntry.findMany({
      where: { sourceKey: { in: sourceKeys } },
      select: { id: true, title: true, sourceKey: true },
    });
    for (const e of entries) {
      if (e.sourceKey) existingBySourceKey.set(e.sourceKey, { id: e.id, title: e.title });
    }
  }

  for (const { index, data } of rows) {
    const externalId = data.id || data.isbn || data.sourceKey || data.name;

    if (data.id && existingByBarcode.has(data.id)) {
      const match = existingByBarcode.get(data.id)!;
      duplicateSet.add(index);
      matches.push({ row: index, externalId, matchedBy: 'barcode', existingId: match.id, existingTitle: match.title, confidence: 100 });
      continue;
    }

    if (data.isbn && existingByIsbn.has(data.isbn)) {
      const match = existingByIsbn.get(data.isbn)!;
      duplicateSet.add(index);
      matches.push({ row: index, externalId, matchedBy: 'isbn', existingId: match.id, existingTitle: match.title, confidence: 100 });
      continue;
    }

    if (data.sourceKey && existingBySourceKey.has(data.sourceKey)) {
      const match = existingBySourceKey.get(data.sourceKey)!;
      duplicateSet.add(index);
      matches.push({ row: index, externalId, matchedBy: 'source_key', existingId: match.id, existingTitle: match.title, confidence: 100 });
      continue;
    }

    if (strategy === 'fuzzy' && data.name) {
      const candidates = await prisma.catalogEntry.findMany({
        where: { publisher: data.publisher || undefined },
        select: { id: true, title: true },
        take: 200,
      });
      let bestMatch: { id: string; title: string; score: number } | null = null;
      for (const candidate of candidates) {
        const score = titleSimilarity(data.name, candidate.title);
        if (score >= 85 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: candidate.id, title: candidate.title, score };
        }
      }
      if (bestMatch) {
        duplicateSet.add(index);
        matches.push({ row: index, externalId, matchedBy: 'fuzzy_title', existingId: bestMatch.id, existingTitle: bestMatch.title, confidence: bestMatch.score });
      }
    }
  }

  return { duplicateSet, matches };
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
    upsert: options?.upsert ?? false,
    deduplication: (options?.deduplication ?? 'any_identifier') as DeduplicationStrategy,
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
      total: rows.length, created: 0, skipped: 0, updated: 0, errors,
      duplicates: [], seriesCreated: [], categoriesCreated: [],
      tagsCreated: [], charactersCreated: [],
      durationMs: Date.now() - startTime,
    };
  }

  // Phase 2: Pre-process — create series/categories/tags/characters
  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: validRows.length,
    message: 'Creating series, categories, tags, and characters...',
  });

  const lookups = await ensureLookups(validRows.map((r) => r.data));

  // Phase 3: Deduplication
  onProgress?.({
    phase: 'deduplicating',
    current: 0,
    total: validRows.length,
    message: 'Checking for duplicates...',
  });

  const { duplicateSet, matches: duplicateMatches } = opts.skipDuplicates
    ? await findDuplicates(validRows, opts.deduplication)
    : { duplicateSet: new Set<number>(), matches: [] as ImportDuplicateMatch[] };

  // Load sourceKey map for upsert mode
  const allSourceKeys = validRows.map((r) => r.data.sourceKey).filter(Boolean) as string[];
  const existingBySourceKey = allSourceKeys.length > 0
    ? await loadExistingSourceKeys(allSourceKeys)
    : new Map<string, { id: string; coverPrice: any }>();

  // Phase 4: Batch import
  let created = 0;
  let skipped = 0;
  let updated = 0;
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
        if (duplicateSet.has(index)) {
          skipped++;
          continue;
        }

        try {
          // Check sourceKey-based dedup/upsert first
          if (data.sourceKey) {
            const existing = existingBySourceKey.get(data.sourceKey);
            if (existing) {
              if (opts.upsert) {
                let didUpdate = false;
                if (data.price != null) {
                  const oldPrice = existing.coverPrice !== null ? parseFloat(String(existing.coverPrice)) : null;
                  const newPrice = data.price;
                  if (oldPrice === null || Math.abs(oldPrice - newPrice) > 0.01) {
                    await tx.catalogEntry.update({
                      where: { id: existing.id },
                      data: { coverPrice: new Prisma.Decimal(newPrice) },
                    });
                    // Update in-memory map for subsequent rows
                    existing.coverPrice = new Prisma.Decimal(newPrice);
                    didUpdate = true;
                  }
                }
                if (didUpdate) {
                  updated++;
                } else {
                  skipped++;
                }
              } else {
                skipped++;
              }
              continue;
            }
          }

          // Transform row
          const editionNumber = extractEditionNumber(data.name);
          const volumeNumber = parseVolumeNumber(data.volumeNumber) ?? extractEditionNumber(data.name);
          const { year, month } = data.pubDate
            ? parsePubDate(data.pubDate)
            : { year: null, month: null };
          const pageCount = data.pages ? parsePageCount(data.pages) : null;
          const seriesId = data.series?.trim()
            ? lookups.seriesMap.get(data.series.trim()) ?? null
            : null;

          // Collect all category IDs (universe + categories array)
          const categoryIds: string[] = [];
          if (data.universe?.trim()) {
            const id = lookups.categoryMap.get(data.universe.trim());
            if (id) categoryIds.push(id);
          }
          if (data.categories) {
            for (const cat of data.categories) {
              const id = lookups.categoryMap.get(cat.trim());
              if (id && !categoryIds.includes(id)) categoryIds.push(id);
            }
          }

          const tagIds: string[] = [];
          for (const t of parseStringOrArray(data.tags)) {
            const id = lookups.tagMap.get(t);
            if (id) tagIds.push(id);
          }

          const characterIds: string[] = [];
          for (const c of parseStringOrArray(data.characters)) {
            const id = lookups.characterMap.get(c);
            if (id) characterIds.push(id);
          }

          // Create catalog entry
          const entry = await tx.catalogEntry.create({
            data: {
              title: data.name,
              barcode: data.sourceKey ? null : (data.id || null),
              isbn: data.isbn || null,
              sourceKey: data.sourceKey || null,
              author: data.author || null,
              publisher: data.publisher || null,
              imprint: data.imprint || null,
              description: data.description || null,
              seriesId,
              volumeNumber,
              editionNumber,
              coverPrice: data.price ? new Prisma.Decimal(data.price) : null,
              publishYear: year,
              publishMonth: month,
              pageCount,
              coverFileName: data.coverFile || null,
              coverImageUrl: data.coverUrl || null,
              approvalStatus: opts.defaultApprovalStatus as ApprovalStatus,
              createdById: adminId,
            },
          });

          // Link categories
          for (const categoryId of categoryIds) {
            await tx.catalogCategory.create({
              data: { catalogEntryId: entry.id, categoryId },
            });
          }

          // Link tags
          for (const tagId of tagIds) {
            await tx.catalogTag.create({
              data: { catalogEntryId: entry.id, tagId },
            });
          }

          // Link characters
          for (const characterId of characterIds) {
            await tx.catalogCharacter.create({
              data: { catalogEntryId: entry.id, characterId },
            });
          }

          created++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ row: index, externalId: data.sourceKey || data.id || data.name, message });
        }
      }
    });
  }

  onProgress?.({
    phase: 'complete',
    current: validRows.length,
    total: validRows.length,
    message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`,
  });

  return {
    total: rows.length,
    created,
    skipped,
    updated,
    errors,
    duplicates: duplicateMatches,
    seriesCreated: lookups.seriesCreated,
    categoriesCreated: lookups.categoriesCreated,
    tagsCreated: lookups.tagsCreated,
    charactersCreated: lookups.charactersCreated,
    durationMs: Date.now() - startTime,
  };
}
