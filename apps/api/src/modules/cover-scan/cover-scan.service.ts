import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { localCoverUrl, LOCAL_API_BASE_URL } from '../../shared/lib/cloudinary';
import {
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
} from '../../shared/utils/api-error';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanCandidate,
  CoverScanChooseInput,
} from '@comicstrunk/contracts';
import { COVER_SCAN_DAILY_LIMIT_DEFAULT } from '@comicstrunk/contracts';
import { searchExternal } from './external-search.service';

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

// === Score: 1 ponto por hit em title; 0.5 por hit em publisher/author; +5 se editionNumber bate ===

function scoreCandidate(
  entry: { title: string; publisher: string | null; author: string | null; editionNumber: number | null },
  tokens: string[],
  candidateNumber: number | undefined,
): number {
  const titleNorm = normalizeToken(entry.title);
  const publisherNorm = entry.publisher ? normalizeToken(entry.publisher) : '';
  const authorNorm = entry.author ? normalizeToken(entry.author) : '';
  let score = 0;

  for (const token of tokens) {
    if (titleNorm.includes(token)) score += 1;
    if (publisherNorm.includes(token)) score += 0.5;
    if (authorNorm.includes(token)) score += 0.5;
  }

  if (candidateNumber !== undefined && entry.editionNumber === candidateNumber) {
    score += 5;
  }

  return score;
}

// === Rate limit ===

function getDailyLimit(): number {
  const raw = process.env.COVER_SCAN_DAILY_LIMIT;
  if (!raw) return COVER_SCAN_DAILY_LIMIT_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : COVER_SCAN_DAILY_LIMIT_DEFAULT;
}

export async function assertWithinDailyLimit(userId: string, role?: string): Promise<void> {
  // Admin nao tem rate limit (testes, moderacao, ferramentas internas)
  if (role === 'ADMIN') return;

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

// === Free-text tokenizer for editable fields ===
//
// Aceita qualquer string (titulo, publisher, ocrText, extraTerms livres) e
// devolve tokens normalizados, dedup, max 30. Mais permissivo que
// pickSearchableTokens (que exige >=3 chars e limita a 12) — aqui o usuario
// pode digitar tokens curtos (ex: "5", "DC", "X-23").
function tokenizeFreeText(text: string | undefined | null): string[] {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map(normalizeToken)
        .filter((t) => t.length >= 2)
        .slice(0, 30),
    ),
  );
}

// === Main service ===
//
// Phase 4 (2026-05-03): /search agora aceita os campos editados pelo usuario
// (title, issueNumber, publisher, series, ocrText, extraTerms) + scanLogId
// obrigatorio. Atualiza o scanLog existente em vez de criar um novo;
// incrementa search_attempts e substitui candidatesShown a cada chamada.
// Sem rate limit aqui (so o /recognize consome neuron quota).

