import apiClient from './client';

// === Types ===

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Character {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

export interface CatalogSeries {
  id: string;
  title: string;
  description: string | null;
  totalEditions: number;
}

export interface CatalogEntry {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  imprint: string | null;
  barcode: string | null;
  isbn: string | null;
  description: string | null;
  coverImageUrl: string | null;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  averageRating: number;
  ratingCount: number;
  volumeNumber: number | null;
  editionNumber: number | null;
  coverPrice: number | null;
  publishYear: number | null;
  publishMonth: number | null;
  pageCount: number | null;
  coverFileName: string | null;
  createdAt: string;
  series: CatalogSeries | null;
  categories: Array<{ categoryId: string; category: Category }>;
  tags: Array<{ tagId: string; tag: Tag }>;
  characters: Array<{ characterId: string; character: Character }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CatalogSearchParams {
  title?: string;
  publisher?: string;
  seriesId?: string;
  categoryIds?: string[];
  characterIds?: string[];
  tagIds?: string[];
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'title' | 'createdAt' | 'averageRating';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CatalogSearchResponse {
  data: CatalogEntry[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function searchCatalog(
  params: CatalogSearchParams,
): Promise<CatalogSearchResponse> {
  const query: Record<string, string | number> = {};

  if (params.title) query.title = params.title;
  if (params.publisher) query.publisher = params.publisher;
  if (params.seriesId) query.seriesId = params.seriesId;
  if (params.categoryIds?.length) query.categoryIds = params.categoryIds.join(',');
  if (params.characterIds?.length) query.characterIds = params.characterIds.join(',');
  if (params.tagIds?.length) query.tagIds = params.tagIds.join(',');
  if (params.yearFrom) query.yearFrom = params.yearFrom;
  if (params.yearTo) query.yearTo = params.yearTo;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await apiClient.get('/catalog', { params: query });
  return response.data;
}

export async function getCatalogEntryById(id: string): Promise<CatalogEntry> {
  const response = await apiClient.get(`/catalog/${id}`);
  return response.data.data;
}
