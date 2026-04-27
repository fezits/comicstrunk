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
});
export type CoverScanCandidate = z.infer<typeof coverScanCandidateSchema>;

export const coverScanSearchResponseSchema = z.object({
  candidates: z.array(coverScanCandidateSchema),
  scanLogId: z.string(),
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
});
export type CoverScanRecognizeInput = z.infer<typeof coverScanRecognizeSchema>;

// Response reaproveita o mesmo formato do /search (candidatos + scanLogId)
export type CoverScanRecognizeResponse = CoverScanSearchResponse;

// === Daily limit constant ===

export const COVER_SCAN_DAILY_LIMIT_DEFAULT = 30;
