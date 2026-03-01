import apiClient from './client';

// === Types ===

export type ContactCategory = 'SUGGESTION' | 'PROBLEM' | 'PARTNERSHIP' | 'OTHER';

export interface SubmitContactData {
  name: string;
  email: string;
  category: ContactCategory;
  subject: string;
  message: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  category: ContactCategory;
  subject: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

// === Public API Calls ===

export async function submitContactMessage(data: SubmitContactData): Promise<ContactMessage> {
  const response = await apiClient.post('/contact', data);
  return response.data.data;
}
