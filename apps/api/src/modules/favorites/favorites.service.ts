import { prisma } from '../../shared/lib/prisma';
import { NotFoundError } from '../../shared/utils/api-error';

// === Toggle Favorite ===

export async function toggleFavorite(userId: string, catalogEntryId: string) {
  // Verify catalog entry exists and is APPROVED
  const catalogEntry = await prisma.catalogEntry.findUnique({
    where: { id: catalogEntryId },
  });

  if (!catalogEntry || catalogEntry.approvalStatus !== 'APPROVED') {
    throw new NotFoundError('Catalog entry not found or not approved');
  }

  // Check if favorite exists
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_catalogEntryId: { userId, catalogEntryId },
    },
  });

  if (existing) {
    // Remove favorite
    await prisma.favorite.delete({
      where: { id: existing.id },
    });
    return { favorited: false };
  } else {
    // Add favorite
    await prisma.favorite.create({
      data: { userId, catalogEntryId },
    });
    return { favorited: true };
  }
}

// === Get User Favorites (paginated) ===

export async function getUserFavorites(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const where = { userId };

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        catalogEntry: {
          select: {
            id: true,
            title: true,
            slug: true,
            author: true,
            publisher: true,
            coverImageUrl: true,
            averageRating: true,
            ratingCount: true,
            series: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    prisma.favorite.count({ where }),
  ]);

  return { data: favorites, total, page, limit };
}

// === Check If Favorited ===

export async function checkIsFavorited(userId: string, catalogEntryId: string) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_catalogEntryId: { userId, catalogEntryId },
    },
  });

  return { isFavorited: !!favorite };
}
