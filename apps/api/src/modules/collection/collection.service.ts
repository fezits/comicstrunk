import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { parseCSV, generateCSV } from '../../shared/lib/csv';
import { uploadImage, deleteImage } from '../../shared/lib/cloudinary';
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
        seriesId: true,
        volumeNumber: true,
        editionNumber: true,
        series: { select: { id: true, title: true, totalEditions: true } },
      },
    },
  };
}

// === Plan Limit Check (returns structured data) ===

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

async function checkPlanLimit(
  client: TxClient,
  userId: string,
  additionalItems = 1,
): Promise<{ currentCount: number; limit: number; planType: string }> {
  const currentCount = await client.collectionItem.count({ where: { userId } });

  // Check subscription -- default to FREE if none
  const subscription = await client.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

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

    // Check for duplicate (same user + same catalog entry)
    const existing = await tx.collectionItem.findFirst({
      where: { userId, catalogEntryId: data.catalogEntryId },
    });

    if (existing) {
      throw new ConflictError('This item is already in your collection');
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

    return item;
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

  return prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.pricePaid !== undefined && { pricePaid: data.pricePaid }),
      ...(data.condition !== undefined && { condition: data.condition }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: collectionIncludes(),
  });
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

  const [data, total] = await Promise.all([
    prisma.collectionItem.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: collectionIncludes(),
    }),
    prisma.collectionItem.count({ where }),
  ]);

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

  return item;
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

  return prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
    include: collectionIncludes(),
  });
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
      ...updated,
      commission,
      sellerNet:
        data.isForSale && data.salePrice && commission
          ? Number((data.salePrice - commission).toFixed(2))
          : null,
    }));
}

// === Stats ===

export async function getStats(userId: string) {
  const [totalItems, totalRead, totalForSale, valuePaid, valueForSale] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.collectionItem.count({ where: { userId, isRead: true } }),
    prisma.collectionItem.count({ where: { userId, isForSale: true } }),
    prisma.collectionItem.aggregate({
      where: { userId, pricePaid: { not: null } },
      _sum: { pricePaid: true },
    }),
    prisma.collectionItem.aggregate({
      where: { userId, isForSale: true, salePrice: { not: null } },
      _sum: { salePrice: true },
    }),
  ]);

  return {
    totalItems,
    totalRead,
    totalUnread: totalItems - totalRead,
    totalForSale,
    totalValuePaid: Number(valuePaid._sum.pricePaid ?? 0),
    totalValueForSale: Number(valueForSale._sum.salePrice ?? 0),
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

// === Photo Management ===

export async function addPhoto(userId: string, itemId: string, photoUrl: string) {
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

  const currentPhotos = Array.isArray(item.photoUrls)
    ? (item.photoUrls as string[])
    : [];

  if (currentPhotos.length >= MAX_PHOTOS_PER_ITEM) {
    throw new BadRequestError(
      `Maximum ${MAX_PHOTOS_PER_ITEM} photos per item allowed`,
      { currentCount: currentPhotos.length, limit: MAX_PHOTOS_PER_ITEM },
    );
  }

  return prisma.collectionItem.update({
    where: { id: itemId },
    data: { photoUrls: [...currentPhotos, photoUrl] },
    include: collectionIncludes(),
  });
}

export async function removePhoto(userId: string, itemId: string, photoIndex: number) {
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

  const currentPhotos = Array.isArray(item.photoUrls)
    ? (item.photoUrls as string[])
    : [];

  if (photoIndex < 0 || photoIndex >= currentPhotos.length) {
    throw new BadRequestError('Invalid photo index');
  }

  const removedUrl = currentPhotos[photoIndex];

  // Extract publicId from Cloudinary URL or local path for cleanup
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
    // Silently continue if cleanup fails -- don't block photo removal
  }

  const updatedPhotos = currentPhotos.filter((_, idx) => idx !== photoIndex);

  return prisma.collectionItem.update({
    where: { id: itemId },
    data: { photoUrls: updatedPhotos.length > 0 ? updatedPhotos : Prisma.JsonNull },
    include: collectionIncludes(),
  });
}

// === Missing Editions ===

export async function getMissingEditions(userId: string, seriesId: string) {
  // Get all APPROVED catalog entries in this series
  const allEditions = await prisma.catalogEntry.findMany({
    where: { seriesId, approvalStatus: 'APPROVED' },
    select: {
      id: true,
      title: true,
      editionNumber: true,
      volumeNumber: true,
      coverImageUrl: true,
    },
    orderBy: { editionNumber: 'asc' },
  });

  // Get user's collection items for this series
  const ownedItems = await prisma.collectionItem.findMany({
    where: { userId, catalogEntry: { seriesId } },
    select: { catalogEntryId: true },
  });

  const ownedSet = new Set(ownedItems.map((item) => item.catalogEntryId));

  return allEditions.filter((edition) => !ownedSet.has(edition.id));
}

// === CSV Import (atomic with transaction) ===

const MAX_IMPORT_ROWS = 500;

export async function importCSV(userId: string, buffer: Buffer) {
  const { data: rows } = parseCSV<Record<string, string>>(buffer);

  if (rows.length === 0) {
    throw new BadRequestError('CSV file is empty');
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(`CSV exceeds maximum of ${MAX_IMPORT_ROWS} rows`);
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

// === CSV Template ===

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
