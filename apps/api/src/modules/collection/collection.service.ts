import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { parseCSV, generateCSV } from '../../shared/lib/csv';
import { uploadImage, deleteImage, resolveCoverUrl } from '../../shared/lib/cloudinary';
import { parseXLSX, generateXLSX, generateCollectionTemplate, COLLECTION_FIELD_MAP, COLLECTION_REVERSE } from '../../shared/lib/xlsx';
import { BadRequestError, NotFoundError, ConflictError } from '../../shared/utils/api-error';
import { collectionImportRowSchema, COLLECTION_LIMITS } from '@comicstrunk/contracts';
import type {
  CreateCollectionItemInput,
  UpdateCollectionItemInput,
  MarkForSaleInput,
  CollectionSearchInput,
} from '@comicstrunk/contracts';

// === Commission rate (fixed for now, Phase 5 will use CommissionConfig) ===

const COMMISSION_RATE = 0.1; // 10%

// === Max photos per collection item ===

const MAX_PHOTOS_PER_ITEM = 5;

// === Standard includes for collection item queries ===

function collectionIncludes() {
  return {
    catalogEntry: {
      select: {
        id: true,
        title: true,
        author: true,
        publisher: true,
        coverImageUrl: true,
        coverFileName: true,
        seriesId: true,
        volumeNumber: true,
        editionNumber: true,
        series: { select: { id: true, title: true, totalEditions: true } },
      },
    },
  };
}

/** Resolve cover URLs for any collection item with catalogEntry */
function resolveItemCover<T extends { catalogEntry?: { coverImageUrl: string | null; coverFileName?: string | null } | null }>(item: T): T {
  if (item.catalogEntry) {
    return { ...item, catalogEntry: resolveCoverUrl(item.catalogEntry) };
  }
  return item;
}

// === Plan Limit Check (returns structured data) ===

async function checkPlanLimit(
  tx: Prisma.TransactionClient,
  userId: string,
  additionalItems = 1,
): Promise<{ currentCount: number; limit: number; planType: string }> {
  const agg = await tx.collectionItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  const currentCount = Number(agg._sum.quantity ?? 0);

  // Check subscription — default to FREE if none
  // TRIALING status grants same benefits as ACTIVE (Phase 6 subscription support)
  const subscription = await tx.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { createdAt: 'desc' },
  });

  // Check if user is ADMIN — unlimited collection
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'ADMIN') {
    return { currentCount, limit: Infinity, planType: 'ADMIN' };
  }

  const planType = subscription?.planType ?? 'FREE';
  const limit =
    COLLECTION_LIMITS[planType as keyof typeof COLLECTION_LIMITS] ?? COLLECTION_LIMITS.FREE;

  if (currentCount + additionalItems > limit) {
    throw new BadRequestError(
      `Collection limit reached (${limit} items for ${planType} plan). Current: ${currentCount}.`,
      { currentCount, limit, planType },
    );
  }

  return { currentCount, limit, planType };
}

// === CRUD Operations ===

export async function addItem(userId: string, data: CreateCollectionItemInput) {
  return prisma.$transaction(async (tx) => {
    // Verify catalog entry exists and is approved
    const catalogEntry = await tx.catalogEntry.findUnique({
      where: { id: data.catalogEntryId },
    });

    if (!catalogEntry || catalogEntry.approvalStatus !== 'APPROVED') {
      throw new NotFoundError('Catalog entry not found or not approved');
    }

    // If user already has this item, increment quantity instead of erroring
    const existing = await tx.collectionItem.findFirst({
      where: { userId, catalogEntryId: data.catalogEntryId },
      include: collectionIncludes(),
    });

    if (existing) {
      const updated = await tx.collectionItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (data.quantity ?? 1) },
        include: collectionIncludes(),
      });
      return resolveItemCover(updated);
    }

    // Check plan limit atomically within the transaction
    await checkPlanLimit(tx, userId);

    const item = await tx.collectionItem.create({
      data: {
        userId,
        catalogEntryId: data.catalogEntryId,
        quantity: data.quantity,
        pricePaid: data.pricePaid,
        condition: data.condition,
        notes: data.notes,
        isRead: data.isRead,
        readAt: data.isRead ? new Date() : null,
      },
      include: collectionIncludes(),
    });

    return resolveItemCover(item);
  });
}

