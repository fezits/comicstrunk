import apiClient from './client';

// === Types ===

export interface DashboardMetrics {
  totalUsers: number;
  newUsersThisMonth: number;
  totalOrders: number;
  ordersToday: number;
  totalRevenue: number;
  revenueThisMonth: number;
  catalogSize: number;
  pendingApprovals: number;
  activeDisputes: number;
  activeSubscriptions: number;
  unreadMessages: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  collectionItemsCount: number;
  reviewsCount: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  acceptedTermsAt: string;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  collectionItemsCount: number;
  reviewsCount: number;
  disputesAsBuyerCount: number;
  disputesAsSellerCount: number;
  subscription: {
    id: string;
    planType: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    createdAt: string;
  } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Dashboard ===

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await apiClient.get('/admin/dashboard');
  return response.data.data;
}

// === Users ===

export async function listUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}): Promise<{ data: AdminUser[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.search) query.search = params.search;
  if (params?.role) query.role = params.role;

  const response = await apiClient.get('/admin/users', { params: query });
  return response.data;
}

export async function getUser(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.get(`/admin/users/${id}`);
  return response.data.data;
}

export async function updateUserRole(
  id: string,
  role: string,
): Promise<{ id: string; email: string; name: string; role: string }> {
  const response = await apiClient.put(`/admin/users/${id}/role`, { role });
  return response.data.data;
}

export async function suspendUser(
  id: string,
  reason: string,
): Promise<{ id: string; suspended: boolean; reason: string }> {
  const response = await apiClient.post(`/admin/users/${id}/suspend`, { reason });
  return response.data.data;
}

export async function unsuspendUser(
  id: string,
): Promise<{ id: string; suspended: boolean }> {
  const response = await apiClient.post(`/admin/users/${id}/unsuspend`);
  return response.data.data;
}
