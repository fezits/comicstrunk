import apiClient from './client';

// === Types ===

export type LegalDocumentType =
  | 'TERMS_OF_USE'
  | 'PRIVACY_POLICY'
  | 'SELLER_TERMS'
  | 'PAYMENT_POLICY'
  | 'RETURNS_POLICY'
  | 'SHIPPING_POLICY'
  | 'CANCELLATION_POLICY'
  | 'COOKIES_POLICY';

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  version: number;
  content: string;
  dateOfEffect: string;
  isMandatory: boolean;
  createdAt: string;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  acceptedAt: string;
  ipAddress: string;
  document?: {
    id: string;
    type: LegalDocumentType;
    version: number;
    dateOfEffect: string;
    isMandatory: boolean;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Public API Calls ===

export async function getLatestDocument(type: LegalDocumentType): Promise<LegalDocument> {
  const response = await apiClient.get(`/legal/latest/${type}`);
  return response.data.data;
}

export async function getDocumentById(id: string): Promise<LegalDocument> {
  const response = await apiClient.get(`/legal/${id}`);
  return response.data.data;
}

// === Authenticated API Calls ===

export async function acceptDocument(documentId: string): Promise<LegalAcceptance> {
  const response = await apiClient.post('/legal/accept', { documentId });
  return response.data.data;
}

export async function getPendingAcceptances(): Promise<LegalDocument[]> {
  const response = await apiClient.get('/legal/pending');
  return response.data.data;
}

export async function getMyAcceptances(): Promise<LegalAcceptance[]> {
  const response = await apiClient.get('/legal/my-acceptances');
  return response.data.data;
}

// === Admin API Calls ===

export async function listDocuments(params?: {
  page?: number;
  limit?: number;
  type?: LegalDocumentType;
}): Promise<{ data: LegalDocument[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/legal/admin/list', { params });
  return response.data;
}

export async function createDocument(data: {
  type: LegalDocumentType;
  content: string;
  dateOfEffect: string;
  isMandatory?: boolean;
}): Promise<LegalDocument> {
  const response = await apiClient.post('/legal/admin', data);
  return response.data.data;
}

export async function updateDocument(
  id: string,
  data: {
    content?: string;
    dateOfEffect?: string;
    isMandatory?: boolean;
  },
): Promise<LegalDocument> {
  const response = await apiClient.put(`/legal/admin/${id}`, data);
  return response.data.data;
}

export async function getDocumentHistory(
  type: LegalDocumentType,
): Promise<
  {
    id: string;
    type: LegalDocumentType;
    version: number;
    dateOfEffect: string;
    isMandatory: boolean;
    createdAt: string;
  }[]
> {
  const response = await apiClient.get(`/legal/admin/history/${type}`);
  return response.data.data;
}
