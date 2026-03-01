import apiClient from './client';
import type { PaginationMeta } from './admin-payments';

// === Types ===

export interface CommissionByPlan {
  rate: number;
  transaction_count: number;
  total_commission: number;
  total_sales: number;
}

export interface CommissionDashboardData {
  byPlan: CommissionByPlan[];
  totals: {
    totalCommission: number;
    totalSales: number;
    transactionCount: number;
  };
  period: { start: string; end: string };
}

export interface CommissionTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  priceSnapshot: number;
  commissionRateSnapshot: number;
  commissionAmountSnapshot: number;
  sellerNetSnapshot: number;
  status: string;
  createdAt: string;
  catalogTitle: string;
}

// === Admin Commission API Calls ===

export async function getCommissionDashboard(
  periodStart: string,
  periodEnd: string,
): Promise<CommissionDashboardData> {
  const response = await apiClient.get('/commission/admin/dashboard', {
    params: { periodStart, periodEnd },
  });
  return response.data.data;
}

export async function getCommissionTransactions(params?: {
  periodStart?: string;
  periodEnd?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: CommissionTransaction[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number> = {};
  if (params?.periodStart) query.periodStart = params.periodStart;
  if (params?.periodEnd) query.periodEnd = params.periodEnd;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/commission/admin/transactions', { params: query });
  return response.data;
}
