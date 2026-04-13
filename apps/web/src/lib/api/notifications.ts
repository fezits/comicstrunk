import apiClient from './client';

// === Types ===

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPreference {
  type: string;
  enabled: boolean;
}

export interface PaginatedNotifications {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// === API Calls ===

export async function getNotifications(params: {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}): Promise<PaginatedNotifications> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.unreadOnly) {
    query.set('unreadOnly', 'true');
  }
  const response = await apiClient.get(`/notifications?${query.toString()}`);
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function getUnreadCount(): Promise<number> {
  const response = await apiClient.get('/notifications/unread-count');
  return response.data.data.count;
}

export async function getRecentNotifications(): Promise<Notification[]> {
  const response = await apiClient.get('/notifications/recent');
  return response.data.data;
}

export async function markAsRead(notificationId: string): Promise<Notification> {
  const response = await apiClient.patch(`/notifications/${notificationId}/read`);
  return response.data.data;
}

export async function markAsUnread(notificationId: string): Promise<Notification> {
  const response = await apiClient.patch(`/notifications/${notificationId}/unread`);
  return response.data.data;
}

export async function markAllAsRead(): Promise<{ count: number }> {
  const response = await apiClient.patch('/notifications/read-all');
  return response.data.data;
}

export async function getPreferences(): Promise<NotificationPreference[]> {
  const response = await apiClient.get('/notifications/preferences');
  return response.data.data;
}

export async function updatePreferences(
  preferences: Array<{ type: string; enabled: boolean }>,
): Promise<NotificationPreference[]> {
  const response = await apiClient.put('/notifications/preferences', { preferences });
  return response.data.data;
}
