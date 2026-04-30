/**
 * Servico admin: gestao de capas faltantes.
 *
 * Endpoints suportados:
 *   - listMissingCovers: paginacao + filtro por publisher (com detalhes ricos do entry)
 *   - searchCoversForEntry: cascata sequencial Amazon -> Rika -> Excelsior -> Fandom -> eBay -> Metron
 *   - applyCoverToEntry: download via guard SSRF + R2 + update do entry
 *
 * Cascata: tentamos uma fonte por vez. Para na primeira que retorna >= 1
 * candidato com imagem. Ordem otimizada: BR primeiro (Amazon/Rika/Excelsior)
 * cobre publishers BR; US fontes (Fandom/eBay/Metron) cobrem Marvel/DC/Image
 * legados que nao caem em BR.
 *
 * Mercado Livre proibido (API fechou acesso anonimo).
 * Guia dos Quadrinhos proibido por Fernando ate autorizacao explicita.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { searchAmazonBR } from '../../shared/lib/amazon-br';
import { searchRika } from '../../shared/lib/rika';
import { searchExcelsior } from '../../shared/lib/excelsior';
import { searchEbay } from '../../shared/lib/ebay';
import { searchMetronIssues } from '../../shared/lib/metron';
import {
  searchFandom,
  parseFandomSeriesUrl,
  listFandomSeriesIssues,
  getFandomPage,
} from '../../shared/lib/fandom';
import { tryDownloadCover } from '../../shared/lib/cover-download';
import { localCoverUrl } from '../../shared/lib/cloudinary';
import { logger } from '../../shared/lib/logger';
import { NotFoundError, BadRequestError } from '../../shared/utils/api-error';
import type {
  AdminCoverCandidate,
  AdminCoverSource,
  AdminListMissingCoversInput,
  AdminMissingCoversPage,
  AdminSearchCoversResponse,
  AdminApplyCoverInput,
  AdminApplyCoverResponse,
} from '@comicstrunk/contracts';

/**
 * Ordem default (publishers BR ou desconhecidos): foca cobertura BR
 * primeiro porque a maioria das entries do catalogo eh BR.
 */
const CASCADE_BR_FIRST: AdminCoverSource[] = [
  'amazon',
  'rika',
  'excelsior',
  'fandom',
  'ebay',
  'metron',
];

/**
 * Ordem para publishers US (DC, Marvel, Image, etc): comeca pelas fontes
 * US porque Amazon BR pra "Flash 100" volta livros de fiction; Fandom
 * tem wiki Marvel/DC com capas; Metron eh DB curado US; eBay vintage.
 */
const CASCADE_US_FIRST: AdminCoverSource[] = [
  'fandom',
  'metron',
  'ebay',
  'amazon',
  'rika',
  'excelsior',
];

/**
 * Publishers reconhecidamente US — match case-insensitive contra o
 * publisher do entry. Lista deliberadamente restrita pra evitar falsos
 * positivos (ex: "Panini Comics" tem "Comics" mas eh BR).
 */
const US_PUBLISHERS = [
  'dc comics',
  'dc',
  'marvel comics',
  'marvel',
  'image comics',
  'image',
  'dark horse',
  'dark horse comics',
  'idw',
  'idw publishing',
  'boom! studios',
  'boom!',
  'valiant',
  'valiant entertainment',
  'dynamite',
  'dynamite entertainment',
  'oni press',
  'oni',
];

function pickCascadeOrder(publisher: string | null): AdminCoverSource[] {
  if (!publisher) return CASCADE_BR_FIRST;
  const norm = publisher.trim().toLowerCase();
  return US_PUBLISHERS.includes(norm) ? CASCADE_US_FIRST : CASCADE_BR_FIRST;
}

const CANDIDATES_PER_SOURCE = 5;

// === Listagem ===

