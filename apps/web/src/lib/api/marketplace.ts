import apiClient from './client';
import type { PaginationMeta } from './catalog';
import type { ItemCondition } from './collection';

// === Types ===

export interface MarketplaceCatalogEntry {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  coverImageUrl: string | null;
  seriesId: string | null;
  volumeNumber: number | null;
  editionNumber: number | null;
}

export interface MarketplaceSeller {
  id: string;
  name: string;
}

export interface MarketplaceListing {
  id: string;
  catalogEntry: MarketplaceCatalogEntry;
  seller: MarketplaceSeller;
  condition: ItemCondition;
  salePrice: number;
  photoUrls: string[] | null;
  createdAt: string;
}

export interface MarketplaceSearchParams {
  query?: string;
  condition?: ItemCondition;
  minPrice?: number;
  maxPrice?: number;
  publisher?: string;
  characterId?: string;
  seriesId?: string;
  sellerId?: string;
  sortBy?: 'price' | 'newest' | 'condition';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MarketplaceSearchResponse {
  data: MarketplaceListing[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function searchMarketplace(
  params: MarketplaceSearchParams,
): Promise<MarketplaceSearchResponse> {
  const query: Record<string, string | number> = {};

  if (params.query) query.query = params.query;
  if (params.condition) query.condition = params.condition;
  if (params.minPrice !== undefined) query.minPrice = params.minPrice;
  if (params.maxPrice !== undefined) query.maxPrice = params.maxPrice;
  if (params.publisher) query.publisher = params.publisher;
  if (params.characterId) query.characterId = params.characterId;
  if (params.seriesId) query.seriesId = params.seriesId;
  if (params.sellerId) query.sellerId = params.sellerId;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await apiClient.get('/marketplace', { params: query });
  return response.data;
}

export async function getMarketplaceListing(id: string): Promise<MarketplaceListing> {
  const response = await apiClient.get(`/marketplace/${id}`);
  return response.data.data;
}

export async function getSellerListings(
  sellerId: string,
  params?: Omit<MarketplaceSearchParams, 'sellerId'>,
): Promise<MarketplaceSearchResponse> {
  return searchMarketplace({ ...params, sellerId });
}

export async function getSellerProfile(
  sellerId: string,
): Promise<{ id: string; name: string; createdAt?: string }> {
  // Fetch one listing from this seller to extract their profile info
  const response = await searchMarketplace({ sellerId, limit: 1 });

  if (response.data.length > 0) {
    const listing = response.data[0];
    return {
      id: listing.seller.id,
      name: listing.seller.name,
    };
  }

  // Fallback: return minimal profile
  return { id: sellerId, name: '' };
}
