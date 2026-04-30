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
  imprint: string | null;
  editionNumber: number | null;
  volumeNumber: number | null;
  publishYear: number | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  barcode: string | null;
  pageCount: number | null;
  coverPrice: number | null;
  sourceKey: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
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

export const ADMIN_COVER_SOURCES = [
  'amazon',
  'rika',
  'excelsior',
  'fandom',
  'ebay',
  'metron',
] as const;
export type AdminCoverSource = (typeof ADMIN_COVER_SOURCES)[number];

export interface AdminCoverCandidate {
  source: AdminCoverSource;
  /** Identificador externo:
   *  - amazon: asin
   *  - rika: productId
   *  - excelsior: slug
   *  - fandom: "<wikiDomain>|<pageTitle>"
   *  - ebay: epid ou itemId
   *  - metron: issue id (numero como string)
   */
  externalRef: string;
  title: string;
  imageUrl: string; // garantido nao-nulo: candidatos sem imagem nao entram no resultado
  link: string;
  publisher: string | null;
}

export interface AdminSearchCoversResponse {
  /** Fonte que parou a cascata (primeira que retornou >= 1 candidato com imagem). */
  source: AdminCoverSource | null;
  /** Lista de fontes consultadas em ordem. */
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

// === Bulk por serie via Fandom ===

export const adminBulkFandomPreviewSchema = z.object({
  catalogSeriesId: z.string().min(1).max(40),
  fandomSeriesUrl: z.string().url().max(500),
});
export type AdminBulkFandomPreviewInput = z.infer<typeof adminBulkFandomPreviewSchema>;

export interface AdminBulkFandomMatch {
  entryId: string;
  entryTitle: string;
  entryEditionNumber: number | null;
  fandomPageTitle: string;
  fandomUrl: string;
  fandomCoverUrl: string | null;
}

export interface AdminBulkFandomPreviewResponse {
  catalogSeriesId: string;
  catalogSeriesTitle: string;
  fandomWikiDomain: string;
  fandomSeriesPageTitle: string;
  totalIssuesFandom: number;
  totalEntriesMissing: number;
  matched: AdminBulkFandomMatch[];
  unmatchedEntries: Array<{
    entryId: string;
    entryTitle: string;
    entryEditionNumber: number | null;
  }>;
}

export const adminBulkApplySchema = z.object({
  items: z
    .array(
      z.object({
        entryId: z.string().min(1).max(40),
        imageUrl: z.string().url().max(2000),
      }),
    )
    .min(1)
    .max(500),
});
export type AdminBulkApplyInput = z.infer<typeof adminBulkApplySchema>;

export interface AdminBulkApplyResponse {
  applied: Array<{ entryId: string; coverUrl: string }>;
  failed: Array<{ entryId: string; error: string }>;
}

export interface AdminSeriesWithMissingCovers {
  seriesId: string;
  seriesTitle: string;
  publisher: string | null;
  missingCount: number;
}
