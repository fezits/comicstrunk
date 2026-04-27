import apiClient from './client';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanChooseInput,
} from '@comicstrunk/contracts';

export async function searchByText(
  input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  const { data } = await apiClient.post('/cover-scan/search', input);
  return data.data;
}

export async function recordChoice(input: CoverScanChooseInput): Promise<void> {
  await apiClient.post('/cover-scan/choose', input);
}
