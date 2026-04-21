import apiClient from './client';
import type { PaginationMeta } from './catalog';

// === Types ===

export interface PaymentData {
  id: string;
  orderId: string;
  method: string;
  providerPaymentId: string | null;
  providerStatus: string | null;
  amount: number;
  pixQrCode: string | null; // base64 QR image
  pixCopyPaste: string | null; // copia-e-cola text
  pixExpiresAt: string | null; // ISO datetime
  paidAt: string | null;
  refundedAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHistoryItem extends PaymentData {
  order: {
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  };
}

export interface PaymentHistoryResponse {
  data: PaymentHistoryItem[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function initiatePayment(orderId: string): Promise<PaymentData> {
  const response = await apiClient.post('/payments/initiate', { orderId });
  return response.data.data;
}

export async function getPaymentStatus(orderId: string): Promise<PaymentData> {
  const response = await apiClient.get(`/payments/${orderId}/status`);
  return response.data.data;
}

export async function getPaymentHistory(
  page?: number,
  limit?: number,
): Promise<PaymentHistoryResponse> {
  const params: Record<string, number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  const response = await apiClient.get('/payments/history', { params });
  return response.data;
}
