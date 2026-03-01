import apiClient from './client';
import type { PaginationMeta } from './catalog';

// === Types ===

export interface OrderItem {
  id: string;
  orderId: string;
  collectionItemId: string;
  sellerId: string;
  priceSnapshot: number;
  commissionRateSnapshot: number;
  commissionAmountSnapshot: number;
  sellerNetSnapshot: number;
  status: string;
  trackingCode: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: string;
  shippingAddressSnapshot: unknown;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type OrderItemStatus =
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface ListOrdersParams {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export interface OrderListResponse {
  data: Order[];
  pagination: PaginationMeta;
}

// === API Calls ===

export async function createOrder(shippingAddressId: string): Promise<Order> {
  const response = await apiClient.post('/orders', { shippingAddressId });
  return response.data.data;
}

export async function listBuyerOrders(params?: ListOrdersParams): Promise<OrderListResponse> {
  const query: Record<string, string | number> = {};

  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/orders/buyer', { params: query });
  return response.data;
}

export async function listSellerOrders(params?: ListOrdersParams): Promise<OrderListResponse> {
  const query: Record<string, string | number> = {};

  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get('/orders/seller', { params: query });
  return response.data;
}

export async function getOrder(id: string): Promise<Order> {
  const response = await apiClient.get(`/orders/${id}`);
  return response.data.data;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order> {
  const response = await apiClient.get(`/orders/number/${orderNumber}`);
  return response.data.data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const response = await apiClient.patch(`/orders/${id}/cancel`);
  return response.data.data;
}

export async function updateOrderItemStatus(
  itemId: string,
  status: OrderItemStatus,
): Promise<OrderItem> {
  const response = await apiClient.patch(`/orders/items/${itemId}/status`, { status });
  return response.data.data;
}
