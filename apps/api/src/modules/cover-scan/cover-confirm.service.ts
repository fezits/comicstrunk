import { prisma } from '../../shared/lib/prisma';
import { uploadImage } from '../../shared/lib/cloudinary';
import { logger } from '../../shared/lib/logger';
import { NotFoundError } from '../../shared/utils/api-error';
import { ensureCatalogEntryFromExternal } from './cover-import.service';
import type {
  CoverScanConfirmInput,
  CoverScanConfirmResponse,
} from '@comicstrunk/contracts';

/**
 * Confirma um candidato escolhido pelo usuario no modal pos-scan.
 *
 * Diferente de /import, este endpoint NUNCA incrementa quantidade do item:
 * se o gibi ja esta na colecao do usuario, retorna alreadyInCollection
 * com a quantidade preservada. UX: clicar de novo no mesmo gibi nao
 * cria copia.
 *
 * Fluxo:
 * 1. Valida o scanLog.
 * 2. Resolve catalogEntry:
 *    - Externo: ensureCatalogEntryFromExternal por sourceKey (cria se
 *      nao existir; reusa silenciosamente se existir).
 *    - Local: id direto, valida que o entry existe.
 * 3. Verifica se o usuario ja tem o item.
 *    - Sim: retorna alreadyInCollection=true SEM mexer em quantity nem
 *      em foto.
 *    - Nao: cria CollectionItem + grava userPhoto se veio.
 * 4. Atualiza chosenEntryId no scanLog.
 */
export async function confirmCandidate(
  userId: string,
  input: CoverScanConfirmInput,
): Promise<CoverScanConfirmResponse> {
  const scanLog = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true },
  });
  if (!scanLog || scanLog.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado.');
  }

  const cand = input.candidate;
  let catalogEntryId: string;

  if (cand.isExternal && cand.externalSource && cand.externalRef) {
    const entry = await ensureCatalogEntryFromExternal(
      userId,
      cand.externalSource,
      cand.externalRef,
      input.scanLogId,
    );
    catalogEntryId = entry.id;
  } else {
    catalogEntryId = cand.id;
    const exists = await prisma.catalogEntry.findUnique({
      where: { id: catalogEntryId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError('Gibi não encontrado no catálogo.');
    }
  }

  // Ja tem na colecao? Devolve mensagem unica sem mexer em quantity.
  const existingItem = await prisma.collectionItem.findFirst({
    where: { userId, catalogEntryId },
    select: { id: true },
  });

  if (existingItem) {
    // Atualiza chosenEntryId no scanLog mesmo assim (telemetria).
    await prisma.coverScanLog.update({
      where: { id: input.scanLogId },
      data: { chosenEntryId: catalogEntryId },
    });
    return {
      catalogEntryId,
      collectionItemId: existingItem.id,
      alreadyInCollection: true,
      message: 'Gibi adicionado à sua coleção.',
    };
  }

  // Cria item novo
  const created = await prisma.collectionItem.create({
    data: {
      userId,
      catalogEntryId,
      condition: 'GOOD',
      quantity: 1,
    },
    select: { id: true },
  });
  const collectionItemId = created.id;

  // Salva foto do usuario (best-effort)
  if (input.userPhotoBase64) {
    try {
      const buffer = parseDataUri(input.userPhotoBase64);
      if (buffer && buffer.length > 1000) {
        const { url } = await uploadImage(buffer, 'user-covers');
        await prisma.collectionItem.update({
          where: { id: collectionItemId },
          data: { photoUrls: [url] },
        });
      }
    } catch (err) {
      logger.warn('cover-confirm: failed to save user photo', {
        err: (err as Error)?.message,
        collectionItemId,
      });
    }
  }

  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: { chosenEntryId: catalogEntryId },
  });

  return {
    catalogEntryId,
    collectionItemId,
    alreadyInCollection: false,
    message: 'Gibi adicionado à sua coleção.',
  };
}

function parseDataUri(uri: string): Buffer | null {
  const match = uri.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}
