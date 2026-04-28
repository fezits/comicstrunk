import { prisma } from '../../shared/lib/prisma';
import { searchMetronIssues, type MetronIssueSummary } from '../../shared/lib/metron';
import { searchRika, type RikaProductSummary } from '../../shared/lib/rika';
import { searchAmazonBR, type AmazonBRProductSummary } from '../../shared/lib/amazon-br';
import { searchFandom, type FandomPageSummary } from '../../shared/lib/fandom';
import { localCoverUrl } from '../../shared/lib/cloudinary';
import type { RecognizedCover } from '../../shared/lib/cloudflare-ai';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

const TOP_EXTERNAL_PER_SOURCE = 5;
const FANDOM_PER_WIKI = 3;

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

  // Estrategia: query especifica (title + series) pega a edicao exata da capa
  // (ex: "The Authority: Relentless"). Query ampla (so series) pega reedicoes
  // / linhas editoriais distintas (ex: DC Compact, Omnibus, Absolute) que tem
  // titulos de produto diferentes na Amazon/Rika mas sao da mesma serie.
  const broadQuery = buildBroadQuery(rec);
  const runBroad = broadQuery && broadQuery.toLowerCase() !== fullText.toLowerCase();

  // Metron usa `series_name`. Como pode receber tanto "Batman" sozinho
  // quanto "Batman Life After Death", tentamos a query completa primeiro
  // e (se nada vier) caimos pro titulo isolado num segundo passo abaixo.
  const metronPrimary = combineTitleAndSeries(rec) || fullText;

  const [
    metronResult,
    rikaResult,
    rikaBroadResult,
    amazonResult,
    amazonBroadResult,
    fandomResult,
    fandomBroadResult,
  ] = await Promise.allSettled([
    searchMetronIssues({
      seriesName: metronPrimary,
      number: rec.issue_number ?? undefined,
    }),
    searchRika(fullText, { limit: TOP_EXTERNAL_PER_SOURCE }),
    runBroad ? searchRika(broadQuery, { limit: TOP_EXTERNAL_PER_SOURCE }) : Promise.resolve([]),
    searchAmazonBR(fullText, { limit: TOP_EXTERNAL_PER_SOURCE }),
    runBroad
      ? searchAmazonBR(broadQuery, { limit: TOP_EXTERNAL_PER_SOURCE })
      : Promise.resolve([]),
    searchFandom(fullText, { limitPerWiki: FANDOM_PER_WIKI }),
    runBroad ? searchFandom(broadQuery, { limitPerWiki: FANDOM_PER_WIKI }) : Promise.resolve([]),
  ]);

  const metronList: MetronIssueSummary[] =
    metronResult.status === 'fulfilled' ? metronResult.value : [];

  // Junta resultados especifico + amplo, dedup pelo identificador da fonte.
  const rikaCombined = mergeUniqueBy(
    rikaResult.status === 'fulfilled' ? rikaResult.value : [],
    rikaBroadResult.status === 'fulfilled' ? rikaBroadResult.value : [],
    (p) => p.id,
  );
  const amazonCombined = mergeUniqueBy(
    amazonResult.status === 'fulfilled' ? amazonResult.value : [],
    amazonBroadResult.status === 'fulfilled' ? amazonBroadResult.value : [],
    (p) => p.asin,
  );
  const fandomCombined = mergeUniqueBy(
    fandomResult.status === 'fulfilled' ? fandomResult.value : [],
    fandomBroadResult.status === 'fulfilled' ? fandomBroadResult.value : [],
    (p) => `${p.wikiDomain}:${p.pageId}`,
  );

  const externalCandidates: CoverScanCandidate[] = [
    ...metronList.map(metronToCandidate),
    ...rikaCombined.map(rikaToCandidate),
    ...amazonCombined.map(amazonToCandidate),
    ...fandomCombined.map(fandomToCandidate),
  ];

  if (externalCandidates.length === 0) return [];

  return await dedupExternal(externalCandidates);
}

