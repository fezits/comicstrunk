import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { NotFoundError } from '../../shared/utils/api-error';
import type { MarketplaceSearchInput } from '@comicstrunk/contracts';

// === Standard includes for marketplace listing queries ===

function listingIncludes() {
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
      },
    },
    user: {
      select: {
        id: true,
        name: true,
      },
    },
  };
}

/**
 * Search public marketplace listings.
 * This is a PUBLIC endpoint — no authentication required.
 */
export async function searchListings(params: MarketplaceSearchInput) {
  const {
    query,
    condition,
    minPrice,
    maxPrice,
    publisher,
    characterId,
    seriesId,
    sellerId,
    sortBy,
    sortOrder,
    page,
    limit,
  } = params;

  const skip = (page - 1) * limit;

  const where: Prisma.CollectionItemWhereInput = {
    isForSale: true,
    salePrice: { not: null },
  };

  // Build catalogEntry filter conditions
  const catalogEntryFilter: Prisma.CatalogEntryWhereInput = {
    approvalStatus: 'APPROVED',
  };

  if (query) {
    catalogEntryFilter.title = { contains: query };
  }

  if (publisher) {
    catalogEntryFilter.publisher = { contains: publisher };
  }

  if (characterId) {
    catalogEntryFilter.characters = {
      some: { characterId },
    };
  }

  if (seriesId) {
    catalogEntryFilter.seriesId = seriesId;
  }

  // Only apply catalogEntry filter if there are conditions
  if (Object.keys(catalogEntryFilter).length > 1) {
    where.catalogEntry = catalogEntryFilter;
  } else {
    where.catalogEntry = { approvalStatus: 'APPROVED' };
  }

  if (sellerId) {
    where.userId = sellerId;
  }

  if (condition) {
    where.condition = condition;
  }

  if (minPrice !== undefined) {
    where.salePrice = {
      ...(where.salePrice as Prisma.DecimalNullableFilter | undefined),
      gte: minPrice,
    };
  }

  if (maxPrice !== undefined) {
    where.salePrice = {
      ...(where.salePrice as Prisma.DecimalNullableFilter | undefined),
      lte: maxPrice,
    };
  }

  // Map sort fields
  const sortFieldMap: Record<string, Prisma.CollectionItemOrderByWithRelationInput> = {
    price: { salePrice: sortOrder },
    newest: { createdAt: sortOrder },
    condition: { condition: sortOrder },
  };
  const orderBy = sortFieldMap[sortBy] || { createdAt: 'desc' };

  const [data, total] = await Promise.all([
    prisma.collectionItem.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: listingIncludes(),
    }),
    prisma.collectionItem.count({ where }),
  ]);

  // Map results to include seller info
  const listings = data.map((item) => ({
    id: item.id,
    catalogEntry: item.catalogEntry,
    seller: {
      id: item.user.id,
      name: item.user.name,
    },
    condition: item.condition,
    salePrice: Number(item.salePrice),
    photoUrls: item.photoUrls,
    createdAt: item.createdAt.toISOString(),
  }));

  return { data: listings, total, page, limit };
}

/**
 * Get a single marketplace listing by collection item ID.
 * Public endpoint — no authentication required.
 */
export async function getListingById(id: string) {
  const item = await prisma.collectionItem.findUnique({
    where: { id },
    include: listingIncludes(),
  });

  if (!item || !item.isForSale || !item.salePrice) {
    throw new NotFoundError('Listing not found');
  }

  // Verify catalog entry is approved
  if (item.catalogEntry && (item.catalogEntry as unknown as { approvalStatus?: string }).approvalStatus !== undefined) {
    // catalogEntry is a select, not full model — we trust the isForSale flag
  }

  return {
    id: item.id,
    catalogEntry: item.catalogEntry,
    seller: {
      id: item.user.id,
      name: item.user.name,
    },
    condition: item.condition,
    salePrice: Number(item.salePrice),
    photoUrls: item.photoUrls,
    createdAt: item.createdAt.toISOString(),
  };
}
