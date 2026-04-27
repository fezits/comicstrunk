import { prisma } from '../../shared/lib/prisma';
import { getMetronIssue } from '../../shared/lib/metron';
import { searchRika } from '../../shared/lib/rika';
import { uniqueSlug } from '../../shared/utils/slug';
import { uploadImage } from '../../shared/lib/cloudinary';
import { NotFoundError, BadRequestError } from '../../shared/utils/api-error';
import type { CoverScanImportInput, CoverScanImportResponse } from '@comicstrunk/contracts';

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
    throw new NotFoundError('Scan log nao encontrado');
  }

  const sourceKey = `${input.externalSource}:${input.externalRef}`;

  // Idempotencia: já existe entry com este sourceKey?
  let entry = await prisma.catalogEntry.findFirst({
    where: { sourceKey },
    select: { id: true, approvalStatus: true },
  });

  if (!entry) {
    const data = await fetchExternalData(input.externalSource, input.externalRef);
    if (!data) {
      throw new BadRequestError('Nao foi possivel obter dados da fonte externa');
    }

    // Baixar capa pro storage (best effort — falha silenciosa)
    let coverFileName: string | null = null;
    let coverImageUrl: string | null = data.image;

    if (data.image) {
      const fileName = await tryDownloadCover(data.image);
      if (fileName) {
        coverFileName = fileName;
        coverImageUrl = null; // usa coverFileName; resolveCoverUrl() monta a URL
      }
    }

    // Slug único baseado no título da entry
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
    entry = created;
  }

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
        ? 'Adicionado a sua colecao. Aguardando aprovacao para aparecer no catalogo publico.'
        : 'Adicionado a sua colecao.',
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
  source: 'metron' | 'rika',
  ref: string,
): Promise<ExternalData | null> {
  if (source === 'metron') {
    const id = parseInt(ref, 10);
    if (!Number.isFinite(id)) return null;
    const detail = await getMetronIssue(id);
    if (!detail) return null;
    return {
      title: detail.issue,
      publisher: null, // Metron detail não expõe publisher diretamente; pode ser ampliado depois
      editionNumber: parseInt(detail.number, 10) || null,
      image: detail.image ?? null,
      description: detail.description ?? null,
      isbn: detail.isbn ?? null,
    };
  }

  // rika: busca pelo ref/id (sem endpoint de detalhe dedicado)
  const list = await searchRika(ref, { limit: 1 });
  const found = list.find((p) => p.id === ref) ?? list[0];
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

/**
 * Baixa imagem da URL e faz upload pro storage configurado (R2 → Cloudinary →
 * local). Retorna apenas o filename (sem pasta) para salvar em coverFileName,
 * ou null em caso de falha (best effort — não deve travar o import).
 *
 * O publicId retornado por uploadImage tem formato "covers/uuid.ext"; extraímos
 * só a parte após a última barra para obter o filename.
 */
async function tryDownloadCover(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1_000) return null; // muito pequeno, provável placeholder

    const { publicId } = await uploadImage(buffer, 'covers');
    // publicId = "covers/uuid.ext" — extrair só o filename
    const filename = publicId.split('/').pop() ?? null;
    return filename;
  } catch {
    return null;
  }
}
