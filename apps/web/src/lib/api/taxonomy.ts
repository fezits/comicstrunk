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
  search?: string,
): Promise<{ data: Character[]; pagination: PaginationMeta }> {
  const response = await apiClient.get('/characters', {
    params: { page, limit: limit ?? 100, search: search?.trim() || undefined },
  });
  return response.data;
}

/**
 * Busca personagens por id (lote). Usado pra hidratar o picker quando ele
 * recebe ids ja selecionados — resolve nome/slug pra renderizar nos chips.
 */
export async function getCharactersByIds(ids: string[]): Promise<Character[]> {
  if (ids.length === 0) return [];
  // Endpoint nao tem batch; fazemos N gets em paralelo. Em pratica sao
  // ~5-20 personagens por entry, sem problema. Se virar gargalo, criamos
  // /characters/batch?ids=a,b,c.
  const results = await Promise.all(
    ids.map((id) => apiClient.get(`/characters/${id}`).then((r) => r.data.data).catch(() => null)),
  );
  return results.filter((c): c is Character => c !== null);
}
