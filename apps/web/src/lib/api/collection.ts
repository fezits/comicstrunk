import apiClient from './client';
import type { CatalogEntry, PaginationMeta } from './catalog';

// === Types ===

export type ItemCondition = 'NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR' | 'POOR';

export interface CollectionItem {
  id: string;
  userId: string;
  catalogEntryId: string;
  quantity: number;
  pricePaid: number | null;
  condition: ItemCondition;
  notes: string | null;
  isRead: boolean;
  readAt: string | null;
  isForSale: boolean;
  salePrice: number | null;
  createdAt: string;
  updatedAt: string;
  catalogEntry: CatalogEntry;
}

export interface CollectionStats {
  totalItems: number;
  totalRead: number;
  totalUnread: number;
  totalForSale: number;
  totalValuePaid: number;
  totalValueForSale: number;
}

export interface SeriesProgressItem {
  seriesId: string;
  seriesTitle: string;
  totalEditions: number;
  collected: number;
  percentage: number;
}

export interface CollectionSearchParams {
  query?: string;
  condition?: ItemCondition;
  isRead?: boolean;
  isForSale?: boolean;
  seriesId?: string;
  sortBy?: 'title' | 'createdAt' | 'pricePaid' | 'condition';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CollectionListResponse {
  data: CollectionItem[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function getCollectionItems(
  params: CollectionSearchParams,
): Promise<CollectionListResponse> {
  const query: Record<string, string | number | boolean> = {};

  if (params.query) query.query = params.query;
  if (params.condition) query.condition = params.condition;
  if (params.isRead !== undefined) query.isRead = params.isRead;
  if (params.isForSale !== undefined) query.isForSale = params.isForSale;
  if (params.seriesId) query.seriesId = params.seriesId;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await apiClient.get('/collection', { params: query });
  return response.data;
}

export async function getCollectionItem(id: string): Promise<CollectionItem> {
  const response = await apiClient.get(`/collection/${id}`);
  return response.data.data;
}

export async function addCollectionItem(data: {
  catalogEntryId: string;
  quantity?: number;
  pricePaid?: number;
  condition?: ItemCondition;
  notes?: string;
  isRead?: boolean;
}): Promise<CollectionItem> {
  const response = await apiClient.post('/collection', data);
  return response.data.data;
}

export async function updateCollectionItem(
  id: string,
  data: {
    quantity?: number;
    pricePaid?: number | null;
    condition?: ItemCondition;
    notes?: string | null;
    isRead?: boolean;
  },
): Promise<CollectionItem> {
  const response = await apiClient.put(`/collection/${id}`, data);
  return response.data.data;
}

export async function deleteCollectionItem(id: string): Promise<void> {
  await apiClient.delete(`/collection/${id}`);
}

export async function markAsRead(id: string, isRead: boolean): Promise<CollectionItem> {
  const response = await apiClient.patch(`/collection/${id}/read`, { isRead });
  return response.data.data;
}

export async function markForSale(
  id: string,
  data: { isForSale: boolean; salePrice?: number },
): Promise<CollectionItem> {
  const response = await apiClient.patch(`/collection/${id}/sale`, data);
  return response.data.data;
}

export async function getCollectionStats(): Promise<CollectionStats> {
  const response = await apiClient.get('/collection/stats');
  return response.data.data;
}

export async function getSeriesProgress(seriesId?: string): Promise<SeriesProgressItem[]> {
  const params: Record<string, string> = {};
  if (seriesId) params.seriesId = seriesId;
  const response = await apiClient.get('/collection/series-progress', { params });
  return response.data.data;
}

export async function exportCollection(): Promise<void> {
  const response = await apiClient.get('/collection/export', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'collection-export.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function importCollection(
  file: File,
): Promise<{ imported: number; errors: Array<{ row: number; message: string }>; total: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/collection/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function getCSVTemplate(): Promise<void> {
  const response = await apiClient.get('/collection/csv-template', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'collection-template.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
