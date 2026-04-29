import { z } from 'zod';

// === Listagem de capas faltantes ===

export const adminListMissingCoversSchema = z.object({
  publisher: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
});
export type AdminListMissingCoversInput = z.infer<typeof adminListMissingCoversSchema>;

export interface AdminMissingCoverEntry {
  id: string;
  slug: string | null;
  title: string;
  publisher: string | null;
  editionNumber: number | null;
  approvalStatus: string;
  createdAt: string;
}

export interface AdminMissingCoversPage {
  items: AdminMissingCoverEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const adminMissingCoversPublishersSchema = z.object({});

// === Busca de candidatos por entry (cascata) ===

export const adminSearchCoversSchema = z.object({});
export type AdminSearchCoversInput = z.infer<typeof adminSearchCoversSchema>;

export const ADMIN_COVER_SOURCES = ['amazon', 'rika', 'excelsior'] as const;
export type AdminCoverSource = (typeof ADMIN_COVER_SOURCES)[number];

export interface AdminCoverCandidate {
  source: AdminCoverSource;
  /** Identificador externo (asin pra Amazon, productId pra Rika, slug pra Excelsior). */
  externalRef: string;
  title: string;
  imageUrl: string; // garantido nao-nulo: candidatos sem imagem nao entram no resultado
  link: string;
  publisher: string | null;
}

export interface AdminSearchCoversResponse {
  /** Fonte que parou a cascata (primeira que retornou >= 1 candidato com imagem). */
  source: AdminCoverSource | null;
  /** Lista de fontes consultadas em ordem (debug/UX: mostrar "tentou Amazon, Rika..."). */
  triedSources: AdminCoverSource[];
  candidates: AdminCoverCandidate[];
}

// === Aplicar capa escolhida ao entry ===

export const adminApplyCoverSchema = z.object({
  imageUrl: z.string().url().max(2000),
  source: z.enum(ADMIN_COVER_SOURCES),
  externalRef: z.string().min(1).max(500).optional(),
});
export type AdminApplyCoverInput = z.infer<typeof adminApplyCoverSchema>;

export interface AdminApplyCoverResponse {
  catalogEntryId: string;
  coverFileName: string;
  coverUrl: string;
}
