import apiClient from './client';

// === Types ===

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  category: 'SUGGESTION' | 'PROBLEM' | 'PARTNERSHIP' | 'OTHER';
  subject: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === Admin Contact API Calls ===

export async function listMessages(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  isResolved?: boolean;
  category?: string;
}): Promise<{ data: ContactMessage[]; pagination: PaginationMeta }> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.isRead !== undefined) query.isRead = params.isRead;
  if (params?.isResolved !== undefined) query.isResolved = params.isResolved;
  if (params?.category) query.category = params.category;

  const response = await apiClient.get('/contact/admin/list', { params: query });
  return response.data;
}

export async function getMessage(id: string): Promise<ContactMessage> {
  const response = await apiClient.get(`/contact/admin/${id}`);
  return response.data.data;
}

export async function markAsRead(id: string): Promise<ContactMessage> {
  const response = await apiClient.put(`/contact/admin/${id}/read`);
  return response.data.data;
}

export async function markAsResolved(id: string): Promise<ContactMessage> {
  const response = await apiClient.put(`/contact/admin/${id}/resolve`);
  return response.data.data;
}

export async function deleteMessage(id: string): Promise<void> {
  await apiClient.delete(`/contact/admin/${id}`);
}
