import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { composeDealUrl } from './deals.service';

// === Open-Redirect Protection ===

/**
 * Validates that the composed redirect URL belongs to the partner store's domain.
 * Prevents open-redirect attacks where a manipulated affiliateBaseUrl could redirect
 * users to a malicious domain.
 */
function validateRedirectUrl(redirectUrl: string, storeBaseUrl: string): void {
  try {
    const redirect = new URL(redirectUrl);
    const store = new URL(storeBaseUrl);

    const redirectHost = redirect.hostname.toLowerCase();
    const storeHost = store.hostname.toLowerCase();

    // Allow exact match or subdomain match (e.g., "www.amazon.com.br" matches "amazon.com.br")
    const isValid = redirectHost === storeHost || redirectHost.endsWith(`.${storeHost}`);

    if (!isValid) {
      throw new BadRequestError('URL de redirecionamento inválida');
    }
  } catch (err) {
    // If it's already our BadRequestError, rethrow it
    if (err instanceof BadRequestError) {
      throw err;
    }
    // URL parsing failed — reject the redirect
    throw new BadRequestError('URL de redirecionamento inválida');
  }
}

// === Click Tracking ===

export async function trackClick(
  dealId: string,
  userId: string | null,
  ipAddress: string,
  userAgent: string | null,
): Promise<string> {
  // 1. Validate deal exists and is active
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { store: true },
  });

  if (!deal || !deal.isActive) {
    throw new NotFoundError('Oferta não encontrada');
  }

  // 2. Deduplication: check same user+deal or IP+deal within last 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const existingClick = await prisma.clickLog.findFirst({
    where: {
      dealId,
      createdAt: { gte: oneHourAgo },
      ...(userId ? { userId } : { ipAddress, userId: null }),
    },
  });

  // 3. If not duplicate, create ClickLog
  if (!existingClick) {
    await prisma.clickLog.create({
      data: {
        dealId,
        userId,
        ipAddress,
        userAgent,
      },
    });
  }

  // 4. Compose redirect URL and validate against store domain
  const affiliateUrl = composeDealUrl(deal);
  validateRedirectUrl(affiliateUrl, deal.store.baseUrl);

  return affiliateUrl;
}

// === Analytics ===

interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  storeId?: string;
}

export async function getClickAnalytics(filters: AnalyticsFilters) {
  const where: Record<string, unknown> = {};

  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) createdAt.gte = filters.startDate;
    if (filters.endDate) createdAt.lte = filters.endDate;
    where.createdAt = createdAt;
  }

  if (filters.storeId) {
    where.deal = { storeId: filters.storeId };
  }

  // Total clicks
  const totalClicks = await prisma.clickLog.count({ where });

  // Unique users (non-null userId)
  const uniqueUsers = await prisma.clickLog.groupBy({
    by: ['userId'],
    where: { ...where, userId: { not: null } },
  });

  // Clicks by deal
  const clicksByDeal = await prisma.clickLog.groupBy({
    by: ['dealId'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // Resolve deal details for the aggregated results
  const dealIds = clicksByDeal.map((c) => c.dealId);
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds } },
    select: {
      id: true,
      title: true,
      store: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  const dealMap = new Map(deals.map((d) => [d.id, d]));

  // Aggregate clicks by store and category
  const storeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const c of clicksByDeal) {
    const deal = dealMap.get(c.dealId);
    if (deal?.store) {
      storeMap.set(deal.store.name, (storeMap.get(deal.store.name) || 0) + c._count.id);
    }
    if (deal?.category) {
      categoryMap.set(deal.category.name, (categoryMap.get(deal.category.name) || 0) + c._count.id);
    }
  }

  return {
    totalClicks,
    uniqueUsers: uniqueUsers.length,
    clicksByDeal: clicksByDeal.map((c) => ({
      dealId: c.dealId,
      dealTitle: dealMap.get(c.dealId)?.title || 'Desconhecido',
      storeName: dealMap.get(c.dealId)?.store?.name || 'Desconhecido',
      categoryName: dealMap.get(c.dealId)?.category?.name || null,
      clicks: c._count.id,
    })),
    clicksByStore: Array.from(storeMap.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
    clicksByCategory: Array.from(categoryMap.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
  };
}

// === CSV Export ===

export async function exportClicksCSV(filters: { startDate?: Date; endDate?: Date }) {
  const analytics = await getClickAnalytics(filters);

  const header = 'Oferta,Loja,Categoria,Cliques';
  const rows = analytics.clicksByDeal.map(
    (c) => `"${c.dealTitle}","${c.storeName}","${c.categoryName || 'N/A'}",${c.clicks}`,
  );

  return [header, ...rows].join('\n');
}
