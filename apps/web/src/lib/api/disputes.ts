import apiClient from './client';

// === Types ===

export type DisputeStatus =
  | 'OPEN'
  | 'IN_MEDIATION'
  | 'RESOLVED_REFUND'
  | 'RESOLVED_PARTIAL_REFUND'
  | 'RESOLVED_NO_REFUND'
  | 'CANCELLED';

export type DisputeReason =
  | 'NOT_RECEIVED'
  | 'DIFFERENT_FROM_LISTING'
  | 'DAMAGED_IN_TRANSIT'
  | 'NOT_SHIPPED_ON_TIME';

export interface DisputeUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  submittedById: string;
  imageUrl: string;
  description: string | null;
  createdAt: string;
  submittedBy: {
    id: string;
    name: string;
  };
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface DisputeOrderItem {
  id: string;
  priceSnapshot: number;
  status: string;
  collectionItem?: {
    catalogEntry?: {
      id: string;
      title: string;
      coverImageUrl: string | null;
    };
    condition?: string;
  };
}

export interface DisputeOrder {
  id: string;
  orderNumber: string;
  status: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  orderItemId: string;
  buyerId: string;
  sellerId: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
  buyer: DisputeUser;
  seller: DisputeUser;
  orderItem: DisputeOrderItem;
  order: DisputeOrder;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DisputeListResponse {
  data: Dispute[];
  pagination: PaginationMeta;
}

export interface ListDisputesParams {
  status?: DisputeStatus;
  page?: number;
  limit?: number;
}

// === API Calls ===

export async function createDispute(data: {
  orderItemId: string;
  reason: DisputeReason;
  description: string;
}): Promise<Dispute> {
  const response = await apiClient.post('/disputes', data);
  return response.data.data;
}

export async function getDispute(id: string): Promise<Dispute> {
  const response = await apiClient.get(`/disputes/${id}`);
  return response.data.data;
}

export async function listBuyerDisputes(
  params?: ListDisputesParams,
): Promise<DisputeListResponse> {
  const query: Record<string, string | number> = {};
  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/disputes/my/buyer', { params: query });
  return response.data;
}

export async function listSellerDisputes(
  params?: ListDisputesParams,
): Promise<DisputeListResponse> {
  const query: Record<string, string | number> = {};
  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/disputes/my/seller', { params: query });
  return response.data;
}

export async function respondToDispute(
  id: string,
  data: { message: string },
): Promise<Dispute> {
  const response = await apiClient.post(`/disputes/${id}/respond`, data);
  return response.data.data;
}

export async function addEvidence(
  id: string,
  data: FormData,
): Promise<DisputeEvidence> {
  const response = await apiClient.post(`/disputes/${id}/evidence`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function addDisputeMessage(
  id: string,
  data: { message: string },
): Promise<DisputeMessage> {
  const response = await apiClient.post(`/disputes/${id}/messages`, data);
  return response.data.data;
}

export async function cancelDispute(id: string): Promise<Dispute> {
  const response = await apiClient.post(`/disputes/${id}/cancel`);
  return response.data.data;
}

// === Admin API Calls ===

export async function listAllDisputes(
  params?: ListDisputesParams,
): Promise<DisputeListResponse> {
  const query: Record<string, string | number> = {};
  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/disputes/admin/list', { params: query });
  return response.data;
}

export async function getDisputeStats(): Promise<{
  byStatus: Record<string, number>;
  totalDisputes: number;
  avgResolutionHours: number | null;
  totalRefundedAmount: number;
}> {
  const response = await apiClient.get('/disputes/admin/stats');
  return response.data.data;
}

export async function resolveDispute(
  id: string,
  data: { status: string; resolution: string; refundAmount?: number },
): Promise<Dispute> {
  const response = await apiClient.post(`/disputes/${id}/resolve`, data);
  return response.data.data;
}
