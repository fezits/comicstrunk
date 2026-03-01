import { prisma } from '../../shared/lib/prisma';
import { NotFoundError } from '../../shared/utils/api-error';
import type { CreateHomepageSectionInput, UpdateHomepageSectionInput } from '@comicstrunk/contracts';

// ============================================================================
// Type for contentRefs JSON field
// ============================================================================

interface ContentRefs {
  dealIds?: string[];
  catalogIds?: string[];
}

// ============================================================================
// Admin CRUD Operations
// ============================================================================

/** List all sections sorted by sortOrder (admin view — includes hidden) */
export async function listSections() {
  return prisma.homepageSection.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

/** Create a new homepage section */
export async function createSection(data: CreateHomepageSectionInput) {
  return prisma.homepageSection.create({
    data: {
      type: data.type,
      title: data.title ?? null,
      sortOrder: data.sortOrder,
      isVisible: data.isVisible ?? true,
      contentRefs: data.contentRefs ?? {},
    },
  });
}

/** Update an existing homepage section */
export async function updateSection(id: string, data: UpdateHomepageSectionInput) {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Secao da homepage nao encontrada');
  }

  return prisma.homepageSection.update({
    where: { id },
    data: {
      type: data.type,
      title: data.title,
      sortOrder: data.sortOrder,
      isVisible: data.isVisible,
      contentRefs: data.contentRefs !== undefined ? data.contentRefs ?? {} : undefined,
    },
  });
}

/** Delete a homepage section */
export async function deleteSection(id: string) {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Secao da homepage nao encontrada');
  }

  return prisma.homepageSection.delete({ where: { id } });
}

/** Bulk reorder sections — set sortOrder = index for each id */
export async function reorderSections(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.homepageSection.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  return prisma.homepageSection.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

// ============================================================================
// Public Homepage Data Assembly
// ============================================================================

/** Assemble full homepage data: visible sections with resolved content */
export async function getHomepageData() {
  const sections = await prisma.homepageSection.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: 'asc' },
  });

  const result = await Promise.all(
    sections.map(async (section) => {
      const refs = (section.contentRefs as ContentRefs) ?? {};
      let items: unknown[] = [];

      switch (section.type) {
        case 'BANNER_CAROUSEL':
          items = await resolveBannerCarousel(refs);
          break;
        case 'CATALOG_HIGHLIGHTS':
          items = await resolveCatalogHighlights(refs);
          break;
        case 'DEALS_OF_DAY':
          items = await resolveDealsOfDay(refs);
          break;
        case 'FEATURED_COUPONS':
          items = await resolveFeaturedCoupons(refs);
          break;
      }

      return {
        id: section.id,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        items,
      };
    }),
  );

  return result;
}

// ============================================================================
// Content Resolvers
// ============================================================================

const dealSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  couponCode: true,
  discount: true,
  bannerUrl: true,
  affiliateBaseUrl: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
  store: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  },
};

const catalogSelect = {
  id: true,
  title: true,
  coverImageUrl: true,
  averageRating: true,
  ratingCount: true,
  author: true,
  publisher: true,
  series: {
    select: {
      id: true,
      title: true,
    },
  },
};

/**
 * BANNER_CAROUSEL:
 * - If contentRefs.dealIds → fetch those deals with bannerUrl
 * - If contentRefs.catalogIds → fetch those catalog entries with coverUrl
 * - Fallback: latest 5 active deals with bannerUrl
 */
async function resolveBannerCarousel(refs: ContentRefs) {
  if (refs.dealIds?.length) {
    return prisma.deal.findMany({
      where: { id: { in: refs.dealIds }, isActive: true },
      select: dealSelect,
    });
  }

  if (refs.catalogIds?.length) {
    return prisma.catalogEntry.findMany({
      where: { id: { in: refs.catalogIds }, approvalStatus: 'APPROVED' },
      select: catalogSelect,
    });
  }

  // Fallback: latest 5 active deals with a banner
  return prisma.deal.findMany({
    where: {
      isActive: true,
      bannerUrl: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: dealSelect,
  });
}

/**
 * CATALOG_HIGHLIGHTS:
 * - If contentRefs.catalogIds → fetch those
 * - Fallback: top 8 approved catalog entries by rating
 */
async function resolveCatalogHighlights(refs: ContentRefs) {
  if (refs.catalogIds?.length) {
    return prisma.catalogEntry.findMany({
      where: { id: { in: refs.catalogIds }, approvalStatus: 'APPROVED' },
      select: catalogSelect,
    });
  }

  // Fallback: top 8 by average rating
  return prisma.catalogEntry.findMany({
    where: { approvalStatus: 'APPROVED' },
    orderBy: [{ averageRating: 'desc' }, { ratingCount: 'desc' }],
    take: 8,
    select: catalogSelect,
  });
}

/**
 * DEALS_OF_DAY:
 * - If contentRefs.dealIds → fetch those
 * - Fallback: active deals expiring soonest (up to 6)
 */
async function resolveDealsOfDay(refs: ContentRefs) {
  if (refs.dealIds?.length) {
    return prisma.deal.findMany({
      where: { id: { in: refs.dealIds }, isActive: true },
      select: dealSelect,
    });
  }

  // Fallback: active deals expiring soonest
  return prisma.deal.findMany({
    where: {
      isActive: true,
      expiresAt: { gte: new Date() },
    },
    orderBy: { expiresAt: 'asc' },
    take: 6,
    select: dealSelect,
  });
}

/**
 * FEATURED_COUPONS:
 * - If contentRefs.dealIds → fetch those
 * - Fallback: active COUPON type deals (up to 6)
 */
async function resolveFeaturedCoupons(refs: ContentRefs) {
  if (refs.dealIds?.length) {
    return prisma.deal.findMany({
      where: { id: { in: refs.dealIds }, isActive: true },
      select: dealSelect,
    });
  }

  // Fallback: active coupon deals
  return prisma.deal.findMany({
    where: {
      isActive: true,
      type: 'COUPON',
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: dealSelect,
  });
}
