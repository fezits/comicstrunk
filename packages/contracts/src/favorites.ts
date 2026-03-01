import { z } from 'zod';
import { paginationSchema } from './common';

// === Favorite Schemas ===

export const toggleFavoriteSchema = z.object({
  catalogEntryId: z.string().min(1),
});

export const favoritesQuerySchema = paginationSchema;

// === Favorite Types ===

export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteSchema>;
export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>;
