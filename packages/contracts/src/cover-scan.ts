import { z } from 'zod';

// === Request schema ===

export const coverScanSearchSchema = z.object({
  rawText: z.string().min(1, 'Texto OCR não pode ser vazio').max(5000),
  ocrTokens: z.array(z.string().min(1).max(50)).min(1).max(50),
  candidateNumber: z.number().int().positive().max(99999).optional(),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
});
export type CoverScanSearchInput = z.infer<typeof coverScanSearchSchema>;

// === Response candidate schema ===

export const coverScanCandidateSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  publisher: z.string().nullable(),
  editionNumber: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  score: z.number(),
  isExternal: z.boolean().optional().default(false),
  externalSource: z.enum(['metron', 'rika', 'amazon', 'fandom', 'ebay']).optional(),
  externalRef: z.string().optional(),
});
export type CoverScanCandidate = z.infer<typeof coverScanCandidateSchema>;

// Info de identificacao do VLM, exposta ao usuario para diagnostico ("Procurando por: X").
// Os campos sao opcionais porque podem nao estar presentes em todos os scans (ex: VLM
// nao identificou titulo), e a interface de busca textual da Fase 1 nao preenche.
export const coverScanIdentifiedSchema = z
  .object({
    title: z.string().nullable().optional(),
    issueNumber: z.number().int().nullable().optional(),
    publisher: z.string().nullable().optional(),
    series: z.string().nullable().optional(),
    confidence: z.enum(['alta', 'media', 'baixa']).optional(),
  })
  .optional();
export type CoverScanIdentified = z.infer<typeof coverScanIdentifiedSchema>;

export const coverScanSearchResponseSchema = z.object({
  candidates: z.array(coverScanCandidateSchema),
  scanLogId: z.string(),
  identified: coverScanIdentifiedSchema,
});
export type CoverScanSearchResponse = z.infer<typeof coverScanSearchResponseSchema>;

// === Choose endpoint (informa qual candidato o usuário escolheu) ===

export const coverScanChooseSchema = z.object({
  scanLogId: z.string().min(1),
  chosenEntryId: z.string().nullable(),
});
export type CoverScanChooseInput = z.infer<typeof coverScanChooseSchema>;

// === Recognize endpoint (Fase 2) ===

// Limite de tamanho do data URI base64. Imagens comprimidas a 800px JPEG q=80
// ficam ~50–250 KB. Multiplicador 1.37 (base64 overhead) → ~340 KB string.
// Limite de 1.4 MB cobre folgado e protege contra abuso.
const MAX_IMAGE_BASE64_LENGTH = 1_400_000;

export const coverScanRecognizeSchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Imagem em base64 muito curta')
    .max(MAX_IMAGE_BASE64_LENGTH, 'Imagem em base64 muito grande (max ~1MB)')
    .refine(
      (s) => s.startsWith('data:image/'),
      'imageBase64 deve ser uma data URI no formato data:image/<fmt>;base64,<dados>',
    ),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
  // Quando o usuario marcar "capa sem texto visivel/avariada", o backend
  // pula direto pra Google Vision Web Detection (busca visual no indice
  // do Google) em vez de tentar VLM textual primeiro. Senao, VLM eh
  // tentado e Google Vision soh entra como fallback se VLM falhar.
  forceVisualSearch: z.boolean().optional(),
});
export type CoverScanRecognizeInput = z.infer<typeof coverScanRecognizeSchema>;

// Response reaproveita o mesmo formato do /search (candidatos + scanLogId)
export type CoverScanRecognizeResponse = CoverScanSearchResponse;

// === Import endpoint (Fase 3) — cria CatalogEntry PENDING a partir de candidato externo ===

export const coverScanImportSchema = z.object({
  scanLogId: z.string().min(1),
  externalSource: z.enum(['metron', 'rika', 'amazon', 'fandom', 'ebay']),
  externalRef: z.string().min(1),
});
export type CoverScanImportInput = z.infer<typeof coverScanImportSchema>;

export interface CoverScanImportResponse {
  catalogEntryId: string;
  collectionItemId: string;
  message: string;
}

// === Confirm endpoint — usuario viu o modal e confirmou que aquele candidato eh
// o gibi correto. Backend cria entry (se externo) + adiciona a colecao + opcionalmente
// salva a foto que o usuario tirou no upload. ===

const MAX_USER_PHOTO_LENGTH = 1_400_000; // mesmo limite do imageBase64 do recognize

export const coverScanConfirmSchema = z.object({
  scanLogId: z.string().min(1),
  candidate: z.object({
    id: z.string(),
    slug: z.string().nullable().optional(),
    title: z.string().min(1),
    publisher: z.string().nullable().optional(),
    editionNumber: z.number().int().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    isExternal: z.boolean().optional(),
    externalSource: z.enum(['metron', 'rika', 'amazon', 'fandom', 'ebay']).optional(),
    externalRef: z.string().optional(),
  }),
  // foto que o usuario tirou na hora do scan; data URI base64. Salva como
  // photo do CollectionItem pra ele lembrar como veio o gibi dele.
  userPhotoBase64: z
    .string()
    .max(MAX_USER_PHOTO_LENGTH, 'Foto do usuario muito grande')
    .refine(
      (s) => !s || s.startsWith('data:image/'),
      'userPhotoBase64 deve ser data URI ou string vazia',
    )
    .optional(),
});
export type CoverScanConfirmInput = z.infer<typeof coverScanConfirmSchema>;

export interface CoverScanConfirmResponse {
  catalogEntryId: string;
  collectionItemId: string;
  alreadyInCollection: boolean;
  message: string;
}

// === Daily limit constant ===

export const COVER_SCAN_DAILY_LIMIT_DEFAULT = 30;
