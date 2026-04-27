import { z } from 'zod';

// === Item Condition (mirrors Prisma enum) ===

export const ItemCondition = {
  NEW: 'NEW',
  VERY_GOOD: 'VERY_GOOD',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
} as const;
export type ItemCondition = (typeof ItemCondition)[keyof typeof ItemCondition];

export const itemConditionSchema = z.enum(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR']);

// === Plan Limits ===

export const COLLECTION_LIMITS = {
  FREE: 1000,
  BASIC: 5000,
  ADMIN: Infinity,
} as const;

// === Collection Item Schemas ===

export const createCollectionItemSchema = z.object({
  catalogEntryId: z.string().cuid(),
  quantity: z.number().int().positive().default(1),
  pricePaid: z.number().positive().optional(),
  condition: itemConditionSchema.default('NEW'),
  notes: z.string().max(2000).trim().optional(),
  isRead: z.boolean().default(false),
});

export const updateCollectionItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  pricePaid: z.number().positive().nullable().optional(),
  condition: itemConditionSchema.optional(),
  notes: z.string().max(2000).trim().nullable().optional(),
  readAt: z.string().datetime().nullable().optional(),
});

export const markForSaleSchema = z.object({
  isForSale: z.boolean(),
  salePrice: z.number().positive().optional(),
  shippingCost: z.number().min(0).optional(),
});

export const markAsReadSchema = z.object({
  isRead: z.boolean(),
});

export const collectionSearchSchema = z.object({
  query: z.string().optional(),
  condition: itemConditionSchema.optional(),
  isRead: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  isForSale: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  seriesId: z.string().cuid().optional(),
  duplicates: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  sortBy: z.enum(['title', 'createdAt', 'pricePaid', 'condition']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const collectionImportRowSchema = z.object({
  catalogEntryTitle: z.string().min(1, 'Catalog entry title is required'),
  quantity: z.coerce.number().int().positive().default(1),
  pricePaid: z.coerce.number().positive().optional(),
  condition: itemConditionSchema.default('NEW'),
  notes: z.string().optional(),
  isRead: z.preprocess((val) => val === 'true' || val === '1', z.boolean().default(false)),
});

// === Missing Editions Schema ===

export const missingEditionsQuerySchema = z.object({
  seriesId: z.string().cuid(),
});

// === Inferred Types ===

export type CreateCollectionItemInput = z.infer<typeof createCollectionItemSchema>;
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;
export type MarkForSaleInput = z.infer<typeof markForSaleSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type CollectionSearchInput = z.infer<typeof collectionSearchSchema>;
export type CollectionImportRow = z.infer<typeof collectionImportRowSchema>;
export type MissingEditionsQuery = z.infer<typeof missingEditionsQuerySchema>;
