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

// === Daily limit constant ===

export const COVER_SCAN_DAILY_LIMIT_DEFAULT = 30;