// === Batch Add ===

export interface BatchAddInput {
  catalogEntryIds: string[];
  condition: string;
  isRead: boolean;
}

export interface BatchAddResult {
  added: number;
  skipped: number;
  skippedIds: string[];
  total: number;
}

export async function batchAddItems(
  userId: string,
  data: BatchAddInput,
): Promise<BatchAddResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Find which entries the user already has
    const existing = await tx.collectionItem.findMany({
      where: { userId, catalogEntryId: { in: data.catalogEntryIds } },
      select: { catalogEntryId: true },
    });
    const existingIds = new Set(existing.map((e) => e.catalogEntryId));

    // 2. Filter to only new entries
    const newIds = data.catalogEntryIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return { added: 0, skipped: data.catalogEntryIds.length, skippedIds: data.catalogEntryIds, total: data.catalogEntryIds.length };
    }

    // 3. Verify all catalog entries exist and are approved
    const validEntries = await tx.catalogEntry.findMany({
      where: { id: { in: newIds }, approvalStatus: 'APPROVED' },
      select: { id: true },
    });
    const validIds = new Set(validEntries.map((e) => e.id));
    const toAdd = newIds.filter((id) => validIds.has(id));

    if (toAdd.length === 0) {
      return { added: 0, skipped: data.catalogEntryIds.length, skippedIds: data.catalogEntryIds, total: data.catalogEntryIds.length };
    }

    // 4. Check plan limit for all items at once
    await checkPlanLimit(tx, userId, toAdd.length);

    // 5. Create all items in one batch
    await tx.collectionItem.createMany({
      data: toAdd.map((catalogEntryId) => ({
        userId,
        catalogEntryId,
        quantity: 1,
        condition: (data.condition || 'VERY_GOOD') as 'NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR' | 'POOR',
        isRead: data.isRead ?? false,
        readAt: data.isRead ? new Date() : null,
      })),
    });

    const skippedIds = data.catalogEntryIds.filter((id) => !validIds.has(id) || existingIds.has(id));

    return {
      added: toAdd.length,
      skipped: data.catalogEntryIds.length - toAdd.length,
      skippedIds,
      total: data.catalogEntryIds.length,
    };
  });
}

export async function updateItem(userId: string, itemId: string, data: UpdateCollectionItemInput) {
  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.userId !== userId) {
    throw new NotFoundError('Collection item not found');
  }

  const updated = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.pricePaid !== undefined && { pricePaid: data.pricePaid }),
      ...(data.condition !== undefined && { condition: data.condition }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...((data as Record<string, unknown>).readAt !== undefined && { readAt: (data as Record<string, unknown>).readAt ? new Date((data as Record<string, unknown>).readAt as string) : null }),
    },
    include: collectionIncludes(),
  });

  return resolveItemCover(updated);
}

export async function deleteItem(userId: string, itemId: string) {
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: {
      orderItems: {
        where: { status: { in: ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED'] } },
      },
    },
  });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.userId !== userId) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.orderItems.length > 0) {
    throw new BadRequestError('Cannot delete item with active orders');
  }

  await prisma.collectionItem.delete({ where: { id: itemId } });
}

export async function getItems(userId: string, filters: CollectionSearchInput) {
  const { query, condition, isRead, isForSale, seriesId, sortBy, sortOrder, page, limit } =
    filters;
  const skip = (page - 1) * limit;

  const where: Prisma.CollectionItemWhereInput = { userId };

  if (query) {
    where.catalogEntry = {
      title: { contains: query },
    };
  }

  if (condition) {
    where.condition = condition;
  }

  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  if (isForSale !== undefined) {
    where.isForSale = isForSale;
  }

  if (seriesId) {
    where.catalogEntry = {
      ...((where.catalogEntry as Prisma.CatalogEntryWhereInput) ?? {}),
      seriesId,
    };
  }

  // Map sort fields
  const sortFieldMap: Record<string, Prisma.CollectionItemOrderByWithRelationInput> = {
    title: { catalogEntry: { title: sortOrder } },
    createdAt: { createdAt: sortOrder },
    pricePaid: { pricePaid: sortOrder },
    condition: { condition: sortOrder },
  };
  const orderBy = sortFieldMap[sortBy] || { createdAt: 'desc' };

  const [rawData, total] = await Promise.all([
    prisma.collectionItem.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: collectionIncludes(),
    }),
    prisma.collectionItem.count({ where }),
  ]);

  const data = rawData.map(item => ({
    ...item,
    catalogEntry: item.catalogEntry ? resolveCoverUrl(item.catalogEntry) : item.catalogEntry,
  }));

  return { data, total, page, limit };
}

