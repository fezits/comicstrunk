import apiClient from './client';

// === Types ===

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
}

// === API Calls ===

export async function getProfile(): Promise<UserProfile> {
  const response = await apiClient.get('/users/profile');
  return response.data.data;
}

export async function updateProfile(data: UpdateProfileInput): Promise<UserProfile> {
  const response = await apiClient.put('/users/profile', data);
  return response.data.data;
}
