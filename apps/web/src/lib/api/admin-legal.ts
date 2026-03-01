import apiClient from './client';

// === Types ===

export interface LegalDocument {
  id: string;
  type: string;
  version: number;
  content: string;
  isMandatory: boolean;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocumentHistory {
  id: string;
  type: string;
  version: number;
  content: string;
  isMandatory: boolean;
  effectiveDate: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Admin Legal API Calls ===

export async function listDocuments(params?: {
  page?: number;
  limit?: number;
  type?: string;
}): Promise<{ data: LegalDocument[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.type) query.type = params.type;

  const response = await apiClient.get('/legal/admin/list', { params: query });
  return response.data;
}

export async function createDocument(data: {
  type: string;
  content: string;
  isMandatory: boolean;
  effectiveDate: string;
}): Promise<LegalDocument> {
  const response = await apiClient.post('/legal/admin', data);
  return response.data.data;
}

export async function getDocumentHistory(
  type: string,
): Promise<LegalDocumentHistory[]> {
  const response = await apiClient.get(`/legal/admin/history/${type}`);
  return response.data.data;
}
