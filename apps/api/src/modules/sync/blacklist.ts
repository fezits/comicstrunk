import { prisma } from '../../shared/lib/prisma';

/**
 * Retorna true se a sourceKey está em removed_source_keys.
 *
 * Usado por sync-catalog (cron das 4h) e cover-import (cover-scan)
 * antes de criar novas CatalogEntry. Garante que entradas removidas
 * via /admin/duplicates não são reimportadas silenciosamente.
 */
export async function isSourceKeyBlocked(sourceKey: string): Promise<boolean> {
  const found = await prisma.removedSourceKey.findUnique({
    where: { sourceKey },
    select: { sourceKey: true },
  });
  return found !== null;
}