export async function getItem(userId: string, itemId: string) {
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: collectionIncludes(),
  });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.userId !== userId) {
    throw new NotFoundError('Collection item not found');
  }

  return resolveItemCover(item);
}

// === Toggle Read ===

export async function markAsRead(userId: string, itemId: string, isRead: boolean) {
  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.userId !== userId) {
    throw new NotFoundError('Collection item not found');
  }

  const updated = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
    include: collectionIncludes(),
  });
  return resolveItemCover(updated);
}

// === Toggle For Sale ===

export async function markForSale(userId: string, itemId: string, data: MarkForSaleInput) {
  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  if (item.userId !== userId) {
    throw new NotFoundError('Collection item not found');
  }

  if (data.isForSale && !data.salePrice) {
    throw new BadRequestError('Sale price is required when marking for sale');
  }

  const commission =
    data.isForSale && data.salePrice
      ? Number((data.salePrice * COMMISSION_RATE).toFixed(2))
      : null;

  return prisma.collectionItem
    .update({
      where: { id: itemId },
      data: {
        isForSale: data.isForSale,
        salePrice: data.isForSale ? data.salePrice : null,
      },
      include: collectionIncludes(),
    })
    .then((updated) => ({
      ...resolveItemCover(updated),
      commission,
      sellerNet:
        data.isForSale && data.salePrice && commission
          ? Number((data.salePrice - commission).toFixed(2))
          : null,
    }));
}

// === Stats ===

export async function getStats(userId: string) {
  const [uniqueItems, totalQuantity, totalRead, totalForSale, valuePaid, valueForSale] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.collectionItem.aggregate({
      where: { userId },
      _sum: { quantity: true },
    }),
    prisma.collectionItem.aggregate({
      where: { userId, isRead: true },
      _sum: { quantity: true },
    }),
    prisma.collectionItem.aggregate({
      where: { userId, isForSale: true },
      _sum: { quantity: true },
    }),
    prisma.collectionItem.aggregate({
      where: { userId, pricePaid: { not: null } },
      _sum: { pricePaid: true },
    }),
    prisma.collectionItem.aggregate({
      where: { userId, isForSale: true, salePrice: { not: null } },
      _sum: { salePrice: true },
    }),
  ]);

  const totalItems = Number(totalQuantity._sum.quantity ?? 0);
  const readCount = Number(totalRead._sum.quantity ?? 0);
  const forSaleCount = Number(totalForSale._sum.quantity ?? 0);

  return {
    totalItems,
    uniqueTitles: uniqueItems,
    totalRead: readCount,
    totalUnread: totalItems - readCount,
    totalForSale: forSaleCount,
    totalValuePaid: Number(valuePaid._sum.pricePaid ?? 0),
    totalValueForSale: Number(valueForSale._sum.salePrice ?? 0),
  };
}

// === Reading Timeline ===

