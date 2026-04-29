/**
 * Servico admin: gestao de capas faltantes.
 *
 * Endpoints suportados:
 *   - listMissingCovers: paginacao + filtro por publisher
 *   - searchCoversForEntry: cascata sequencial Amazon BR -> Rika -> Excelsior
 *   - applyCoverToEntry: download via guard SSRF + R2 + update do entry
 *
 * Cascata: tentamos uma fonte por vez. Para na primeira que retorna >= 1
 * candidato COM imagem (image !== null). Decisao explicita de Fernando em
 * 2026-04-29 — performance > exaustividade. Mercado Livre proibido (API
 * fechou acesso anonimo). Guia dos Quadrinhos proibido por Fernando ate
 * autorizacao explicita.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { searchAmazonBR } from '../../shared/lib/amazon-br';
import { searchRika } from '../../shared/lib/rika';
import { searchExcelsior } from '../../shared/lib/excelsior';
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

const CASCADE_ORDER: AdminCoverSource[] = ['amazon', 'rika', 'excelsior'];
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
        editionNumber: true,
        approvalStatus: true,
        createdAt: true,
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
      editionNumber: e.editionNumber,
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
 * Lista publishers com >= 1 entry sem capa, ordenado pela quantidade. Usado
 * pelo dropdown de filtro do admin pra mostrar so o que tem volume.
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

/**
 * Constroi a query de busca a partir do entry. Mantemos curta — fontes BR
 * fazem matching literal (nao-fuzzy), entao adicionar muitas palavras zera o
 * resultado. Estrategia: title + edicao se houver. Publisher fica de fora —
 * costuma estar embedded no title (ex: "Almanaque da Magali Panini 6").
 */
function buildQueryForEntry(entry: {
  title: string;
  editionNumber: number | null;
}): string {
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

  for (const source of CASCADE_ORDER) {
    tried.push(source);
    const candidates = await runSource(source, query);
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
): Promise<AdminCoverCandidate[]> {
  try {
    if (source === 'amazon') {
      const results = await searchAmazonBR(query, { limit: CANDIDATES_PER_SOURCE });
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
    // excelsior
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
