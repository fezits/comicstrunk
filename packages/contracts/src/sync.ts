import { z } from 'zod';

// === Sync Schemas ===

const sourceKeyRegex = /^(rika|panini):[a-zA-Z0-9_-]+$/;

export const syncCatalogItemSchema = z.object({
  sourceKey: z.string().regex(sourceKeyRegex, 'Invalid sourceKey format (expected rika:123 or panini:ABC)'),
  title: z.string().min(1).max(500).trim(),
  publisher: z.string().max(255).trim().optional().nullable(),
  coverPrice: z.number().positive().optional().nullable(),
  categories: z.array(z.string().max(100)).optional().default([]),
});

export const syncCatalogSchema = z.object({
  items: z.array(syncCatalogItemSchema).min(1).max(100),
});

export const syncCoverSchema = z.object({
  sourceKey: z.string().regex(sourceKeyRegex),
});

// === Inferred Types ===
export type SyncCatalogItem = z.infer<typeof syncCatalogItemSchema>;
export type SyncCatalogInput = z.infer<typeof syncCatalogSchema>;
export type SyncCoverInput = z.infer<typeof syncCoverSchema>;
