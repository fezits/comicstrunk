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

// === Inferred Types ===
export type CreateCatalogEntryInput = z.infer<typeof createCatalogEntrySchema>;
export type UpdateCatalogEntryInput = z.infer<typeof updateCatalogEntrySchema>;
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;
