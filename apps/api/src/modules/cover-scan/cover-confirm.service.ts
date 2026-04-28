import { prisma } from '../../shared/lib/prisma';
import { uploadImage } from '../../shared/lib/cloudinary';
import { logger } from '../../shared/lib/logger';
import { ConflictError, NotFoundError } from '../../shared/utils/api-error';
import { importExternalCandidate } from './cover-import.service';
import type {
  CoverScanConfirmInput,
  CoverScanConfirmResponse,
} from '@comicstrunk/contracts';

/**
 * Confirma um candidato escolhido pelo usuario no modal pos-scan.
 *
 * Fluxo:
 * 1. Valida que o scanLog pertence ao usuario.
 * 2. Resolve o catalogEntry:
 *    - Externo (isExternal+externalSource): chama importExternalCandidate
 *      (cria entry PENDING ou reusa por sourceKey).
 *    - Local: usa o id direto.
 * 3. Verifica se o gibi ja esta na colecao do usuario.
 *    - Se ja estiver: retorna alreadyInCollection=true SEM criar item nem
 *      salvar foto. Frontend mostra "ja esta na sua colecao".
 *    - Se nao estiver: cria CollectionItem.
 * 4. Se userPhotoBase64 veio, salva no R2 e adiciona em
 *    CollectionItem.photoUrls (so quando criou item novo).
 * 5. Atualiza chosenEntryId no scanLog.
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

  let catalogEntryId: string;

  // Resolver catalogEntryId: externo importa, local usa direto.
  const cand = input.candidate;
  if (cand.isExternal && cand.externalSource && cand.externalRef) {
    const importResult = await importExternalCandidate(userId, {
      scanLogId: input.scanLogId,
      externalSource: cand.externalSource,
      externalRef: cand.externalRef,
    });
    catalogEntryId = importResult.catalogEntryId;
    // importExternalCandidate ja adicionou o item na colecao OU incrementou
    // qty se existia. Para preservar o contrato "nao gravar se ja estiver",
    // a gente checa abaixo.
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

  // Checa se ja esta na colecao
  const existingItem = await prisma.collectionItem.findFirst({
    where: { userId, catalogEntryId },
    select: { id: true, quantity: true, photoUrls: true },
  });

  if (existingItem) {
    return {
      catalogEntryId,
      collectionItemId: existingItem.id,
      alreadyInCollection: true,
      message: 'Gibi adicionado à sua coleção.',
    };
  }

  // Cria item novo (caminho local; externo ja criou via importExternalCandidate
  // — mas se chegou aqui sem existingItem eh porque o import falhou silencioso
  // ou o usuario eh diferente do que importou).
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

  // Salva foto do usuario (best-effort) no item recem-criado
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

  // Marca a escolha no scanLog
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