export async function getTimeline(
  userId: string,
  params: { year?: number; month?: number; publisher?: string; seriesId?: string; mode?: string },
) {
  const mode = params.mode || 'read'; // 'read' | 'added' | 'both'
  const dateField = mode === 'added' ? 'createdAt' : 'readAt';

  const where: Record<string, unknown> = { userId };

  if (mode === 'read') {
    where.isRead = true;
    where.readAt = { not: null };
  }
  // 'added' and 'both' don't filter by isRead

  // Apply filters
  if (params.publisher || params.seriesId) {
    const catalogWhere: Record<string, unknown> = {};
    if (params.publisher) catalogWhere.publisher = { contains: params.publisher };
    if (params.seriesId) catalogWhere.seriesId = params.seriesId;
    where.catalogEntry = catalogWhere;
  }

  // Date range filter
  if (params.year) {
    const start = new Date(params.year, params.month ? params.month - 1 : 0, 1);
    const end = params.month
      ? new Date(params.year, params.month, 0, 23, 59, 59)
      : new Date(params.year, 11, 31, 23, 59, 59);
    where[dateField] = { gte: start, lte: end };
  }

  const items = await prisma.collectionItem.findMany({
    where,
    select: {
      id: true,
      readAt: true,
      createdAt: true,
      catalogEntry: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          coverFileName: true,
          publisher: true,
          seriesId: true,
          series: { select: { title: true } },
        },
      },
    },
    orderBy: { readAt: 'asc' },
  });

  // Resolve cover URLs
  const resolved = items.map(item => ({
    ...item,
    catalogEntry: resolveCoverUrl(item.catalogEntry),
  }));

  // Group by period
  const groups = new Map<string, { key: string; label: string; count: number; items: unknown[] }>();

  for (const item of resolved) {
    const dateValue = mode === 'added' ? item.createdAt : item.readAt;
    if (!dateValue) continue;
    const d = new Date(dateValue);
    let key: string;
    let label: string;

    if (params.year && params.month) {
      const day = d.getDate();
      key = String(day);
      label = String(day);
    } else if (params.year) {
      const month = d.getMonth();
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      key = String(month + 1);
      label = monthNames[month];
    } else {
      key = String(d.getFullYear());
      label = String(d.getFullYear());
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, count: 0, items: [] });
    }
    const group = groups.get(key)!;
    group.count++;
    {
      group.items.push({
        id: item.catalogEntry.id,
        title: item.catalogEntry.title,
        slug: item.catalogEntry.slug,
        coverImageUrl: item.catalogEntry.coverImageUrl,
        publisher: item.catalogEntry.publisher,
        seriesName: item.catalogEntry.series?.title ?? null,
        readAt: item.readAt,
        addedAt: item.createdAt,
      });
    }
  }

  // Find period range
  const allDates = resolved.filter(i => i.readAt).map(i => new Date(i.readAt!));
  const periodStart = allDates.length ? allDates[0].toISOString().slice(0, 10) : null;
  const periodEnd = allDates.length ? allDates[allDates.length - 1].toISOString().slice(0, 10) : null;

  return {
    totalRead: resolved.length,
    periodStart,
    periodEnd,
    groups: Array.from(groups.values()).sort((a, b) => Number(a.key) - Number(b.key)),
  };
}

// === Available filters for timeline ===

export async function getTimelineFilters(userId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { userId, isRead: true, readAt: { not: null } },
    select: {
      catalogEntry: {
        select: {
          publisher: true,
          seriesId: true,
          series: { select: { id: true, title: true } },
        },
      },
    },
  });

  const publishers = new Set<string>();
  const seriesMap = new Map<string, string>();

  for (const item of items) {
    if (item.catalogEntry.publisher) publishers.add(item.catalogEntry.publisher);
    if (item.catalogEntry.seriesId && item.catalogEntry.series) {
      seriesMap.set(item.catalogEntry.series.id, item.catalogEntry.series.title);
    }
  }

  return {
    publishers: Array.from(publishers).sort(),
    series: Array.from(seriesMap.entries()).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
  };
}

// === Series Progress ===

export async function getSeriesProgress(userId: string, seriesId?: string) {
  const where: Prisma.CollectionItemWhereInput = {
    userId,
    catalogEntry: {
      seriesId: seriesId ? seriesId : { not: null },
    },
  };

  const items = await prisma.collectionItem.findMany({
    where,
    include: {
      catalogEntry: {
        select: {
          seriesId: true,
          series: { select: { id: true, title: true, totalEditions: true } },
        },
      },
    },
  });

  // Group by series
  const seriesMap = new Map<
    string,
    {
      seriesId: string;
      seriesTitle: string;
      totalEditions: number;
      collected: number;
    }
  >();

  for (const item of items) {
    const series = item.catalogEntry.series;
    if (!series) continue;

    const existing = seriesMap.get(series.id);
    if (existing) {
      existing.collected++;
    } else {
      seriesMap.set(series.id, {
        seriesId: series.id,
        seriesTitle: series.title,
        totalEditions: series.totalEditions,
        collected: 1,
      });
    }
  }

  return Array.from(seriesMap.values()).map((s) => ({
    ...s,
    percentage: Math.round((s.collected / s.totalEditions) * 100),
  }));
}

