import apiClient from './client';

// === Types ===

export type DataRequestType = 'ACCESS' | 'CORRECTION' | 'DELETION' | 'EXPORT';
export type DataRequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';

export interface DataRequest {
  id: string;
  userId: string;
  type: DataRequestType;
  status: DataRequestStatus;
  details: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRequestWithUser extends DataRequest {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DataRequestListResponse {
  data: DataRequest[];
  pagination: PaginationMeta;
}

export interface DataRequestAdminListResponse {
  data: DataRequestWithUser[];
  pagination: PaginationMeta;
}

// === User API Calls ===

export async function createDataRequest(data: {
  type: DataRequestType;
  details?: string;
}): Promise<DataRequest> {
  const response = await apiClient.post('/lgpd/requests', data);
  return response.data.data;
}

export async function listMyRequests(
  params?: { page?: number; limit?: number },
): Promise<DataRequestListResponse> {
  const response = await apiClient.get('/lgpd/requests', { params });
  return response.data;
}

export async function exportMyData(): Promise<Blob> {
  const response = await apiClient.get('/lgpd/export', {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteMyAccount(): Promise<DataRequest> {
  const response = await apiClient.post('/lgpd/delete-account');
  return response.data.data;
}

// === Admin API Calls ===

export async function listAllRequests(
  params?: { status?: DataRequestStatus; type?: DataRequestType; page?: number; limit?: number },
): Promise<DataRequestAdminListResponse> {
  const response = await apiClient.get('/lgpd/admin/requests', { params });
  return response.data;
}

export async function processRequest(id: string): Promise<DataRequest> {
  const response = await apiClient.put(`/lgpd/admin/requests/${id}/process`);
  return response.data.data;
}

export async function completeRequest(id: string): Promise<DataRequest> {
  const response = await apiClient.put(`/lgpd/admin/requests/${id}/complete`);
  return response.data.data;
}

export async function rejectRequest(id: string, reason: string): Promise<DataRequest> {
  const response = await apiClient.put(`/lgpd/admin/requests/${id}/reject`, { reason });
  return response.data.data;
}
