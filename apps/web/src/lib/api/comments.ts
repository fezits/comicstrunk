import apiClient from './client';

// === Types ===

export interface CommentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  userId: string;
  catalogEntryId: string;
  parentId: string | null;
  content: string;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
  isLiked: boolean;
  replies?: Comment[];
}

export interface CommentsResponse {
  data: Comment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCommentData {
  catalogEntryId: string;
  parentId?: string;
  content: string;
}

export interface UpdateCommentData {
  content: string;
}

export interface ToggleLikeResponse {
  liked: boolean;
  likesCount: number;
}

// === API Calls ===

export async function createComment(data: CreateCommentData): Promise<Comment> {
  const response = await apiClient.post('/comments', data);
  return response.data.data;
}

export async function updateComment(id: string, data: UpdateCommentData): Promise<Comment> {
  const response = await apiClient.put(`/comments/${id}`, data);
  return response.data.data;
}

export async function deleteComment(id: string): Promise<void> {
  await apiClient.delete(`/comments/${id}`);
}

export async function getCatalogComments(
  catalogEntryId: string,
  params?: { page?: number; limit?: number },
): Promise<CommentsResponse> {
  const query: Record<string, number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get(`/comments/catalog/${catalogEntryId}`, { params: query });
  return response.data;
}

export async function toggleCommentLike(commentId: string): Promise<ToggleLikeResponse> {
  const response = await apiClient.post(`/comments/${commentId}/like`);
  return response.data.data;
}
