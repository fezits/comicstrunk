import apiClient from './client';

// === Types ===

export type HomepageSectionType = 'BANNER_CAROUSEL' | 'CATALOG_HIGHLIGHTS' | 'DEALS_OF_DAY' | 'FEATURED_COUPONS';

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string | null;
  sortOrder: number;
  items: HomepageSectionItem[];
}

export interface AdminHomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string | null;
  sortOrder: number;
  isVisible: boolean;
  contentRefs: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageSectionItem {
  id: string;
  title: string;
  // Deal fields
  type?: 'COUPON' | 'PROMOTION';
  discount?: string;
  couponCode?: string | null;
  bannerUrl?: string | null;
  expiresAt?: string | null;
  store?: { name: string; logoUrl: string | null };
  // Catalog fields
  slug?: string | null;
  coverUrl?: string | null;
  seriesName?: string | null;
  averageRating?: number;
  ratingCount?: number;
}

// === Public API Calls ===

export async function getHomepageData(): Promise<{ data: HomepageSection[] }> {
  const response = await apiClient.get('/homepage');
  return response.data;
}

// === Admin API Calls ===

export async function listSections(): Promise<AdminHomepageSection[]> {
  const response = await apiClient.get('/homepage/admin/sections');
  return response.data.data;
}

export async function createSection(data: {
  type: HomepageSectionType;
  title?: string;
  sortOrder: number;
  isVisible?: boolean;
  contentRefs?: Record<string, unknown>;
}): Promise<AdminHomepageSection> {
  const response = await apiClient.post('/homepage/admin/sections', data);
  return response.data.data;
}

export async function updateSection(
  id: string,
  data: Partial<{
    type: HomepageSectionType;
    title: string | null;
    sortOrder: number;
    isVisible: boolean;
    contentRefs: Record<string, unknown>;
  }>,
): Promise<AdminHomepageSection> {
  const response = await apiClient.put(`/homepage/admin/sections/${id}`, data);
  return response.data.data;
}

export async function deleteSection(id: string): Promise<void> {
  await apiClient.delete(`/homepage/admin/sections/${id}`);
}

export async function reorderSections(orderedIds: string[]): Promise<AdminHomepageSection[]> {
  const response = await apiClient.post('/homepage/admin/sections/reorder', { orderedIds });
  return response.data.data;
}