// === Missing Editions ===

export async function getMissingEditions(userId: string, seriesId: string) {
  // Get all APPROVED catalog entries in this series
  const allEditions = await prisma.catalogEntry.findMany({
    where: { seriesId, approvalStatus: 'APPROVED' },
    select: {
      id: true,
      title: true,
      slug: true,
      editionNumber: true,
      volumeNumber: true,
      coverImageUrl: true,
      coverFileName: true,
    },
    orderBy: { editionNumber: 'asc' },
  });

  // Get IDs of editions the user already owns
  const ownedItems = await prisma.collectionItem.findMany({
    where: {
      userId,
      catalogEntry: { seriesId },
    },
    select: { catalogEntryId: true },
  });

  const ownedIds = new Set(ownedItems.map((i) => i.catalogEntryId));

  // Return editions NOT in the user's collection
  return allEditions.filter((e) => !ownedIds.has(e.id)).map(resolveCoverUrl);
}

// === Photo Management ===

export async function addPhoto(userId: string, itemId: string, photoUrl: string) {
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: collectionIncludes(),
  });

  if (!item) throw new NotFoundError('Collection item not found');
  if (item.userId !== userId) throw new NotFoundError('Collection item not found');

  const currentPhotos = Array.isArray(item.photoUrls) ? (item.photoUrls as string[]) : [];

  if (currentPhotos.length >= MAX_PHOTOS_PER_ITEM) {
    throw new BadRequestError(
      `Maximum ${MAX_PHOTOS_PER_ITEM} photos per item allowed. Current: ${currentPhotos.length}.`,
    );
  }

  const updated = await prisma.collectionItem.update({
    where: { id: itemId },
    data: { photoUrls: [...currentPhotos, photoUrl] },
    include: collectionIncludes(),
  });
  return resolveItemCover(updated);
}

export async function removePhoto(userId: string, itemId: string, photoIndex: number) {
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: collectionIncludes(),
  });

  if (!item) throw new NotFoundError('Collection item not found');
  if (item.userId !== userId) throw new NotFoundError('Collection item not found');

  const currentPhotos = Array.isArray(item.photoUrls) ? (item.photoUrls as string[]) : [];

  if (photoIndex < 0 || photoIndex >= currentPhotos.length) {
    throw new BadRequestError('Invalid photo index');
  }

  // Try to clean up the image file (Cloudinary or local)
  const removedUrl = currentPhotos[photoIndex];
  try {
    // Cloudinary URLs: https://res.cloudinary.com/.../v123/folder/filename.ext
    const cloudinaryMatch = removedUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    if (cloudinaryMatch) {
      await deleteImage(cloudinaryMatch[1]);
    } else {
      // Local uploads: http://localhost:3001/uploads/folder/filename.ext
      const localMatch = removedUrl.match(/\/uploads\/(.+)$/);
      if (localMatch) {
        await deleteImage(localMatch[1]);
      }
    }
  } catch {
    // Silently continue if cleanup fails — photo URL already removed from DB
  }

  const updatedPhotos = currentPhotos.filter((_, idx) => idx !== photoIndex);

  const updated = await prisma.collectionItem.update({
    where: { id: itemId },
    data: { photoUrls: updatedPhotos.length > 0 ? updatedPhotos : Prisma.JsonNull },
    include: collectionIncludes(),
  });
  return resolveItemCover(updated);
}

// === CSV Import ===

const MAX_IMPORT_ROWS = 500;

