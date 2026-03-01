import apiClient from './client';
import type { CatalogEntry } from './catalog';
import type { PaginationMeta } from './catalog';

// === Types ===

export interface ToggleFavoriteResponse {
  favorited: boolean;
}

export interface CheckIsFavoritedResponse {
  isFavorited: boolean;
}

export interface FavoriteItem {
  id: string;
  catalogEntryId: string;
  createdAt: string;
  catalogEntry: Pick<
    CatalogEntry,
    | 'id'
    | 'title'
    | 'author'
    | 'publisher'
    | 'coverImageUrl'
    | 'averageRating'
    | 'ratingCount'
    | 'series'
  >;
}

export interface FavoritesListResponse {
  data: FavoriteItem[];
  pagination: PaginationMeta;
}

// === API Calls ===

/**
 * Toggle favorite status on a catalog entry.
 * POST /api/v1/favorites/toggle
 */
export async function toggleFavorite(
  catalogEntryId: string,
): Promise<ToggleFavoriteResponse> {
  const response = await apiClient.post('/favorites/toggle', { catalogEntryId });
  return response.data.data;
}

/**
 * Get the current user's favorites (paginated).
 * GET /api/v1/favorites
 */
export async function getUserFavorites(params: {
  page?: number;
  limit?: number;
}): Promise<FavoritesListResponse> {
  const response = await apiClient.get('/favorites', { params });
  return response.data;
}

/**
 * Check if a specific catalog entry is favorited by the current user.
 * GET /api/v1/favorites/check/:catalogEntryId
 */
export async function checkIsFavorited(
  catalogEntryId: string,
): Promise<CheckIsFavoritedResponse> {
  const response = await apiClient.get(`/favorites/check/${catalogEntryId}`);
  return response.data.data;
}
