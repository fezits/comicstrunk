import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { localCoverUrl, LOCAL_API_BASE_URL } from '../../shared/lib/cloudinary';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanCandidate,
} from '@comicstrunk/contracts';

const TOP_N = 8;

// === Token normalization ===

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .replace(/[^a-z0-9]+/g, '')      // strip punctuation
    .trim();
}

function pickSearchableTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .map(normalizeToken)
        .filter((t) => t.length >= 3) // descartar tokens muito curtos
        .slice(0, 12),                // limita explosão de queries
    ),
  );
}

// === Cover URL resolver ===

function resolveCoverUrl(
  coverImageUrl: string | null,
  coverFileName: string | null,
): string | null {
  if (coverFileName) return localCoverUrl(coverFileName);
  if (coverImageUrl && coverImageUrl.includes('/uploads/')) {
    const filename = coverImageUrl.split('/').pop();
    if (filename) return localCoverUrl(filename);
  }
  return coverImageUrl;
}

// === Score: 1 ponto por hit em title; 0.5 por hit em publisher; +5 se editionNumber bate ===

function scoreCandidate(
  entry: { title: string; publisher: string | null; editionNumber: number | null },
  tokens: string[],
  candidateNumber: number | undefined,
): number {
  const titleNorm = normalizeToken(entry.title);
  const publisherNorm = entry.publisher ? normalizeToken(entry.publisher) : '';
  let score = 0;

  for (const token of tokens) {
    if (titleNorm.includes(token)) score += 1;
    if (publisherNorm.includes(token)) score += 0.5;
  }

  if (candidateNumber !== undefined && entry.editionNumber === candidateNumber) {
    score += 5;
  }

  return score;
}

// === Main service ===

export async function searchByText(
  userId: string,
  input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  const tokens = pickSearchableTokens(input.ocrTokens);

  let candidates: CoverScanCandidate[] = [];

  if (tokens.length > 0) {
    const where: Prisma.CatalogEntryWhereInput = {
      approvalStatus: 'APPROVED',
      AND: tokens.map((token) => ({
        OR: [
          { title: { contains: token } },
          { publisher: { contains: token } },
        ],
      })),
    };

    const entries = await prisma.catalogEntry.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        publisher: true,
        editionNumber: true,
        coverImageUrl: true,
        coverFileName: true,
      },
      take: 80, // pega bastante e ranqueia em memória
    });

    candidates = entries
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        publisher: e.publisher,
        editionNumber: e.editionNumber,
        coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
        score: scoreCandidate(e, tokens, input.candidateNumber),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
  }

  // Persistir log
  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: input.rawText,
      ocrTokens: input.ocrTokens.join(' '),
      candidateNumber: input.candidateNumber ?? null,
      candidatesShown: candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return { candidates, scanLogId: log.id };
}

// Re-export LOCAL_API_BASE_URL so other modules that import from here can use it
export { LOCAL_API_BASE_URL };
