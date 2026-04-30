import { prisma } from '../../shared/lib/prisma';
import { getMetronIssue } from '../../shared/lib/metron';
import { searchRika, getRikaProduct } from '../../shared/lib/rika';
import { getEbayItem } from '../../shared/lib/ebay';
import { searchAmazonBR } from '../../shared/lib/amazon-br';
import { getFandomPage } from '../../shared/lib/fandom';
import { uniqueSlug } from '../../shared/utils/slug';
import { logger } from '../../shared/lib/logger';
import {
  tryDownloadCover,
  isSafeExternalUrl,
  isPrivateOrReservedIp,
} from '../../shared/lib/cover-download';
import { NotFoundError, BadRequestError } from '../../shared/utils/api-error';
import type { CoverScanImportInput, CoverScanImportResponse } from '@comicstrunk/contracts';

// Re-export para o test suite existente em src/__tests__/cover-scan/security-fix.test.ts
// que importa essas funcoes deste modulo. Implementacao real esta em
// shared/lib/cover-download.ts (extraida em 2026-04-29 para reuso pelo admin).
export { isSafeExternalUrl, isPrivateOrReservedIp, tryDownloadCover };

/**
 * Cria (ou reusa por sourceKey) um CatalogEntry a partir de uma fonte
 * externa. NAO mexe em CollectionItem — essa parte fica a cargo do
 * chamador (importExternalCandidate adiciona com increment, confirmCandidate
 * checa duplicidade primeiro).
 *
 * Sempre PENDING ao criar — admin aprova depois pra entrar no catalogo
 * publico.
 */
export async function ensureCatalogEntryFromExternal(
  userId: string,
  externalSource: 'metron' | 'rika' | 'amazon' | 'fandom' | 'ebay',
  externalRef: string,
  scanLogId: string,
): Promise<{ id: string; approvalStatus: string }> {
  const sourceKey = `${externalSource}:${externalRef}`;

  const existing = await prisma.catalogEntry.findFirst({
    where: { sourceKey },
    select: { id: true, approvalStatus: true },
  });
  if (existing) return existing;

  const data = await fetchExternalData(externalSource, externalRef);
  if (!data) {
    logger.warn('cover-import: fetchExternalData returned null', {
      source: externalSource,
      ref: externalRef,
      scanLogId,
    });
    throw new BadRequestError('Não foi possível obter dados da fonte externa.');
  }

  // Guard: title precisa ser string nao-vazia, senao slugify explode com
  // "string argument expected" e o usuario ve 500. Antes esse caso
  // acontecia silenciosamente quando o detail do Metron nao tinha campo
  // "issue".
  if (typeof data.title !== 'string' || data.title.trim().length === 0) {
    logger.warn('cover-import: fetchExternalData returned data without title', {
      source: externalSource,
      ref: externalRef,
      data,
    });
    throw new BadRequestError('Não foi possível identificar o título do gibi nessa fonte.');
  }

  let coverFileName: string | null = null;
  let coverImageUrl: string | null = data.image;
  if (data.image) {
    const fileName = await tryDownloadCover(data.image);
    if (fileName) {
      coverFileName = fileName;
      coverImageUrl = null;
    }
  }

  const slug = await uniqueSlug(data.title, 'catalogEntry');
  const created = await prisma.catalogEntry.create({
    data: {
      title: data.title,
      publisher: data.publisher,
      editionNumber: data.editionNumber,
      coverImageUrl,
      coverFileName,
      description: data.description,
      isbn: data.isbn,
      slug,
      sourceKey,
      approvalStatus: 'PENDING',
      createdById: userId,
    },
    select: { id: true, approvalStatus: true },
  });
  return created;
}

/**
 * Cria CatalogEntry PENDING a partir de candidato externo, tenta baixar capa
 * para o storage (R2/Cloudinary/local), adiciona à coleção do user.
 *
 * Idempotente: se já existir entry com mesmo sourceKey, reusa-a em vez de
 * criar duplicata.
 *
 * Atualiza coverScanLog.chosenEntryId com a entry criada/reusada.
 */
export async function importExternalCandidate(
  userId: string,
  input: CoverScanImportInput,
): Promise<CoverScanImportResponse> {
  // Validar que o scan log pertence ao user
  const scanLog = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true },
  });
  if (!scanLog || scanLog.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado.');
  }

  const entry = await ensureCatalogEntryFromExternal(
    userId,
    input.externalSource,
    input.externalRef,
    input.scanLogId,
  );

  // Adicionar à coleção do user (idempotente: incrementa qty se já existir)
  const existing = await prisma.collectionItem.findFirst({
    where: { userId, catalogEntryId: entry.id },
  });

  let collectionItemId: string;
  if (existing) {
    const updated = await prisma.collectionItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + 1 },
      select: { id: true },
    });
    collectionItemId = updated.id;
  } else {
    const created = await prisma.collectionItem.create({
      data: {
        userId,
        catalogEntryId: entry.id,
        condition: 'GOOD',
        quantity: 1,
      },
      select: { id: true },
    });
    collectionItemId = created.id;
  }

  // Registrar escolha no scan log
  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: { chosenEntryId: entry.id },
  });

  return {
    catalogEntryId: entry.id,
    collectionItemId,
    message:
      entry.approvalStatus === 'PENDING'
        ? 'Gibi adicionado à sua coleção. Aguardando aprovação para aparecer no catálogo público.'
        : 'Gibi adicionado à sua coleção.',
  };
}

