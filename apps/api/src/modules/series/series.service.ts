import { prisma } from '../../shared/lib/prisma';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { uniqueSlug } from '../../shared/utils/slug';
import type { CreateSeriesInput, UpdateSeriesInput, SeriesSearchInput } from '@comicstrunk/contracts';

function isCuid(str: string): boolean {
  return /^c[a-z0-9]{24}$/.test(str);
}

// === List Series ===

export async function listSeries(filters: SeriesSearchInput) {
  const { title, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (title) {
    where.title = { contains: title };
  }

  const [rawData, total] = await Promise.all([
    prisma.series.findMany({
      where,
      skip,
      take: limit,
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { catalogEntries: true } },
        catalogEntries: {
          select: { publishYear: true },
          where: { publishYear: { not: null } },
          orderBy: { publishYear: 'asc' },
          take: 1,
        },
      },
    }),
    prisma.series.count({ where }),
  ]);

  const data = rawData.map(s => ({
    ...s,
    yearBegan: s.catalogEntries[0]?.publishYear ?? null,
    catalogEntries: undefined,
  }));

  return { data, total, page, limit };
}

// === Get Series by ID ===

export async function getSeriesById(id: string) {
  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      catalogEntries: {
        where: { approvalStatus: 'APPROVED' },
        orderBy: { editionNumber: 'asc' },
        select: {
          id: true,
          title: true,
          slug: true,
          volumeNumber: true,
          editionNumber: true,
          coverImageUrl: true,
          coverFileName: true,
          author: true,
          publisher: true,
          averageRating: true,
          ratingCount: true,
        },
      },
    },
  });

  if (!series) {
    throw new NotFoundError('Series not found');
  }

  return { ...series, catalogEntries: series.catalogEntries.map(resolveCoverUrl) };
}

// === Get Series by ID or Slug ===

export async function getSeriesByIdOrSlug(idOrSlug: string) {
  const where = isCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };

  const series = await prisma.series.findFirst({
    where,
    include: {
      catalogEntries: {
        where: { approvalStatus: 'APPROVED' },
        orderBy: { editionNumber: 'asc' },
        select: {
          id: true,
          title: true,
          slug: true,
          volumeNumber: true,
          editionNumber: true,
          coverImageUrl: true,
          coverFileName: true,
          author: true,
          publisher: true,
          averageRating: true,
          ratingCount: true,
        },
      },
    },
  });

  if (!series) {
    throw new NotFoundError('Series not found');
  }

  return { ...series, catalogEntries: series.catalogEntries.map(resolveCoverUrl) };
}

// === Create Series ===

export async function createSeries(data: CreateSeriesInput) {
  const slug = await uniqueSlug(data.title, 'series');
  return prisma.series.create({ data: { ...data, slug } });
}

// === Update Series ===

export async function updateSeries(id: string, data: UpdateSeriesInput) {
  const existing = await prisma.series.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Series not found');
  }

  return prisma.series.update({ where: { id }, data });
}

// === Delete Series ===

export async function deleteSeries(id: string) {
  const existing = await prisma.series.findUnique({
    where: { id },
    include: { _count: { select: { catalogEntries: true } } },
  });

  if (!existing) {
    throw new NotFoundError('Series not found');
  }

  if (existing._count.catalogEntries > 0) {
    throw new BadRequestError('Cannot delete series with existing catalog entries');
  }

  await prisma.series.delete({ where: { id } });
}
