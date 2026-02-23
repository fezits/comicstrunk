import apiClient from './client';
import type { Category, Tag, Character, PaginationMeta } from './catalog';

export type { Category, Tag, Character };

export interface TaxonomyListItem extends Category {
  _count: { catalogEntries: number };
}

export interface TagListItem extends Tag {
  _count: { catalogEntries: number };
}

export interface CharacterListItem extends Character {
  _count: { catalogEntries: number };
}

export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get('/categories');
  return response.data.data;
}

export async function getTags(): Promise<Tag[]> {
  const response = await apiClient.get('/tags');
  return response.data.data;
}

export async function getCharacters(
  page?: number,
  limit?: number,
): Promise<{ data: Character[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/characters', {
    params: { page, limit: limit ?? 100 },
  });
  return response.data;
}
