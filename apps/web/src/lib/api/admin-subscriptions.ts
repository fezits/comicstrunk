import apiClient from './client';

// === Types ===

export interface AdminSubscription {
  id: string;
  userId: string;
  planType: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export interface PlanConfig {
  id: string;
  planType: string;
  name: string;
  price: number;
  billingInterval: string;
  collectionLimit: number;
  commissionRate: number;
  trialDays: number;
  isActive: boolean;
  stripePriceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Admin Subscription API Calls ===

export async function adminListSubscriptions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  planType?: string;
}): Promise<{ data: AdminSubscription[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.status) query.status = params.status;
  if (params?.planType) query.planType = params.planType;

  const response = await apiClient.get('/subscriptions/admin/list', { params: query });
  return response.data;
}

export async function adminActivateSubscription(input: {
  userId: string;
  planType: string;
  durationDays?: number;
}): Promise<AdminSubscription> {
  const response = await apiClient.post('/subscriptions/admin/activate', input);
  return response.data.data;
}

export async function adminListPlans(): Promise<PlanConfig[]> {
  const response = await apiClient.get('/subscriptions/admin/plans');
  return response.data.data;
}

export async function adminCreatePlan(input: {
  planType: string;
  name: string;
  price: number;
  billingInterval: string;
  collectionLimit: number;
  commissionRate: number;
  trialDays?: number;
  isActive?: boolean;
  stripePriceId?: string;
}): Promise<PlanConfig> {
  const response = await apiClient.post('/subscriptions/admin/plans', input);
  return response.data.data;
}

export async function adminUpdatePlan(
  id: string,
  input: Record<string, unknown>,
): Promise<PlanConfig> {
  const response = await apiClient.put(`/subscriptions/admin/plans/${id}`, input);
  return response.data.data;
}
