import apiClient from './client';

// === Types ===

export interface ReviewUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Review {
  id: string;
  userId: string;
  catalogEntryId: string | null;
  sellerId: string | null;
  orderId: string | null;
  rating: number;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
}

export interface CatalogReviewsResponse {
  data: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SellerReviewsResponse {
  data: {
    reviews: Review[];
    averageRating: number;
    ratingCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CreateCatalogReviewData {
  catalogEntryId: string;
  rating: number;
  text?: string;
}

export interface CreateSellerReviewData {
  sellerId: string;
  orderId: string;
  rating: number;
  text?: string;
}

export interface UpdateReviewData {
  rating?: number;
  text?: string;
}

// === API Calls ===

export async function createCatalogReview(data: CreateCatalogReviewData): Promise<Review> {
  const response = await apiClient.post('/reviews/catalog', data);
  return response.data.data;
}

export async function createSellerReview(data: CreateSellerReviewData): Promise<Review> {
  const response = await apiClient.post('/reviews/seller', data);
  return response.data.data;
}

export async function updateReview(id: string, data: UpdateReviewData): Promise<Review> {
  const response = await apiClient.put(`/reviews/${id}`, data);
  return response.data.data;
}

export async function deleteReview(id: string): Promise<void> {
  await apiClient.delete(`/reviews/${id}`);
}

export async function getCatalogReviews(
  catalogEntryId: string,
  params?: { page?: number; limit?: number },
): Promise<CatalogReviewsResponse> {
  const query: Record<string, number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get(`/reviews/catalog/${catalogEntryId}`, { params: query });
  return response.data;
}

export async function getSellerReviews(
  sellerId: string,
  params?: { page?: number; limit?: number },
): Promise<SellerReviewsResponse> {
  const query: Record<string, number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const response = await apiClient.get(`/reviews/seller/${sellerId}`, { params: query });
  return response.data;
}

export async function getUserReviewForCatalog(catalogEntryId: string): Promise<Review | null> {
  const response = await apiClient.get(`/reviews/catalog/${catalogEntryId}/mine`);
  return response.data.data;
}
