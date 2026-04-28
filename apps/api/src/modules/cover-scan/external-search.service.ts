import { prisma } from '../../shared/lib/prisma';
import { searchMetronIssues, type MetronIssueSummary } from '../../shared/lib/metron';
import { searchRika, type RikaProductSummary } from '../../shared/lib/rika';
import { searchAmazonBR, type AmazonBRProductSummary } from '../../shared/lib/amazon-br';
import type { RecognizedCover } from '../../shared/lib/cloudflare-ai';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

const TOP_EXTERNAL_PER_SOURCE = 5;

/**
 * Busca em fontes externas em paralelo. Aplica dedup contra catalogo local:
 * candidatos externos que ja existem no catalogo viram candidatos internos
 * (com seus ids reais).
 *
 * O catalogo eh global — nao filtra por idioma nem origem. Qualquer HQ pode
 * entrar (americana, brasileira, europeia, manga). Por isso a query usa
 * TODOS os sinais que o VLM extraiu da capa (titulo + serie + numero +
 * autor) concatenados e deixa cada fonte fazer o melhor matching que puder.
 */
export async function searchExternal(rec: RecognizedCover): Promise<CoverScanCandidate[]> {
  const fullText = buildFullTextQuery(rec);
  if (!fullText.trim()) return [];

  // Metron usa `series_name`. Como pode receber tanto "Batman" sozinho
  // quanto "Batman Life After Death", tentamos a query completa primeiro
  // e (se nada vier) caimos pro titulo isolado num segundo passo abaixo.
  const metronPrimary = combineTitleAndSeries(rec) || fullText;

  const [metronResult, rikaResult, amazonResult] = await Promise.allSettled([
    searchMetronIssues({
      seriesName: metronPrimary,
      number: rec.issue_number ?? undefined,
    }),
    searchRika(fullText, { limit: TOP_EXTERNAL_PER_SOURCE }),
    searchAmazonBR(fullText, { limit: TOP_EXTERNAL_PER_SOURCE }),
  ]);

  const metronList: MetronIssueSummary[] =
    metronResult.status === 'fulfilled' ? metronResult.value : [];
  const rikaList: RikaProductSummary[] =
    rikaResult.status === 'fulfilled' ? rikaResult.value : [];
  const amazonList: AmazonBRProductSummary[] =
    amazonResult.status === 'fulfilled' ? amazonResult.value : [];

  const externalCandidates: CoverScanCandidate[] = [
    ...metronList.slice(0, TOP_EXTERNAL_PER_SOURCE).map(metronToCandidate),
    ...rikaList.slice(0, TOP_EXTERNAL_PER_SOURCE).map(rikaToCandidate),
    ...amazonList.slice(0, TOP_EXTERNAL_PER_SOURCE).map(amazonToCandidate),
  ];

  if (externalCandidates.length === 0) return [];

  return await dedupExternal(externalCandidates);
}

function combineTitleAndSeries(rec: RecognizedCover): string {
  const t = (rec.title ?? '').trim();
  const s = (rec.series ?? '').trim();
  if (!t) return s;
  if (!s) return t;
  // Se um esta contido no outro (caso "Batman" / "Batman Life After Death"),
  // pega o mais longo. Senao concatena pra somar sinal.
  const tLow = t.toLowerCase();
  const sLow = s.toLowerCase();
  if (sLow.includes(tLow)) return s;
  if (tLow.includes(sLow)) return t;
  return `${t} ${s}`;
}

function buildFullTextQuery(rec: RecognizedCover): string {
  // Junta tudo o que o VLM extraiu sem filtrar por idioma. Cada fonte de busca
  // faz seu proprio relevance ranking — se "Batman Life After Death #1 Tony
  // Daniel" der match exato, otimo; se nao, ainda assim os tokens individuais
  // ajudam a achar variantes regionais (Batman: A Vida Apos a Morte, etc).
  const parts: string[] = [];
  const combined = combineTitleAndSeries(rec);
  if (combined) parts.push(combined);
  if (rec.issue_number !== null) parts.push(`#${rec.issue_number}`);
  if (rec.authors[0]) parts.push(rec.authors[0]);
  return parts.join(' ').trim();
}

function metronToCandidate(m: MetronIssueSummary): CoverScanCandidate {
  return {
    id: `metron:${m.id}`,
    slug: null,
    title: m.issue,
    publisher: null,
    editionNumber: parseInt(m.number, 10) || null,
    coverImageUrl: m.image,
    score: 0.5,
    isExternal: true,
    externalSource: 'metron',
    externalRef: String(m.id),
  };
}

function amazonToCandidate(a: AmazonBRProductSummary): CoverScanCandidate {
  return {
    id: `amazon:${a.asin}`,
    slug: null,
    title: a.title,
    publisher: a.publisher,
    editionNumber: extractEditionFromTitle(a.title),
    coverImageUrl: a.image,
    score: 0.5,
    isExternal: true,
    externalSource: 'amazon',
    externalRef: a.asin,
  };
}

function extractEditionFromTitle(text: string): number | null {
  const m = text.match(/(?:#|n[oº]\.?\s*|vol\.?\s*|tomo\s*|edi[çc][aã]o\s*)(\d{1,4})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 && n < 10000 ? n : null;
}

function rikaToCandidate(r: RikaProductSummary): CoverScanCandidate {
  return {
    id: `rika:${r.id}`,
    slug: null,
    title: r.title,
    publisher: r.publisher,
    editionNumber: r.editionNumber,
    coverImageUrl: r.image,
    score: 0.5,
    isExternal: true,
    externalSource: 'rika',
    externalRef: r.id,
  };
}

/**
 * Para cada candidato externo, procura no catalogo local equivalente.
 * Se achar com confianca alta, substitui o externo pelo local.
 */
async function dedupExternal(externals: CoverScanCandidate[]): Promise<CoverScanCandidate[]> {
  const result: CoverScanCandidate[] = [];

  for (const ext of externals) {
    const local = await findLocalMatch(ext);
    if (local) {
      result.push({
        id: local.id,
        slug: local.slug,
        title: local.title,
        publisher: local.publisher,
        editionNumber: local.editionNumber,
        coverImageUrl: local.coverImageUrl,
        score: 1.0,
        isExternal: false,
      });
    } else {
      result.push(ext);
    }
  }

  return result;
}

interface LocalMatch {
  id: string;
  slug: string | null;
  title: string;
  publisher: string | null;
  editionNumber: number | null;
  coverImageUrl: string | null;
}

async function findLocalMatch(ext: CoverScanCandidate): Promise<LocalMatch | null> {
  const title = ext.title;
  if (!title) return null;

  const words = title
    .split(/[\s\-:]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 3);
  if (words.length === 0) return null;

  const where: Record<string, unknown> = {
    approvalStatus: 'APPROVED',
    AND: words.map((w) => ({
      OR: [
        { title: { contains: w.slice(0, 5) } },
        { author: { contains: w.slice(0, 5) } },
      ],
    })),
  };
  if (ext.editionNumber !== null) {
    where.editionNumber = ext.editionNumber;
  }

  const candidates = await prisma.catalogEntry.findMany({
    where: where as never,
    select: {
      id: true,
      slug: true,
      title: true,
      publisher: true,
      editionNumber: true,
      coverImageUrl: true,
      coverFileName: true,
    },
    take: 3,
  });

  if (candidates.length === 0) return null;

  const best = candidates[0];
  return {
    id: best.id,
    slug: best.slug,
    title: best.title,
    publisher: best.publisher,
    editionNumber: best.editionNumber,
    coverImageUrl: best.coverImageUrl,
  };
}
