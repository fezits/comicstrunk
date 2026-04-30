import apiClient from './client';
import type {
  AdminMissingCoversPage,
  AdminSearchCoversResponse,
  AdminApplyCoverInput,
  AdminApplyCoverResponse,
  AdminSeriesWithMissingCovers,
  AdminBulkFandomPreviewInput,
  AdminBulkFandomPreviewResponse,
  AdminBulkPreviewInput,
  AdminBulkPreviewResponse,
  AdminBulkApplyInput,
  AdminBulkApplyResponse,
} from '@comicstrunk/contracts';

export async function listMissingCovers(params: {
  page?: number;
  limit?: number;
  publisher?: string;
}): Promise<AdminMissingCoversPage> {
  const res = await apiClient.get('/admin/cover-management/missing', { params });
  return res.data.data;
}

export async function listMissingCoverPublishers(): Promise<
  Array<{ publisher: string; count: number }>
> {
  const res = await apiClient.get('/admin/cover-management/publishers');
  return res.data.data;
}

export async function searchCoversForEntry(
  entryId: string,
): Promise<AdminSearchCoversResponse> {
  const res = await apiClient.post(`/admin/cover-management/${entryId}/search`);
  return res.data.data;
}

export async function applyCoverToEntry(
  entryId: string,
  input: AdminApplyCoverInput,
): Promise<AdminApplyCoverResponse> {
  const res = await apiClient.post(`/admin/cover-management/${entryId}/apply`, input);
  return res.data.data;
}

// === Bulk ===

export async function listSeriesWithMissingCovers(): Promise<AdminSeriesWithMissingCovers[]> {
  const res = await apiClient.get('/admin/cover-management/series');
  return res.data.data;
}

export async function previewBulkFandomCovers(
  input: AdminBulkFandomPreviewInput,
): Promise<AdminBulkFandomPreviewResponse> {
  const res = await apiClient.post('/admin/cover-management/bulk/fandom-preview', input);
  return res.data.data;
}

export async function previewBulkSeriesCovers(
  input: AdminBulkPreviewInput,
): Promise<AdminBulkPreviewResponse> {
  const res = await apiClient.post('/admin/cover-management/bulk/preview', input);
  return res.data.data;
}

export async function bulkApplyCovers(
  input: AdminBulkApplyInput,
): Promise<AdminBulkApplyResponse> {
  const res = await apiClient.post('/admin/cover-management/bulk/apply', input);
  return res.data.data;
}
