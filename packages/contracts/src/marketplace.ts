import { z } from 'zod';

// === Marketplace Search Schemas ===

export const marketplaceSearchSchema = z.object({
  query: z.string().optional(),
  condition: z.enum(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR']).optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  publisher: z.string().optional(),
  characterId: z.string().optional(),
  seriesId: z.string().optional(),
  sellerId: z.string().optional(),
  sortBy: z.enum(['price', 'newest', 'condition']).default('newest'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// === Marketplace Listing Schema ===

export const marketplaceListingSchema = z.object({
  id: z.string(),
  catalogEntry: z.object({
    id: z.string(),
    title: z.string(),
    author: z.string().nullable(),
    publisher: z.string().nullable(),
    coverImageUrl: z.string().nullable(),
    seriesId: z.string().nullable(),
    volumeNumber: z.number().nullable(),
    editionNumber: z.number().nullable(),
  }),
  seller: z.object({
    id: z.string(),
    name: z.string(),
  }),
  condition: z.string(),
  salePrice: z.number(),
  photoUrls: z.unknown().nullable(),
  createdAt: z.string(),
});

// === Inferred Types ===

export type MarketplaceSearchInput = z.infer<typeof marketplaceSearchSchema>;
export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>;