export async function listMissingCovers(
  input: AdminListMissingCoversInput,
): Promise<AdminMissingCoversPage> {
  const { page, limit, publisher } = input;
  const skip = (page - 1) * limit;

  const where: Prisma.CatalogEntryWhereInput = {
    coverImageUrl: null,
    coverFileName: null,
    approvalStatus: { in: ['APPROVED', 'PENDING'] },
    ...(publisher ? { publisher } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        publisher: true,
        imprint: true,
        editionNumber: true,
        volumeNumber: true,
        publishYear: true,
        author: true,
        description: true,
        isbn: true,
        barcode: true,
        pageCount: true,
        coverPrice: true,
        sourceKey: true,
        seriesId: true,
        approvalStatus: true,
        createdAt: true,
        series: { select: { title: true } },
      },
      orderBy: [{ publisher: 'asc' }, { title: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.catalogEntry.count({ where }),
  ]);

  return {
    items: items.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      publisher: e.publisher,
      imprint: e.imprint,
      editionNumber: e.editionNumber,
      volumeNumber: e.volumeNumber,
      publishYear: e.publishYear,
      author: e.author,
      description: e.description,
      isbn: e.isbn,
      barcode: e.barcode,
      pageCount: e.pageCount,
      coverPrice: e.coverPrice !== null ? Number(e.coverPrice) : null,
      sourceKey: e.sourceKey,
      seriesId: e.seriesId,
      seriesTitle: e.series?.title ?? null,
      approvalStatus: e.approvalStatus,
      createdAt: e.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Lista publishers com >= 1 entry sem capa, ordenado pela quantidade.
 */
export async function listMissingCoverPublishers(): Promise<
  Array<{ publisher: string; count: number }>
> {
  const rows = await prisma.catalogEntry.groupBy({
    by: ['publisher'],
    where: {
      coverImageUrl: null,
      coverFileName: null,
      approvalStatus: { in: ['APPROVED', 'PENDING'] },
    },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });
  return rows
    .filter((r): r is typeof r & { publisher: string } => r.publisher !== null)
    .map((r) => ({ publisher: r.publisher, count: r._count._all }));
}

// === Cascata de busca ===

interface EntryQueryInput {
  title: string;
  publisher: string | null;
  editionNumber: number | null;
}

/**
 * Constroi a query de busca a partir do entry. Mantemos curta — fontes BR
 * fazem matching literal (nao-fuzzy), entao adicionar muitas palavras zera
 * o resultado. Estrategia: title + edicao se houver.
 */
function buildQueryForEntry(entry: EntryQueryInput): string {
  const parts: string[] = [entry.title];
  if (entry.editionNumber !== null && !entry.title.includes(String(entry.editionNumber))) {
    parts.push(String(entry.editionNumber));
  }
  return parts.join(' ').trim();
}

export async function searchCoversForEntry(
  entryId: string,
): Promise<AdminSearchCoversResponse> {
  const entry = await prisma.catalogEntry.findUnique({
    where: { id: entryId },
    select: { id: true, title: true, publisher: true, editionNumber: true },
  });
  if (!entry) throw new NotFoundError('Catalog entry nao encontrado.');

  const query = buildQueryForEntry(entry);
  if (!query) {
    return { source: null, triedSources: [], candidates: [] };
  }

  const tried: AdminCoverSource[] = [];
  const cascadeOrder = pickCascadeOrder(entry.publisher);

  for (const source of cascadeOrder) {
    tried.push(source);
    const candidates = await runSource(source, query, entry);
    const withImage = candidates.filter((c) => c.imageUrl);
    if (withImage.length > 0) {
      logger.info('admin-covers: cascade stopped', {
        entryId,
        source,
        triedSources: tried,
        candidatesFound: withImage.length,
      });
      return { source, triedSources: tried, candidates: withImage };
    }
  }

  logger.info('admin-covers: cascade exhausted', {
    entryId,
    triedSources: tried,
  });
  return { source: null, triedSources: tried, candidates: [] };
}

async function runSource(
  source: AdminCoverSource,
  query: string,
  entry: EntryQueryInput,
): Promise<AdminCoverCandidate[]> {
  try {
    if (source === 'amazon') {
      const results = await searchAmazonBR(query, {
        limit: CANDIDATES_PER_SOURCE,
      });
      return results
        .filter((r) => r.image)
        .map((r) => ({
          source: 'amazon' as const,
          externalRef: r.asin,
          title: r.title,
          imageUrl: r.image as string,
          link: r.link,
          publisher: r.publisher,
        }));
    }
    if (source === 'rika') {
      const results = await searchRika(query, { limit: CANDIDATES_PER_SOURCE });
      return results
        .filter((r) => r.image)
        .map((r) => ({
          source: 'rika' as const,
          externalRef: r.id,
          title: r.title,
          imageUrl: r.image as string,
          link: r.url,
          publisher: r.publisher,
        }));
    }
    if (source === 'excelsior') {
      const results = await searchExcelsior(query, { limit: CANDIDATES_PER_SOURCE });
      return results
        .filter((r) => r.image)
        .map((r) => ({
          source: 'excelsior' as const,
          externalRef: r.slug,
          title: r.title,
          imageUrl: r.image as string,
          link: r.link,
          publisher: r.publisher,
        }));
    }
    if (source === 'fandom') {
      const results = await searchFandom(query, { limitPerWiki: CANDIDATES_PER_SOURCE });
      return results
        .filter((r) => r.image)
        .map((r) => ({
          source: 'fandom' as const,
          externalRef: `${r.wikiDomain}|${r.title}`,
          title: r.title,
          imageUrl: r.image as string,
          link: `https://${r.wikiDomain}/wiki/${encodeURIComponent(r.title)}`,
          publisher: r.publisher,
        }));
    }
    if (source === 'ebay') {
      const results = await searchEbay(query, { limit: CANDIDATES_PER_SOURCE });
      return results
        .filter((r) => r.image)
        .map((r) => ({
          source: 'ebay' as const,
          externalRef: r.epid ?? r.itemId,
          title: r.title,
          imageUrl: r.image as string,
          link: r.url,
          publisher: null,
        }));
    }
    // metron — usa series_name + number
    const results = await searchMetronIssues({
      seriesName: entry.title,
      number: entry.editionNumber ?? undefined,
    });
    return results
      .filter((r) => r.image)
      .map((r) => ({
        source: 'metron' as const,
        externalRef: String(r.id),
        title: r.issue,
        imageUrl: r.image as string,
        link: `https://metron.cloud/issue/${r.id}/`,
        publisher: null,
      }));
  } catch (err) {
    logger.warn('admin-covers: source failed', {
      source,
      query,
      err: (err as Error)?.message,
    });
    return [];
  }
}

// === Aplicar capa ===

export async function applyCoverToEntry(
  entryId: string,
  input: AdminApplyCoverInput,
): Promise<AdminApplyCoverResponse> {
  const entry = await prisma.catalogEntry.findUnique({
    where: { id: entryId },
    select: { id: true, coverImageUrl: true, coverFileName: true },
  });
  if (!entry) throw new NotFoundError('Catalog entry nao encontrado.');

  // tryDownloadCover ja faz: SSRF guard, size cap, sharp validation, R2 upload.
  const fileName = await tryDownloadCover(input.imageUrl);
  if (!fileName) {
    throw new BadRequestError(
      'Não foi possível baixar a imagem (URL bloqueada por segurança, formato inválido ou falha de rede).',
    );
  }

  await prisma.catalogEntry.update({
    where: { id: entryId },
    data: {
      coverFileName: fileName,
      coverImageUrl: null, // limpar caso houvesse URL externa
    },
  });

  logger.info('admin-covers: cover applied', {
    entryId,
    source: input.source,
    externalRef: input.externalRef,
    fileName,
  });

  return {
    catalogEntryId: entryId,
    coverFileName: fileName,
    coverUrl: localCoverUrl(fileName),
  };
}

// === Bulk: lista series com capas faltantes ===

export async function listSeriesWithMissingCovers(): Promise<
  Array<{
    seriesId: string;
    seriesTitle: string;
    publisher: string | null;
    missingCount: number;
  }>
> {
  const grouped = await prisma.catalogEntry.groupBy({
    by: ['seriesId'],
    where: {
      coverImageUrl: null,
      coverFileName: null,
      seriesId: { not: null },
      approvalStatus: { in: ['APPROVED', 'PENDING'] },
    },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 200,
  });

  const seriesIds = grouped
    .map((g) => g.seriesId)
    .filter((id): id is string => id !== null);
  if (seriesIds.length === 0) return [];

  const seriesRows = await prisma.series.findMany({
    where: { id: { in: seriesIds } },
    select: { id: true, title: true },
  });
  const byId = new Map(seriesRows.map((s) => [s.id, s]));

  // Series nao tem campo publisher — pega do primeiro catalog entry da serie.
  const sampleEntries = await prisma.catalogEntry.findMany({
    where: { seriesId: { in: seriesIds } },
    select: { seriesId: true, publisher: true },
    distinct: ['seriesId'],
  });
  const publisherBySeriesId = new Map(
    sampleEntries.map((e) => [e.seriesId as string, e.publisher]),
  );

  return grouped
    .filter((g) => g.seriesId && byId.has(g.seriesId))
    .map((g) => {
      const s = byId.get(g.seriesId as string)!;
      return {
        seriesId: s.id,
        seriesTitle: s.title,
        publisher: publisherBySeriesId.get(s.id) ?? null,
        missingCount: g._count._all,
      };
    });
}

// === Bulk: preview match Fandom-serie -> nossas entries ===

export interface FandomBulkMatch {
  entryId: string;
  entryTitle: string;
  entryEditionNumber: number | null;
  fandomPageTitle: string;
  fandomUrl: string;
  fandomCoverUrl: string | null; // null se a pagina Fandom nao tem capa
}

export interface FandomBulkPreview {
  catalogSeriesId: string;
  catalogSeriesTitle: string;
  fandomWikiDomain: string;
  fandomSeriesPageTitle: string;
  totalIssuesFandom: number;
  totalEntriesMissing: number;
  matched: FandomBulkMatch[];
  /** Entries do DB que nao bateram com nenhuma issue Fandom (numero ausente lah). */
  unmatchedEntries: Array<{
    entryId: string;
    entryTitle: string;
    entryEditionNumber: number | null;
  }>;
}

const FANDOM_PER_ISSUE_CONCURRENCY = 5;

/**
 * Pra dada catalogSeriesId no nosso catalogo + URL de pagina Fandom da serie:
 *   1. Lista entries da serie sem capa
 *   2. Lista issues da Fandom via API
 *   3. Match issue-by-issue por editionNumber
 *   4. Pra cada match, busca a capa da pagina Fandom (paralelo, concurrency 5)
 *   5. Retorna preview pra admin revisar antes do apply em batch.
 */
export async function previewBulkFandomCovers(
  catalogSeriesId: string,
  fandomSeriesUrl: string,
): Promise<FandomBulkPreview> {
  const series = await prisma.series.findUnique({
    where: { id: catalogSeriesId },
    select: { id: true, title: true },
  });
  if (!series) throw new NotFoundError('Série não encontrada no catálogo.');

  const parsed = parseFandomSeriesUrl(fandomSeriesUrl);
  if (!parsed) {
    throw new BadRequestError(
      'URL Fandom invalida. Use o formato https://<wiki>.fandom.com/wiki/Nome_Da_Serie',
    );
  }

  // 1. Lista issues Fandom (via MediaWiki allpages API)
  const fandomIssues = await listFandomSeriesIssues(parsed.wikiDomain, parsed.pageTitle);

  // 2. Lista entries DB sem capa da serie
  const entries = await prisma.catalogEntry.findMany({
    where: {
      seriesId: catalogSeriesId,
      coverImageUrl: null,
      coverFileName: null,
      approvalStatus: { in: ['APPROVED', 'PENDING'] },
    },
    select: { id: true, title: true, editionNumber: true },
  });

  // 3. Match por editionNumber
  const fandomByNumber = new Map(fandomIssues.map((i) => [i.issueNumber, i]));
  const matchedEntries = entries.filter(
    (e) => e.editionNumber !== null && fandomByNumber.has(e.editionNumber),
  );
  const unmatchedEntries = entries.filter(
    (e) => e.editionNumber === null || !fandomByNumber.has(e.editionNumber),
  );

  // 4. Pra cada match, busca capa via getFandomPage. Concurrency limitada.
  const matchPairs: Array<{ entry: typeof matchedEntries[0]; ref: (typeof fandomIssues)[0] }> =
    matchedEntries.map((e) => ({
      entry: e,
      ref: fandomByNumber.get(e.editionNumber as number)!,
    }));

  const matched: FandomBulkMatch[] = [];
  for (let i = 0; i < matchPairs.length; i += FANDOM_PER_ISSUE_CONCURRENCY) {
    const batch = matchPairs.slice(i, i + FANDOM_PER_ISSUE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((p) => getFandomPage(parsed.wikiDomain, p.ref.pageTitle)),
    );
    for (let j = 0; j < batch.length; j++) {
      const pair = batch[j];
      const r = results[j];
      const fandomCoverUrl = r.status === 'fulfilled' ? r.value?.image ?? null : null;
      matched.push({
        entryId: pair.entry.id,
        entryTitle: pair.entry.title,
        entryEditionNumber: pair.entry.editionNumber,
        fandomPageTitle: pair.ref.pageTitle,
        fandomUrl: pair.ref.url,
        fandomCoverUrl,
      });
    }
  }

  return {
    catalogSeriesId,
    catalogSeriesTitle: series.title,
    fandomWikiDomain: parsed.wikiDomain,
    fandomSeriesPageTitle: parsed.pageTitle,
    totalIssuesFandom: fandomIssues.length,
    totalEntriesMissing: entries.length,
    matched,
    unmatchedEntries: unmatchedEntries.map((e) => ({
      entryId: e.id,
      entryTitle: e.title,
      entryEditionNumber: e.editionNumber,
    })),
  };
}

// === Bulk: aplicar varias capas em batch ===

export interface BulkApplyItem {
  entryId: string;
  imageUrl: string;
}

export interface BulkApplyResult {
  applied: Array<{ entryId: string; coverUrl: string }>;
  failed: Array<{ entryId: string; error: string }>;
}

/**
 * Aplica varias capas em batch — sequencial pra nao martelar R2 com uploads
 * paralelos. Pra cada item: tryDownloadCover (com guards SSRF/size/sharp)
 * + update entry. Falhas individuais nao param o batch.
 */
export async function bulkApplyCovers(items: BulkApplyItem[]): Promise<BulkApplyResult> {
  const applied: BulkApplyResult['applied'] = [];
  const failed: BulkApplyResult['failed'] = [];

  for (const item of items) {
    try {
      const exists = await prisma.catalogEntry.findUnique({
        where: { id: item.entryId },
        select: { id: true },
      });
      if (!exists) {
        failed.push({ entryId: item.entryId, error: 'entry-not-found' });
        continue;
      }

      const fileName = await tryDownloadCover(item.imageUrl);
      if (!fileName) {
        failed.push({ entryId: item.entryId, error: 'download-failed' });
        continue;
      }

      await prisma.catalogEntry.update({
        where: { id: item.entryId },
        data: { coverFileName: fileName, coverImageUrl: null },
      });

      applied.push({ entryId: item.entryId, coverUrl: localCoverUrl(fileName) });
    } catch (err) {
      failed.push({
        entryId: item.entryId,
        error: (err as Error)?.message ?? 'unknown',
      });
    }
  }

  logger.info('admin-covers: bulk apply completed', {
    total: items.length,
    applied: applied.length,
    failed: failed.length,
  });

  return { applied, failed };
}
