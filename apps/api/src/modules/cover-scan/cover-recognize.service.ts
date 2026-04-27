import { prisma } from '../../shared/lib/prisma';
import { recognizeCoverImage, type RecognizedCover } from '../../shared/lib/cloudflare-ai';
import { localCoverUrl } from '../../shared/lib/cloudinary';
import { TooManyRequestsError } from '../../shared/utils/api-error';
import {
  COVER_SCAN_DAILY_LIMIT_DEFAULT,
  type CoverScanRecognizeInput,
  type CoverScanRecognizeResponse,
  type CoverScanCandidate,
} from '@comicstrunk/contracts';
import type { Prisma } from '@prisma/client';

const TOP_N = 8;

// === Token utils (mesmo padrao do cover-scan.service.ts) ===

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function pickSearchableTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .map(normalizeToken)
        .filter((t) => t.length >= 3)
        .slice(0, 12),
    ),
  );
}

function resolveCoverUrl(
  coverImageUrl: string | null,
  coverFileName: string | null,
): string | null {
  if (coverFileName) return localCoverUrl(coverFileName);
  if (coverImageUrl?.includes('/uploads/')) {
    const filename = coverImageUrl.split('/').pop();
    if (filename) return localCoverUrl(filename);
  }
  return coverImageUrl;
}

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

// === Daily limit (mesmo padrao do cover-scan.service.ts) ===

function getDailyLimit(): number {
  const raw = process.env.COVER_SCAN_DAILY_LIMIT;
  if (!raw) return COVER_SCAN_DAILY_LIMIT_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : COVER_SCAN_DAILY_LIMIT_DEFAULT;
}

async function assertWithinDailyLimit(userId: string): Promise<void> {
  const limit = getDailyLimit();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.coverScanLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= limit) {
    throw new TooManyRequestsError(
      `Limite de ${limit} scans por dia atingido. Tente novamente em 24h.`,
    );
  }
}

// === Build tokens enriquecidos a partir do output do VLM ===

function buildEnrichedTokens(rec: RecognizedCover): string[] {
  const sources: string[] = [];
  if (rec.title) sources.push(rec.title);
  if (rec.series && rec.series !== rec.title) sources.push(rec.series);
  for (const author of rec.authors) sources.push(author);
  if (rec.publisher) sources.push(rec.publisher);
  if (rec.ocr_text) sources.push(rec.ocr_text);

  const tokens: string[] = [];
  for (const s of sources) {
    tokens.push(...s.split(/[\s\n\r\t.,!?;:()\[\]{}'"\/]+/));
  }
  return tokens;
}

// === Main service ===

export async function recognizeFromImage(
  userId: string,
  input: CoverScanRecognizeInput,
): Promise<CoverScanRecognizeResponse> {
  await assertWithinDailyLimit(userId);

  // 1. Chamar VLM
  const recognized = await recognizeCoverImage(input.imageBase64);

  // 2. Construir tokens enriquecidos para busca textual
  const rawTokens = buildEnrichedTokens(recognized);
  const tokens = pickSearchableTokens(rawTokens);

  // 3. Buscar candidatos
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
      take: 80,
    });

    const candidateNumber = recognized.issue_number ?? undefined;

    candidates = entries
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        publisher: e.publisher,
        editionNumber: e.editionNumber,
        coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
        score: scoreCandidate(e, tokens, candidateNumber),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
  }

  // 4. Persistir log
  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: recognized.raw_response.slice(0, 5000),
      ocrTokens: tokens.join(' ').slice(0, 5000),
      candidateNumber: recognized.issue_number ?? null,
      candidatesShown: candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return { candidates, scanLogId: log.id };
}
