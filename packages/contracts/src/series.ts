import { z } from 'zod';

// === Series Schemas ===
export const createSeriesSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  totalEditions: z.number().int().positive(),
});

export const updateSeriesSchema = createSeriesSchema.partial();

export const seriesSearchSchema = z.object({
  title: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// === Inferred Types ===
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
export type SeriesSearchInput = z.infer<typeof seriesSearchSchema>;
