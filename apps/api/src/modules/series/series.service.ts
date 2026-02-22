import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import type { CreateSeriesInput, UpdateSeriesInput, SeriesSearchInput } from '@comicstrunk/contracts';

// === List Series ===

export async function listSeries(filters: SeriesSearchInput) {
  const { title, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (title) {
    where.title = { contains: title };
  }

  const [data, total] = await Promise.all([
    prisma.series.findMany({
      where,
      skip,
      take: limit,
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { catalogEntries: true } },
      },
    }),
    prisma.series.count({ where }),
  ]);

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
          volumeNumber: true,
          editionNumber: true,
          coverImageUrl: true,
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

  return series;
}

// === Create Series ===

export async function createSeries(data: CreateSeriesInput) {
  return prisma.series.create({ data });
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
