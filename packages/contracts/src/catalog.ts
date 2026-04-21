import { z } from 'zod';

// === Approval Status ===
export const ApprovalStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const approvalStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);

// === Catalog Entry Schemas ===
export const createCatalogEntrySchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).trim(),
  author: z.string().max(255).trim().optional(),
  publisher: z.string().max(255).trim().optional(),
  imprint: z.string().max(255).trim().optional(),
  barcode: z.string().max(50).trim().optional(),
  isbn: z.string().max(20).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  seriesId: z.string().cuid().optional(),
  volumeNumber: z.number().int().positive().optional(),
  editionNumber: z.number().int().positive().optional(),
  coverPrice: z.number().positive().optional(),
  publishYear: z.number().int().min(1900).max(2100).optional(),
  publishMonth: z.number().int().min(1).max(12).optional(),
  pageCount: z.number().int().positive().optional(),
  coverFileName: z.string().max(255).optional(),
  categoryIds: z.array(z.string().cuid()).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  characterIds: z.array(z.string().cuid()).optional(),
});

export const updateCatalogEntrySchema = createCatalogEntrySchema.partial();

// Helper to preprocess comma-separated string into array
const commaSplitToArray = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim() !== '') {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(val)) return val;
  return undefined;
}, z.array(z.string()).optional());

export const catalogSearchSchema = z.object({
  title: z.string().optional(),
  publisher: z.string().optional(),
  seriesId: z.string().cuid().optional(),
  categoryIds: commaSplitToArray,
  characterIds: commaSplitToArray,
  tagIds: commaSplitToArray,
  yearFrom: z.coerce.number().optional(),
  yearTo: z.coerce.number().optional(),
  sortBy: z.enum(['title', 'createdAt', 'averageRating']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const approvalActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject']),
  rejectionReason: z.string().max(2000).optional(),
});

export const catalogImportRowSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional(),
  publisher: z.string().optional(),
  imprint: z.string().optional(),
  barcode: z.string().optional(),
  isbn: z.string().optional(),
  description: z.string().optional(),
});

// === JSON Import Schemas ===
const sourceKeyRegex = /^(rika|panini):[a-zA-Z0-9_-]+$/;

export const jsonImportRowSchema = z.object({
  // Identifiers (at least one recommended for deduplication)
  id: z.string().optional(),           // External ID / barcode
  isbn: z.string().optional(),         // ISBN-10 or ISBN-13
  sourceKey: z.string().optional(),    // Unique key from data source (SKU, distributor code)

  // Required
  name: z.string().min(1, 'Name is required'),

  // Metadata
  author: z.string().optional(),
  publisher: z.string().optional(),
  imprint: z.string().optional(),      // Editorial imprint (e.g., Panini Manga, Vertigo)
  description: z.string().optional(),
  volumeNumber: z.union([z.number().int().positive(), z.string()]).optional(),

  // Taxonomy (auto-created if they don't exist)
  universe: z.string().optional(),                              // Single category name
  categories: z.array(z.string()).optional(),                   // Multiple category names
  series: z.string().optional(),                                // Series title
  tags: z.union([z.array(z.string()), z.string()]).optional(),  // Tag names (array or comma-separated)
  characters: z.union([z.array(z.string()), z.string()]).optional(), // Character names

  // Pricing & physical
  price: z.number().positive().optional(),
  pubDate: z.string().optional(),      // Format: M/YYYY or YYYY or DD/MM/YYYY
  pages: z.union([z.number().int().positive(), z.string()]).optional(),

  // Cover
  coverFile: z.string().optional(),
  coverUrl: z.string().url().optional(), // Direct URL to cover image
});

export const jsonImportOptionsSchema = z.object({
  defaultApprovalStatus: z.enum(['DRAFT', 'APPROVED']).default('APPROVED'),
  skipDuplicates: z.boolean().default(true),
  batchSize: z.number().int().min(10).max(200).default(50),
  upsert: z.boolean().default(false),
  // Deduplication strategy
  deduplication: z.enum([
    'barcode',          // Match by barcode/id only (original behavior)
    'isbn',             // Match by ISBN only
    'source_key',       // Match by sourceKey only
    'any_identifier',   // Match by barcode OR isbn OR sourceKey (recommended)
    'fuzzy',            // Match by title+publisher+edition (slowest, catches more)
  ]).default('any_identifier'),
});

// === Inferred Types ===
export type CreateCatalogEntryInput = z.infer<typeof createCatalogEntrySchema>;
export type UpdateCatalogEntryInput = z.infer<typeof updateCatalogEntrySchema>;
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;
export type JsonImportRow = z.infer<typeof jsonImportRowSchema>;
export type JsonImportOptions = z.infer<typeof jsonImportOptionsSchema>;

// === Deduplication Result ===
export interface ImportDuplicateMatch {
  row: number;
  externalId: string;
  matchedBy: 'barcode' | 'isbn' | 'source_key' | 'fuzzy_title';
  existingId: string;
  existingTitle: string;
  confidence: number; // 100 for exact, 70-99 for fuzzy
}
