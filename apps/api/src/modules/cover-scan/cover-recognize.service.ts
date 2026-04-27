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

// === Tokens do VLM em duas categorias ===
// "must" = filtros obrigatorios (AND no WHERE). Usar pouco e seletivo.
// "boost" = tokens que contam apenas no score (sem entrar no WHERE).
// Razao: VLM as vezes acerta o titulo em ingles (ex: "Absolute Batman") mas
// o catalogo so tem em portugues ("Batman Absoluto"). Forcar AND em todos
// os tokens (titulo + autores + ocr) zera o resultado.

interface TokenBuckets {
  must: string[];
  boost: string[];
}

function buildTokenBuckets(rec: RecognizedCover): TokenBuckets {
  const splitWords = (s: string): string[] => s.split(/[\s\n\r\t.,!?;()\[\]{}'"\/]+/);

  // VLM costuma alucinar subtitulos depois de ":" ou " - ". Pegar apenas a
  // parte principal do titulo evita injetar tokens fantasmas no MUST.
  const stripSubtitle = (s: string): string => {
    const colonIdx = s.indexOf(':');
    const dashIdx = s.indexOf(' - ');
    const cut = [colonIdx, dashIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    return cut !== undefined && cut > 0 ? s.slice(0, cut) : s;
  };

  // Filtragem agressiva de stopwords curtas em ingles e portugues.
  // Sao tokens com >= 3 chars MAS muito genericos que poluem AND/score.
  const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this',
    'comic', 'comics', 'edicao', 'edition', 'volume',
    'edi', 'eng', 'vol',
    'por', 'pra', 'que', 'pelo', 'pela',
  ]);
  const isUseful = (t: string): boolean => !STOPWORDS.has(t.toLowerCase());

  // MUST: titulo principal apenas (sem subtitulo apos ":" ou " - ").
  // Pegar tokens normalizados unicos, max 3. Sinal mais confiavel do VLM.
  const titleMain = rec.title ? stripSubtitle(rec.title) : '';
  const seriesMain = rec.series && rec.series !== rec.title ? stripSubtitle(rec.series) : '';

  const mustRaw = [titleMain, seriesMain].filter(Boolean).flatMap(splitWords);
  const must = Array.from(
    new Set(
      mustRaw
        .map((t) => normalizeToken(t))
        .filter((t) => t.length >= 3 && isUseful(t))
        .slice(0, 3),
    ),
  );

  // BOOST: TUDO o que sobrou. Inclui o subtitulo descartado (pode ajudar pro
  // ranking quando bate por sorte), autores, publisher, ocr_text. Contam pro
  // score mas nao filtram.
  const boostSources: string[] = [];
  if (rec.title) boostSources.push(rec.title); // titulo completo (com subtitulo) entra como fonte de tokens extra
  if (rec.series) boostSources.push(rec.series);
  for (const author of rec.authors) boostSources.push(author);
  if (rec.publisher) boostSources.push(rec.publisher);
  if (rec.ocr_text) boostSources.push(rec.ocr_text);

  const boostRaw = boostSources.flatMap(splitWords);
  const boost = Array.from(
    new Set(
      boostRaw
        .map((t) => normalizeToken(t))
        .filter((t) => t.length >= 3 && isUseful(t))
        .slice(0, 14),
    ),
  ).filter((t) => !must.includes(t));

  return { must, boost };
}

// === Main service ===

export async function recognizeFromImage(
  userId: string,
  input: CoverScanRecognizeInput,
): Promise<CoverScanRecognizeResponse> {
  await assertWithinDailyLimit(userId);

  // 1. Chamar VLM
  const recognized = await recognizeCoverImage(input.imageBase64);

  // 2. Tokens do VLM em duas categorias
  const { must, boost } = buildTokenBuckets(recognized);
  const allScoringTokens = [...must, ...boost];

  // === Fuzzy stem para casar variantes morfologicas ===
  // Catalogo brasileiro traduz "absolute" -> "absoluta"; "deluxe" -> "deluxe";
  // "definitive" -> "definitiva". Buscar pelo prefixo de 5 chars pega ambas as
  // formas. Tokens com < 5 chars usam o token completo.
  const fuzzyStem = (t: string): string => (t.length >= 5 ? t.slice(0, 5) : t);

  // 3. Buscar candidatos
  let candidates: CoverScanCandidate[] = [];

  if (must.length > 0) {
    const filters: Prisma.CatalogEntryWhereInput[] = must.map((token) => {
      const stem = fuzzyStem(token);
      return {
        OR: [
          { title: { contains: stem } },
          { publisher: { contains: stem } },
          { author: { contains: stem } },
        ],
      };
    });

    // Numero da edicao (issue_number do VLM) entra como filtro AND adicional
    // quando VLM retornou um numero. Se VLM errar o numero, zera o resultado —
    // mas isso eh aceitavel: pra capas onde o numero esta visivel, eh um sinal
    // muito mais forte que tokens de titulo.
    if (recognized.issue_number !== null) {
      filters.push({ editionNumber: recognized.issue_number });
    }

    const where: Prisma.CatalogEntryWhereInput = {
      approvalStatus: 'APPROVED',
      AND: filters,
    };

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

    const candidateNumber = recognized.issue_number ?? undefined;

    candidates = entries
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        publisher: e.publisher,
        editionNumber: e.editionNumber,
        coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
        score: scoreCandidate(e, allScoringTokens, candidateNumber),
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
      ocrTokens: `[must] ${must.join(' ')} [boost] ${boost.join(' ')}`.slice(0, 5000),
      candidateNumber: recognized.issue_number ?? null,
      candidatesShown: candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return { candidates, scanLogId: log.id };
}
