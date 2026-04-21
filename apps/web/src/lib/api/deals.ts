import apiClient from './client';

// === Types ===

export type DealType = 'COUPON' | 'PROMOTION';

export interface PartnerStore {
  id: string;
  name: string;
  slug: string;
  affiliateTag: string;
  baseUrl: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  storeId: string;
  type: 'COUPON' | 'PROMOTION';
  title: string;
  description: string | null;
  couponCode: string | null;
  discount: string | null;
  bannerUrl: string | null;
  affiliateBaseUrl: string;
  categoryId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  store: PartnerStore;
  category: { id: string; name: string } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DealListResponse {
  data: Deal[];
  pagination: PaginationMeta;
}

export interface ListDealsParams {
  storeId?: string;
  categoryId?: string;
  type?: 'COUPON' | 'PROMOTION';
  sort?: string;
  page?: number;
  limit?: number;
}

// === Public API Calls ===

export async function listActiveDeals(
  params?: ListDealsParams,
): Promise<DealListResponse> {
  const query: Record<string, string | number> = {};
  if (params?.storeId) query.storeId = params.storeId;
  if (params?.categoryId) query.categoryId = params.categoryId;
  if (params?.type) query.type = params.type;
  if (params?.sort) query.sort = params.sort;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/deals', { params: query });
  return response.data;
}

export async function getDeal(id: string): Promise<Deal> {
  const response = await apiClient.get(`/deals/${id}`);
  return response.data.data;
}

export async function listStores(): Promise<PartnerStore[]> {
  const response = await apiClient.get('/deals/stores');
  return response.data.data;
}

export function getClickUrl(dealId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${baseUrl}/deals/click/${dealId}`;
}

// === Admin API Calls (for 09-06) ===

export async function listAllDeals(
  params?: Record<string, unknown>,
): Promise<DealListResponse> {
  const response = await apiClient.get('/deals/admin/list', { params });
  return response.data;
}

export async function createDeal(data: Record<string, unknown>): Promise<Deal> {
  const response = await apiClient.post('/deals/admin', data);
  return response.data.data;
}

export async function updateDeal(id: string, data: Record<string, unknown>): Promise<Deal> {
  const response = await apiClient.put(`/deals/admin/${id}`, data);
  return response.data.data;
}

export async function deleteDeal(id: string): Promise<void> {
  await apiClient.delete(`/deals/admin/${id}`);
}

export async function uploadDealBanner(id: string, file: File): Promise<Deal> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post(`/deals/admin/${id}/banner`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

// === Partner Stores Admin ===

export async function listAllStores(
  params?: Record<string, unknown>,
): Promise<{ data: PartnerStore[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/deals/stores/admin/list', { params });
  return response.data;
}

export async function createStore(data: Record<string, unknown>): Promise<PartnerStore> {
  const response = await apiClient.post('/deals/stores/admin', data);
  return response.data.data;
}

export async function updateStore(
  id: string,
  data: Record<string, unknown>,
): Promise<PartnerStore> {
  const response = await apiClient.put(`/deals/stores/admin/${id}`, data);
  return response.data.data;
}

export async function deleteStore(id: string): Promise<void> {
  await apiClient.delete(`/deals/stores/admin/${id}`);
}

// === Analytics Admin ===

export interface ClickAnalytics {
  totalClicks: number;
  uniqueUsers: number;
  clicksByDeal: {
    dealId: string;
    dealTitle: string;
    storeName: string;
    categoryName: string | null;
    clicks: number;
  }[];
  clicksByStore: {
    name: string;
    clicks: number;
  }[];
  clicksByCategory: {
    name: string;
    clicks: number;
  }[];
}

export async function getClickAnalytics(
  params?: Record<string, unknown>,
): Promise<ClickAnalytics> {
  const response = await apiClient.get('/deals/admin/analytics', { params });
  return response.data.data;
}

export async function exportClicksCSV(params?: Record<string, unknown>): Promise<Blob> {
  const response = await apiClient.get('/deals/admin/analytics/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
}
