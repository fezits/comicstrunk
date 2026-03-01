import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { uploadImage } from '../../shared/lib/cloudinary';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import type { CreateDealInput, UpdateDealInput, ListDealsInput } from '@comicstrunk/contracts';

// === Standard includes for deal queries ===

function dealIncludes() {
  return {
    store: true,
    category: true,
  };
}

// === CRUD Operations ===

export async function createDeal(data: CreateDealInput) {
  // Validate storeId exists and is active
  const store = await prisma.partnerStore.findUnique({
    where: { id: data.storeId },
  });
  if (!store) {
    throw new NotFoundError('Loja parceira não encontrada');
  }
  if (!store.isActive) {
    throw new BadRequestError('Loja parceira está inativa');
  }

  // Validate categoryId if provided
  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new NotFoundError('Categoria não encontrada');
    }
  }

  const deal = await prisma.deal.create({
    data: {
      storeId: data.storeId,
      type: data.type,
      title: data.title,
      description: data.description,
      couponCode: data.couponCode,
      discount: data.discount,
      affiliateBaseUrl: data.affiliateBaseUrl,
      categoryId: data.categoryId,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
    },
    include: dealIncludes(),
  });

  return deal;
}

export async function updateDeal(id: string, data: UpdateDealInput) {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Oferta não encontrada');
  }

  // Validate storeId if changed
  if (data.storeId && data.storeId !== existing.storeId) {
    const store = await prisma.partnerStore.findUnique({
      where: { id: data.storeId },
    });
    if (!store) {
      throw new NotFoundError('Loja parceira não encontrada');
    }
    if (!store.isActive) {
      throw new BadRequestError('Loja parceira está inativa');
    }
  }

  // Validate categoryId if changed
  if (data.categoryId && data.categoryId !== existing.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new NotFoundError('Categoria não encontrada');
    }
  }

  const deal = await prisma.deal.update({
    where: { id },
    data,
    include: dealIncludes(),
  });

  return deal;
}

export async function softDeleteDeal(id: string) {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Oferta não encontrada');
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: { isActive: false },
    include: dealIncludes(),
  });

  return deal;
}

export async function getDeal(id: string) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: dealIncludes(),
  });

  if (!deal) {
    throw new NotFoundError('Oferta não encontrada');
  }

  return {
    ...deal,
    composedUrl: composeDealUrl(deal),
  };
}

export async function listActiveDeals(filters: ListDealsInput) {
  const { page, limit, storeId, categoryId, type, sort } = filters;
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: Prisma.DealWhereInput = {
    isActive: true,
    // Only show deals that have started (or have no start date)
    OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    // Only show deals that haven't expired (or have no expiry)
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  };

  if (storeId) {
    where.storeId = storeId;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (type) {
    where.type = type;
  }

  // Determine sort order
  let orderBy: Prisma.DealOrderByWithRelationInput;
  switch (sort) {
    case 'expiring':
      orderBy = { expiresAt: 'asc' };
      break;
    case 'discount':
      orderBy = { discount: 'desc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
      break;
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: dealIncludes(),
    }),
    prisma.deal.count({ where }),
  ]);

  // Compose affiliate URLs
  const dealsWithUrls = deals.map((deal) => ({
    ...deal,
    composedUrl: composeDealUrl(deal),
  }));

  return { deals: dealsWithUrls, total, page, limit };
}

export async function listAllDeals(filters: { page: number; limit: number }) {
  const { page, limit } = filters;
  const skip = (page - 1) * limit;

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: dealIncludes(),
    }),
    prisma.deal.count(),
  ]);

  return { deals, total, page, limit };
}

export async function uploadBanner(id: string, buffer: Buffer) {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Oferta não encontrada');
  }

  const { url } = await uploadImage(buffer, 'deals/banners');

  const deal = await prisma.deal.update({
    where: { id },
    data: { bannerUrl: url },
    include: dealIncludes(),
  });

  return deal;
}

// === Affiliate URL Composition ===

export function composeDealUrl(deal: { affiliateBaseUrl: string; store?: { affiliateTag: string } | null }): string {
  const baseUrl = deal.affiliateBaseUrl;
  const tag = deal.store?.affiliateTag;

  if (!tag) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);

    // Check if the tag is already present in the URL
    if (url.search.includes(tag) || url.href.includes(tag)) {
      return baseUrl;
    }

    // Append the affiliate tag as a query parameter
    // Use 'tag' as the parameter name (common for Amazon-style affiliate links)
    url.searchParams.set('tag', tag);

    return url.toString();
  } catch {
    // If URL parsing fails, append as query string manually
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}tag=${encodeURIComponent(tag)}`;
  }
}
