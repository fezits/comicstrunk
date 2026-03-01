import apiClient from './client';

// === Types ===

export interface PendingPaymentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  buyer: { name: string; email: string };
  payments: Array<{
    id: string;
    method: string;
    providerStatus: string | null;
    amount: number;
    pixExpiresAt: string | null;
    createdAt: string;
  }>;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  method: string;
  providerPaymentId: string | null;
  providerStatus: string | null;
  amount: number;
  paidAt: string | null;
  refundedAmount: number | null;
  createdAt: string;
  order: {
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    buyer?: { name: string; email: string };
  };
}

export interface AdminBankAccount {
  id: string;
  bankName: string;
  branchNumber: string;
  accountNumber: string;
  cpf: string;
  holderName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  isPrimary: boolean;
  createdAt: string;
  user: { name: string; email: string };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Admin Payment API Calls ===

export async function getAdminPendingPayments(
  page: number = 1,
  limit: number = 20,
): Promise<{ data: PendingPaymentOrder[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/payments/admin/pending', {
    params: { page, limit },
  });
  return response.data;
}

export async function getAdminAllPayments(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: AdminPayment[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/payments/admin/list', { params: query });
  return response.data;
}

export async function adminApprovePayment(orderId: string): Promise<void> {
  await apiClient.post('/payments/admin/approve', { orderId });
}

export async function adminRejectPayment(orderId: string): Promise<void> {
  await apiClient.post('/payments/admin/reject', { orderId });
}

export async function adminRefundPayment(
  paymentId: string,
  amount?: number,
): Promise<void> {
  await apiClient.post(`/payments/${paymentId}/refund`, amount ? { amount } : {});
}

// === Admin Banking API Calls ===

export async function getAdminBankAccounts(params?: {
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: AdminBankAccount[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.userId) query.userId = params.userId;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/banking/admin/list', { params: query });
  return response.data;
}
