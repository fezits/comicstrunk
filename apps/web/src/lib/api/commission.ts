import apiClient from './client';

// === Types ===

export interface CommissionPreview {
  commission: number;
  sellerNet: number;
  rate: number;
}

export interface CommissionConfig {
  id: string;
  planType: 'FREE' | 'BASIC';
  rate: number;
  minRate: number | null;
  maxRate: number | null;
  isActive: boolean;
}

export interface CreateCommissionConfigData {
  planType: 'FREE' | 'BASIC';
  rate: number;
  minRate?: number;
  maxRate?: number;
  isActive?: boolean;
}

export type UpdateCommissionConfigData = Partial<CreateCommissionConfigData>;

// === API Calls ===

export async function previewCommission(price: number): Promise<CommissionPreview> {
  const response = await apiClient.get('/commission/preview', { params: { price } });
  return response.data.data;
}

export async function listCommissionConfigs(): Promise<CommissionConfig[]> {
  const response = await apiClient.get('/commission/configs');
  return response.data.data;
}

export async function createCommissionConfig(
  data: CreateCommissionConfigData,
): Promise<CommissionConfig> {
  const response = await apiClient.post('/commission/configs', data);
  return response.data.data;
}

export async function updateCommissionConfig(
  id: string,
  data: UpdateCommissionConfigData,
): Promise<CommissionConfig> {
  const response = await apiClient.put(`/commission/configs/${id}`, data);
  return response.data.data;
}
