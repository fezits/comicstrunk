import apiClient from './client';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanChooseInput,
  CoverScanRecognizeInput,
  CoverScanRecognizeResponse,
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

export async function recognize(
  input: CoverScanRecognizeInput,
): Promise<CoverScanRecognizeResponse> {
  const { data } = await apiClient.post('/cover-scan/recognize', input);
  return data.data;
}