function mergeUniqueBy<T>(a: T[], b: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...a, ...b]) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function buildBroadQuery(rec: RecognizedCover): string {
  // Pega a serie (mais ampla que titulo+subtitulo). Fallback pro titulo
  // sem subtitulo (corta apos ":" ou " - ").
  const series = (rec.series ?? '').trim();
  if (series) return series;
  const title = (rec.title ?? '').trim();
  if (!title) return '';
  const colon = title.indexOf(':');
  const dash = title.indexOf(' - ');
  const cut = [colon, dash].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut !== undefined && cut > 0 ? title.slice(0, cut).trim() : title;
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

function fandomToCandidate(f: FandomPageSummary): CoverScanCandidate {
  return {
    id: `fandom:${f.wikiDomain}:${f.pageId}`,
    slug: null,
    title: f.title,
    publisher: f.publisher,
    editionNumber: extractEditionFromTitle(f.title),
    coverImageUrl: f.image,
    score: 0.5,
    isExternal: true,
    externalSource: 'fandom',
    // externalRef carrega wiki + pageTitle (URL-encoded) pra import flow.
    // Forma: "<wikiDomain>|<pageTitle>" (separador | nao colide com URLs).
    externalRef: `${f.wikiDomain}|${f.title}`,
  };
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
  // 1) Match definitivo por sourceKey: se o gibi ja foi importado de uma
  //    fonte externa (mesmo que ainda PENDING aprovacao), o sourceKey
  //    `<source>:<ref>` esta gravado no CatalogEntry. Esse match supera
  //    o fuzzy textual em precisao (eh o mesmo gibi, nao um parecido).
  if (ext.isExternal && ext.externalSource && ext.externalRef) {
    const sourceKey = `${ext.externalSource}:${ext.externalRef}`;
    const byKey = await prisma.catalogEntry.findFirst({
      where: { sourceKey },
      select: {
        id: true,
        slug: true,
        title: true,
        publisher: true,
        editionNumber: true,
        coverImageUrl: true,
        coverFileName: true,
      },
    });
    if (byKey) {
      return {
        id: byKey.id,
        slug: byKey.slug,
        title: byKey.title,
        publisher: byKey.publisher,
        editionNumber: byKey.editionNumber,
        coverImageUrl: resolveCoverUrl(byKey.coverImageUrl, byKey.coverFileName),
      };
    }
  }

  // 2) Fuzzy textual: catalogo APPROVED com match parcial de tokens.
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

  // Validacao adicional: rejeitar candidato local que NAO contem palavras
  // significativas que o externo tem. Senao volume 2 ("Tartarugas Ninja:
  // O Ultimo Ronin - Anos Perdidos") era confundido com volume 1
  // ("Tartarugas Ninja - O Ultimo Ronin") e a edicao Anos Perdidos
  // sumia nos resultados.
  const extKeywords = significantKeywords(title);
  const verified = candidates.find((c) => {
    const localKeywords = significantKeywords(c.title);
    // Se o ext tem alguma keyword significativa que o local nao tem,
    // sao gibis distintos (volumes diferentes, sequels, etc).
    for (const k of extKeywords) {
      if (!localKeywords.has(k)) return false;
    }
    return true;
  });

  if (!verified) return null;

  return {
    id: verified.id,
    slug: verified.slug,
    title: verified.title,
    publisher: verified.publisher,
    editionNumber: verified.editionNumber,
    coverImageUrl: resolveCoverUrl(verified.coverImageUrl, verified.coverFileName),
  };
}

/**
 * Extrai palavras-chave significativas de um titulo: lowercase, sem
 * acento, >= 4 chars, sem stopwords e sem conectivos. Usado pra detectar
 * se dois titulos sao "essencialmente o mesmo gibi" ou "edicoes/volumes
 * distintos da mesma serie".
 *
 * Stopwords cobrem PT-BR + EN + boilerplate editorial comum em capa.
 */
function significantKeywords(title: string): Set<string> {
  const STOP = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'comic', 'comics',
    'edicao', 'edition', 'volume', 'edi', 'eng', 'vol', 'tomo',
    'por', 'pra', 'que', 'pelo', 'pela', 'com', 'sem', 'dos', 'das',
    'compact', 'compacto', 'deluxe', 'definitive', 'definitiva',
    'collection', 'colecao', 'omnibus', 'tpb', 'graphic', 'novel',
    'absoluta', 'absolute', 'absolut',
  ]);
  const normalized = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const words = normalized
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return new Set(words);
}

function resolveCoverUrl(coverImageUrl: string | null, coverFileName: string | null): string | null {
  if (coverFileName) return localCoverUrl(coverFileName);
  return coverImageUrl;
}