export async function importCSV(userId: string, buffer: Buffer, filename?: string) {
  const isXlsx = filename?.endsWith('.xlsx') || buffer[0] === 0x50;
  let rows: Record<string, string>[];

  if (isXlsx) {
    rows = await parseXLSX(buffer, COLLECTION_FIELD_MAP);
  } else {
    rows = parseCSV<Record<string, string>>(buffer).data;
  }

  if (rows.length === 0) {
    throw new BadRequestError('Arquivo vazio');
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(`Arquivo excede o máximo de ${MAX_IMPORT_ROWS} linhas`);
  }

  return prisma.$transaction(async (tx) => {
    // Check plan limit atomically within the transaction
    await checkPlanLimit(tx, userId, rows.length);

    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 for header row + 0-index
      const raw = rows[i];

      const result = collectionImportRowSchema.safeParse(raw);
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message).join('; ');
        errors.push({ row: rowNumber, message: messages });
        continue;
      }

      const validated = result.data;

      try {
        // Find catalog entry by title
        const catalogEntry = await tx.catalogEntry.findFirst({
          where: {
            title: { contains: validated.catalogEntryTitle },
            approvalStatus: 'APPROVED',
          },
        });

        if (!catalogEntry) {
          errors.push({
            row: rowNumber,
            message: `Catalog entry "${validated.catalogEntryTitle}" not found`,
          });
          continue;
        }

        // Check for duplicate
        const existing = await tx.collectionItem.findFirst({
          where: { userId, catalogEntryId: catalogEntry.id },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.collectionItem.create({
          data: {
            userId,
            catalogEntryId: catalogEntry.id,
            quantity: validated.quantity,
            pricePaid: validated.pricePaid,
            condition: validated.condition,
            notes: validated.notes || null,
            isRead: validated.isRead,
            readAt: validated.isRead ? new Date() : null,
          },
        });
        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: rowNumber, message });
      }
    }

    return { imported, skipped, errors, total: rows.length };
  });
}

// === CSV Export ===

export async function exportCSV(userId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      catalogEntry: {
        select: {
          title: true,
          author: true,
          publisher: true,
          series: { select: { title: true } },
          volumeNumber: true,
          editionNumber: true,
        },
      },
    },
  });

  const rows = items.map((item) => ({
    catalogEntryTitle: item.catalogEntry.title,
    author: item.catalogEntry.author || '',
    publisher: item.catalogEntry.publisher || '',
    seriesTitle: item.catalogEntry.series?.title || '',
    volumeNumber: item.catalogEntry.volumeNumber ?? '',
    editionNumber: item.catalogEntry.editionNumber ?? '',
    quantity: item.quantity,
    pricePaid: item.pricePaid ? Number(item.pricePaid) : '',
    condition: item.condition,
    notes: item.notes || '',
    isRead: item.isRead ? 'true' : 'false',
    isForSale: item.isForSale ? 'true' : 'false',
    salePrice: item.salePrice ? Number(item.salePrice) : '',
  }));

  return generateCSV(rows);
}

/** Export collection as XLSX with friendly pt-BR headers */
export async function exportXLSX(userId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      catalogEntry: {
        select: {
          title: true,
          author: true,
          publisher: true,
          series: { select: { title: true } },
          volumeNumber: true,
          editionNumber: true,
        },
      },
    },
  });

  const rows = items.map((item) => ({
    catalogEntryTitle: item.catalogEntry.title,
    quantity: item.quantity,
    pricePaid: item.pricePaid ? Number(item.pricePaid) : '',
    condition: item.condition,
    notes: item.notes || '',
    isRead: item.isRead,
    isForSale: item.isForSale,
    salePrice: item.salePrice ? Number(item.salePrice) : '',
  }));

  return generateXLSX(rows, COLLECTION_FIELD_MAP, COLLECTION_REVERSE, {
    sheetName: 'Minha Coleção',
    dropdowns: {
      'Estado': ['Novo', 'Muito Bom', 'Bom', 'Regular', 'Ruim'],
      'Já Leu?': ['Sim', 'Não'],
      'À Venda?': ['Sim', 'Não'],
    },
  });
}

// === Templates ===

export function getCSVTemplate() {
  return generateCSV([
    {
      catalogEntryTitle: 'Example Comic Title',
      quantity: 1,
      pricePaid: 29.9,
      condition: 'NEW',
      notes: 'Optional notes',
      isRead: 'false',
    },
  ]);
}

/** XLSX template with examples and instructions */
export async function getXLSXTemplate() {
  return generateCollectionTemplate();
}