export async function searchByText(
  userId: string,
  input: CoverScanSearchInput,
  _userRole?: string,
): Promise<CoverScanSearchResponse> {
  // Verificar scanLog existe e pertence ao user
  const log = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true, searchAttempts: true },
  });
  if (!log || log.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado.');
  }

  // Pelo menos um campo textual precisa estar preenchido
  const hasAnyText =
    !!input.title?.trim() ||
    !!input.publisher?.trim() ||
    !!input.series?.trim() ||
    !!input.ocrText?.trim() ||
    !!input.extraTerms?.trim();
  if (!hasAnyText) {
    throw new BadRequestError(
      'Forneça pelo menos um termo de busca (título, editora, etc.).',
    );
  }

  const titleTokens = tokenizeFreeText(input.title);
  const seriesTokens = tokenizeFreeText(input.series);
  const publisherTokens = tokenizeFreeText(input.publisher);
  const ocrTokens = tokenizeFreeText(input.ocrText);
  const extraTokens = tokenizeFreeText(input.extraTerms);

  // MUST: titulo + serie (top 3, dedup)
  const must = Array.from(new Set([...titleTokens, ...seriesTokens])).slice(0, 3);
  // BOOST: tudo o resto, dedup contra MUST
  const boost = Array.from(
    new Set([...titleTokens.slice(3), ...publisherTokens, ...ocrTokens, ...extraTokens]),
  )
    .filter((t) => !must.includes(t))
    .slice(0, 14);

  const allTokens = [...must, ...boost];

  // Busca local + externa em paralelo (Promise.allSettled — fail open)
  let localCandidates: CoverScanCandidate[] = [];
  let externalCandidates: CoverScanCandidate[] = [];

  if (must.length > 0 || boost.length > 0) {
    const [localRes, externalRes] = await Promise.allSettled([
      (async (): Promise<CoverScanCandidate[]> => {
        const where: Prisma.CatalogEntryWhereInput = {
          approvalStatus: 'APPROVED',
          AND: must.length
            ? must.map((token) => ({
                OR: [
                  { title: { contains: token } },
                  { publisher: { contains: token } },
                  { author: { contains: token } },
                ],
              }))
            : boost.slice(0, 1).map((token) => ({
                OR: [
                  { title: { contains: token } },
                  { publisher: { contains: token } },
                  { author: { contains: token } },
                ],
              })),
        };

        if (input.issueNumber !== undefined) {
          (where.AND as Prisma.CatalogEntryWhereInput[]).push({
            editionNumber: input.issueNumber,
          });
        }

        const entries = await prisma.catalogEntry.findMany({
          where,
          select: {
            id: true,
            slug: true,
            title: true,
            publisher: true,
            author: true,
            editionNumber: true,
            coverImageUrl: true,
            coverFileName: true,
          },
          take: 80,
        });

        return entries
          .map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            publisher: e.publisher,
            editionNumber: e.editionNumber,
            coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
            score: scoreCandidate(e, allTokens, input.issueNumber),
            isExternal: false as const,
          }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_N);
      })(),

      // Fontes externas (Metron + Rika + outras configuradas) reutilizam o
      // RecognizedCover do searchExternal; mapeamos campos editados pra ele.
      searchExternal(
        {
          title: input.title ?? null,
          issue_number: input.issueNumber ?? null,
          publisher: input.publisher ?? null,
          series: input.series ?? null,
          authors: [],
          language: null,
          confidence: 'media',
          ocr_text: input.ocrText ?? '',
          dominant_colors: [],
          raw_response: '{}',
        },
        { includeEbay: false },
      ),
    ]);

    if (localRes.status === 'fulfilled') localCandidates = localRes.value;
    if (externalRes.status === 'fulfilled') externalCandidates = externalRes.value;
  }

  // Mesclar + dedup por id (mantem primeira ocorrencia, que tende a ser a local)
  const seen = new Set<string>();
  const merged: CoverScanCandidate[] = [];
  for (const c of [...localCandidates, ...externalCandidates].sort((a, b) => b.score - a.score)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }

  // Atualizar scanLog: novo candidatesShown + searchAttempts++
  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: {
      candidatesShown: merged.map((c) => ({
        id: c.id,
        title: c.title,
        score: c.score,
        isExternal: c.isExternal ?? false,
      })),
      searchAttempts: { increment: 1 },
    },
  });

  return {
    candidates: merged,
    scanLogId: input.scanLogId,
    identified: {
      title: input.title ?? null,
      issueNumber: input.issueNumber ?? null,
      publisher: input.publisher ?? null,
      series: input.series ?? null,
      ocrText: input.ocrText ?? '',
      dominantColors: [],
      confidence: null,
    },
  };
}

// === Choose: registra a escolha do usuário ===

export async function recordChoice(
  userId: string,
  input: CoverScanChooseInput,
): Promise<void> {
  const log = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true },
  });

  if (!log || log.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado.');
  }

  if (input.chosenEntryId) {
    const entry = await prisma.catalogEntry.findUnique({
      where: { id: input.chosenEntryId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundError('Gibi não encontrado no catálogo.');
    }
  }

  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: { chosenEntryId: input.chosenEntryId },
  });
}
