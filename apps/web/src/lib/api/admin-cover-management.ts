import apiClient from './client';
import type {
  AdminMissingCoversPage,
  AdminSearchCoversResponse,
  AdminApplyCoverInput,
  AdminApplyCoverResponse,
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
