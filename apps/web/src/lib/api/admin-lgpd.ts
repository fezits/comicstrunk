import apiClient from './client';

// === Types ===

export type DataRequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
export type DataRequestType = 'ACCESS' | 'CORRECTION' | 'DELETION' | 'EXPORT';

export interface DataRequest {
  id: string;
  userId: string;
  type: DataRequestType;
  status: DataRequestStatus;
  description: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
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

// === Admin LGPD API Calls ===

export async function listAllRequests(params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}): Promise<{ data: DataRequest[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.status) query.status = params.status;
  if (params?.type) query.type = params.type;

  const response = await apiClient.get('/lgpd/admin/requests', { params: query });
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

export async function rejectRequest(
  id: string,
  reason: string,
): Promise<DataRequest> {
  const response = await apiClient.put(`/lgpd/admin/requests/${id}/reject`, {
    reason,
  });
  return response.data.data;
}
