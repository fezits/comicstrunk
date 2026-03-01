import { z } from 'zod';
import { paginationSchema } from './common';

// === Catalog Review Schemas ===

export const createCatalogReviewSchema = z.object({
  catalogEntryId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    text: z.string().max(2000).optional(),
  })
  .refine((data) => data.rating !== undefined || data.text !== undefined, {
    message: 'At least one field must be provided',
  });

export const catalogReviewsQuerySchema = paginationSchema.extend({
  catalogEntryId: z.string(),
});

// === Seller Review Schemas ===

export const createSellerReviewSchema = z.object({
  sellerId: z.string(),
  orderId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

export const sellerReviewsQuerySchema = paginationSchema.extend({
  sellerId: z.string(),
});

// === Inferred Types ===

export type CreateCatalogReviewInput = z.infer<typeof createCatalogReviewSchema>;
export type CreateSellerReviewInput = z.infer<typeof createSellerReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type CatalogReviewsQuery = z.infer<typeof catalogReviewsQuerySchema>;
export type SellerReviewsQuery = z.infer<typeof sellerReviewsQuerySchema>;
