import apiClient from './client';

// === Types ===

export interface Series {
  id: string;
  title: string;
  description: string | null;
  totalEditions: number | null;
  _count?: { catalogEntries: number };
  createdAt: string;
}

export interface CatalogEdition {
  id: string;
  title: string;
  volumeNumber: number | null;
  editionNumber: number | null;
  coverImageUrl: string | null;
  author: string | null;
  publisher: string | null;
  averageRating: number;
  ratingCount: number;
}

export interface SeriesDetail extends Series {
  catalogEntries: CatalogEdition[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SeriesListResponse {
  data: Series[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function getSeries(params?: {
  title?: string;
  page?: number;
  limit?: number;
}): Promise<SeriesListResponse> {
  // Strip undefined values so Axios doesn't send "param=undefined" in query string
  const cleanParams: Record<string, string | number> = {};
  if (params?.title) cleanParams.title = params.title;
  if (params?.page != null) cleanParams.page = params.page;
  if (params?.limit != null) cleanParams.limit = params.limit;

  const response = await apiClient.get('/series', { params: cleanParams });
  return response.data;
}

export async function getSeriesById(id: string): Promise<SeriesDetail> {
  const response = await apiClient.get(`/series/${id}`);
  return response.data.data;
}
