import apiClient from './client';
import type { CatalogEntry, PaginationMeta } from './catalog';

// === Types ===

export interface RecentCatalogEntry {
  id: string;
  title: string;
  publisher: string | null;
  coverImageUrl: string | null;
  source: string;
  createdByName: string | null;
  createdAt: string;
}

// === Admin Catalog API ===

export async function getRecentCatalogEntries(params: {
  page?: number;
  limit?: number;
  source?: string;
  days?: number;
}): Promise<{ data: RecentCatalogEntry[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/catalog/admin/recent', { params });
  return response.data;
}

export async function getAdminCatalogList(params: {
  page?: number;
  limit?: number;
  approvalStatus?: string;
}): Promise<{ data: CatalogEntry[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/catalog/admin/list', { params });
  return response.data;
}

export async function getAdminCatalogEntry(id: string): Promise<CatalogEntry> {
  const response = await apiClient.get(`/catalog/admin/${id}`);
  return response.data.data;
}

export async function createCatalogEntry(
  data: Record<string, unknown>,
): Promise<CatalogEntry> {
  const response = await apiClient.post('/catalog', data);
  return response.data.data;
}

export async function updateCatalogEntry(
  id: string,
  data: Record<string, unknown>,
): Promise<CatalogEntry> {
  const response = await apiClient.put(`/catalog/${id}`, data);
  return response.data.data;
}

export async function deleteCatalogEntry(id: string): Promise<void> {
  await apiClient.delete(`/catalog/${id}`);
}

export async function submitForReview(id: string): Promise<CatalogEntry> {
  const response = await apiClient.patch(`/catalog/${id}/submit`);
  return response.data.data;
}

export async function approveCatalogEntry(id: string): Promise<CatalogEntry> {
  const response = await apiClient.patch(`/catalog/${id}/approve`);
  return response.data.data;
}

export async function rejectCatalogEntry(
  id: string,
  reason: string,
): Promise<CatalogEntry> {
  const response = await apiClient.patch(`/catalog/${id}/reject`, {
    rejectionReason: reason,
  });
  return response.data.data;
}

export async function uploadCoverImage(
  id: string,
  file: File,
): Promise<CatalogEntry> {
  const formData = new FormData();
  formData.append('cover', file);
  const response = await apiClient.post(`/catalog/${id}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function importCSV(
  file: File,
): Promise<{ created: number; errors: Array<{ row: number; message: string }>; total: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/catalog/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function exportCSV(): Promise<void> {
  const response = await apiClient.get('/catalog/export', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `catalogo-${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadTemplate(): Promise<void> {
  const response = await apiClient.get('/catalog/template', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'template-catalogo.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function importJSON(data: {
  rows: unknown[];
  options?: {
    defaultApprovalStatus?: 'DRAFT' | 'APPROVED';
    skipDuplicates?: boolean;
    batchSize?: number;
  };
}): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; externalId: string; message: string }>;
  seriesCreated: string[];
  categoriesCreated: string[];
  durationMs: number;
}> {
  const response = await apiClient.post('/catalog/import-json', data);
  return response.data.data;
}

// === Admin Taxonomy API ===

export async function createCategory(data: { name: string; description?: string }) {
  const response = await apiClient.post('/categories', data);
  return response.data.data;
}

export async function updateCategory(id: string, data: { name?: string; description?: string }) {
  const response = await apiClient.put(`/categories/${id}`, data);
  return response.data.data;
}

export async function deleteCategory(id: string) {
  await apiClient.delete(`/categories/${id}`);
}

export async function createTag(data: { name: string }) {
  const response = await apiClient.post('/tags', data);
  return response.data.data;
}

export async function updateTag(id: string, data: { name?: string }) {
  const response = await apiClient.put(`/tags/${id}`, data);
  return response.data.data;
}

export async function deleteTag(id: string) {
  await apiClient.delete(`/tags/${id}`);
}

export async function createCharacter(data: { name: string; description?: string }) {
  const response = await apiClient.post('/characters', data);
  return response.data.data;
}

export async function updateCharacter(id: string, data: { name?: string; description?: string }) {
  const response = await apiClient.put(`/characters/${id}`, data);
  return response.data.data;
}

export async function deleteCharacter(id: string) {
  await apiClient.delete(`/characters/${id}`);
}

export async function createSeries(data: {
  title: string;
  description?: string;
  totalEditions: number;
}) {
  const response = await apiClient.post('/series', data);
  return response.data.data;
}

export async function updateSeries(
  id: string,
  data: { title?: string; description?: string; totalEditions?: number },
) {
  const response = await apiClient.put(`/series/${id}`, data);
  return response.data.data;
}

export async function deleteSeries(id: string) {
  await apiClient.delete(`/series/${id}`);
}
