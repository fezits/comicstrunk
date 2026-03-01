import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../shared/utils/api-error';
import type {
  CreateCatalogReviewInput,
  CreateSellerReviewInput,
  UpdateReviewInput,
} from '@comicstrunk/contracts';

// === Helper: Recalculate catalog entry average rating ===

async function recalculateCatalogRating(catalogEntryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const aggregation = await tx.review.aggregate({
      where: { catalogEntryId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.catalogEntry.update({
      where: { id: catalogEntryId },
      data: {
        averageRating: aggregation._avg.rating ?? 0,
        ratingCount: aggregation._count.rating,
      },
    });
  });
}

// === Standard includes for review queries ===

function reviewIncludes() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    },
  };
}

// === Catalog Review CRUD ===

export async function createCatalogReview(
  userId: string,
  data: CreateCatalogReviewInput,
) {
  // Verify catalog entry exists and is APPROVED
  const catalogEntry = await prisma.catalogEntry.findUnique({
    where: { id: data.catalogEntryId },
  });

  if (!catalogEntry) {
    throw new NotFoundError('Catalog entry not found');
  }

  if (catalogEntry.approvalStatus !== 'APPROVED') {
    throw new BadRequestError('Cannot review a catalog entry that is not approved');
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId,
        catalogEntryId: data.catalogEntryId,
        rating: data.rating,
        text: data.text || null,
      },
      include: reviewIncludes(),
    });

    // Recalculate average rating after creation
    await recalculateCatalogRating(data.catalogEntryId);

    return review;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('You have already reviewed this catalog entry');
    }
    throw error;
  }
}

export async function createSellerReview(
  userId: string,
  data: CreateSellerReviewInput,
) {
  // Fetch the order
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: {
      orderItems: true,
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Verify the reviewer is the buyer
  if (order.buyerId !== userId) {
    throw new ForbiddenError('Only the buyer can review a seller');
  }

  // Verify order is COMPLETED
  if (order.status !== 'COMPLETED') {
    throw new BadRequestError('Can only review seller after order is completed');
  }

  // Verify sellerId appears in order items
  const sellerInOrder = order.orderItems.some(
    (item) => item.sellerId === data.sellerId,
  );

  if (!sellerInOrder) {
    throw new BadRequestError('Seller is not part of this order');
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId,
        sellerId: data.sellerId,
        orderId: data.orderId,
        rating: data.rating,
        text: data.text || null,
      },
      include: reviewIncludes(),
    });

    return review;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('You have already reviewed this seller for this order');
    }
    throw error;
  }
}

export async function updateReview(
  userId: string,
  reviewId: string,
  data: UpdateReviewInput,
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  if (review.userId !== userId) {
    throw new ForbiddenError('You can only edit your own reviews');
  }

  const updateData: Record<string, unknown> = {};
  if (data.rating !== undefined) {
    updateData.rating = data.rating;
  }
  if (data.text !== undefined) {
    updateData.text = data.text;
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: updateData,
    include: reviewIncludes(),
  });

  // If it's a catalog review, recalculate rating
  if (review.catalogEntryId) {
    await recalculateCatalogRating(review.catalogEntryId);
  }

  return updated;
}

export async function deleteReview(userId: string, reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  if (review.userId !== userId) {
    throw new ForbiddenError('You can only delete your own reviews');
  }

  await prisma.review.delete({ where: { id: reviewId } });

  // If it's a catalog review, recalculate rating
  if (review.catalogEntryId) {
    await recalculateCatalogRating(review.catalogEntryId);
  }
}

// === Catalog Review Queries ===

export async function getCatalogReviews(
  catalogEntryId: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { catalogEntryId },
      include: reviewIncludes(),
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { catalogEntryId } }),
  ]);

  return { reviews, total, page, limit };
}

// === Seller Review Queries ===

export async function getSellerReviews(
  sellerId: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;

  const [reviews, total, aggregation] = await Promise.all([
    prisma.review.findMany({
      where: { sellerId },
      include: reviewIncludes(),
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { sellerId } }),
    prisma.review.aggregate({
      where: { sellerId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  return {
    reviews,
    total,
    page,
    limit,
    averageRating: aggregation._avg.rating ?? 0,
    ratingCount: aggregation._count.rating,
  };
}

export async function getSellerAverageRating(sellerId: string) {
  const aggregation = await prisma.review.aggregate({
    where: { sellerId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    averageRating: aggregation._avg.rating ?? 0,
    ratingCount: aggregation._count.rating,
  };
}

// === User's Own Review for a Catalog Entry ===

export async function getUserReviewForCatalog(
  userId: string,
  catalogEntryId: string,
) {
  const review = await prisma.review.findUnique({
    where: {
      userId_catalogEntryId: {
        userId,
        catalogEntryId,
      },
    },
    include: reviewIncludes(),
  });

  return review;
}