interface ExternalData {
  title: string;
  publisher: string | null;
  editionNumber: number | null;
  image: string | null;
  description: string | null;
  isbn: string | null;
}

async function fetchExternalData(
  source: 'metron' | 'rika' | 'amazon' | 'fandom' | 'ebay',
  ref: string,
): Promise<ExternalData | null> {
  if (source === 'ebay') {
    const item = await getEbayItem(ref);
    if (!item) return null;
    // image vem em alta res do ebay (image.imageUrl) — tenta forcar
    // proxy s-l1600 quando disponivel
    const hiResImage = item.image?.replace(/s-l\d+\.jpg$/, 's-l1600.jpg') ?? item.image;
    return {
      title: item.title,
      publisher: null,
      editionNumber: extractEditionFromText(item.title),
      image: hiResImage,
      description: null,
      isbn: null,
    };
  }


  if (source === 'fandom') {
    // ref vem como "<wikiDomain>|<pageTitle>"
    const sep = ref.indexOf('|');
    if (sep <= 0) return null;
    const wikiDomain = ref.slice(0, sep);
    const pageTitle = ref.slice(sep + 1);
    const page = await getFandomPage(wikiDomain, pageTitle);
    if (!page) return null;
    return {
      title: page.title,
      publisher: page.publisher,
      editionNumber: extractEditionFromText(page.title),
      image: page.image,
      // Sinopse e creditos exigem parsing fragil de infobox HTML — deixa
      // vazio e admin enriquece depois se quiser.
      description: null,
      isbn: null,
    };
  }

  if (source === 'metron') {
    const id = parseInt(ref, 10);
    if (!Number.isFinite(id)) return null;
    const detail = await getMetronIssue(id);
    if (!detail) return null;

    // O endpoint /issue/{id}/ NAO tem campo "issue" formatado como o list.
    // Compomos o titulo a partir de series.name + year + number e, se
    // houver, o nome da historia (name[0]).
    const seriesName = detail.series?.name?.trim() ?? '';
    const yearBegan = detail.series?.year_began;
    const number = detail.number?.trim() ?? '';
    const storyName = Array.isArray(detail.name) ? detail.name[0]?.trim() : '';

    let title = '';
    if (seriesName) {
      title = yearBegan ? `${seriesName} (${yearBegan})` : seriesName;
      if (number) title = `${title} #${number}`;
      if (storyName) title = `${title}: ${storyName}`;
    } else if (storyName) {
      title = storyName;
    }
    title = title.trim();
    if (!title) return null;

    return {
      title,
      publisher: detail.publisher?.name?.trim() || null,
      editionNumber: number ? parseInt(number, 10) || null : null,
      image: detail.image ?? null,
      description: detail.desc?.trim() || null,
      isbn: detail.isbn?.trim() || null,
    };
  }

  if (source === 'amazon') {
    // Amazon BR: usa o ASIN como query (Amazon resolve direto pra produto)
    const list = await searchAmazonBR(ref, { limit: 3 });
    const found = list.find((p) => p.asin === ref) ?? list[0];
    if (!found) return null;
    // Amazon image URL pode ser baixa resolucao na pagina de busca; tentar
    // versao maior trocando _SL160_/_AC_UY218_ etc por _SL600_.
    const hiResImage = found.image
      ? found.image.replace(/\._[A-Z0-9_,]+_\./, '._SL600_.')
      : null;
    return {
      title: found.title,
      publisher: found.publisher,
      editionNumber: extractEditionFromText(found.title),
      image: hiResImage,
      description: null,
      isbn: null,
    };
  }

  // rika: busca pelo productId via fq=productId:<id> (full-text com `ft=`
  // nao acha produto por id numerico — so por palavras do nome).
  const found = await getRikaProduct(ref);
  if (!found) return null;
  return {
    title: found.title,
    publisher: found.publisher ?? null,
    editionNumber: found.editionNumber ?? null,
    image: found.image ?? null,
    description: null,
    isbn: null,
  };
}

function extractEditionFromText(text: string): number | null {
  const m = text.match(/(?:#|n[oº]\.?\s*|vol\.?\s*|tomo\s*|edi[çc][aã]o\s*)(\d{1,4})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 && n < 10000 ? n : null;
}
