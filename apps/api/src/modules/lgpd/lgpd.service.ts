import { DataRequestStatus, DataRequestType } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/api-error';

// ============================================================================
// USER: Create Data Request
// ============================================================================

export async function createDataRequest(
  userId: string,
  data: { type: DataRequestType; details?: string },
) {
  // Prevent duplicate PENDING requests of the same type for the same user
  const existing = await prisma.dataRequest.findFirst({
    where: {
      userId,
      type: data.type,
      status: 'PENDING',
    },
  });

  if (existing) {
    throw new ConflictError(
      'Voce ja possui uma solicitacao pendente deste tipo. Aguarde o processamento.',
    );
  }

  return prisma.dataRequest.create({
    data: {
      userId,
      type: data.type,
      status: 'PENDING',
      details: data.details ?? null,
    },
  });
}

// ============================================================================
// USER: List User Requests (paginated)
// ============================================================================

export async function listUserRequests(
  userId: string,
  page: number,
  limit: number,
) {
  const where = { userId };

  const [requests, total] = await Promise.all([
    prisma.dataRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dataRequest.count({ where }),
  ]);

  return { requests, total, page, limit };
}

// ============================================================================
// ADMIN: List All Requests (filtered, paginated)
// ============================================================================

export async function listAllRequests(
  filters: { status?: DataRequestStatus; type?: DataRequestType },
  page: number,
  limit: number,
) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [requests, total] = await Promise.all([
    prisma.dataRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dataRequest.count({ where }),
  ]);

  return { requests, total, page, limit };
}

// ============================================================================
// ADMIN: Process Request (set status = PROCESSING)
// ============================================================================

export async function processRequest(id: string) {
  const request = await prisma.dataRequest.findUnique({ where: { id } });
  if (!request) {
    throw new NotFoundError('Solicitacao nao encontrada.');
  }

  if (request.status !== 'PENDING') {
    throw new BadRequestError(
      'Apenas solicitacoes com status PENDENTE podem ser processadas.',
    );
  }

  return prisma.dataRequest.update({
    where: { id },
    data: { status: 'PROCESSING' },
  });
}

// ============================================================================
// ADMIN: Complete Request
// ============================================================================

export async function completeRequest(id: string) {
  const request = await prisma.dataRequest.findUnique({ where: { id } });
  if (!request) {
    throw new NotFoundError('Solicitacao nao encontrada.');
  }

  if (request.status !== 'PROCESSING') {
    throw new BadRequestError(
      'Apenas solicitacoes em processamento podem ser concluidas.',
    );
  }

  return prisma.dataRequest.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

// ============================================================================
// ADMIN: Reject Request
// ============================================================================

export async function rejectRequest(id: string, reason: string) {
  const request = await prisma.dataRequest.findUnique({ where: { id } });
  if (!request) {
    throw new NotFoundError('Solicitacao nao encontrada.');
  }

  if (request.status !== 'PENDING' && request.status !== 'PROCESSING') {
    throw new BadRequestError(
      'Apenas solicitacoes pendentes ou em processamento podem ser rejeitadas.',
    );
  }

  return prisma.dataRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      details: reason,
    },
  });
}

// ============================================================================
// USER: Export User Data (LGPD data portability)
// ============================================================================

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('Usuario nao encontrado.');
  }

  // Fetch all user-related data in parallel
  const [
    collectionItems,
    orders,
    reviews,
    comments,
    favorites,
    shippingAddresses,
    subscriptions,
    notificationPreferences,
    legalAcceptances,
  ] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId },
      include: {
        catalogEntry: { select: { title: true } },
      },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        orderItems: {
          include: {
            collectionItem: {
              include: {
                catalogEntry: { select: { title: true } },
              },
            },
          },
        },
      },
    }),
    prisma.review.findMany({
      where: { userId },
      include: {
        catalogEntry: { select: { title: true } },
      },
    }),
    prisma.comment.findMany({
      where: { userId },
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: {
        catalogEntry: { select: { title: true } },
      },
    }),
    prisma.shippingAddress.findMany({
      where: { userId },
    }),
    prisma.subscription.findMany({
      where: { userId },
    }),
    prisma.notificationPreference.findMany({
      where: { userId },
    }),
    prisma.legalAcceptance.findMany({
      where: { userId },
      include: {
        document: { select: { type: true, version: true } },
      },
    }),
  ]);

  return {
    profile: {
      name: user.name,
      email: user.email,
      bio: user.bio,
      websiteUrl: user.websiteUrl,
      twitterHandle: user.twitterHandle,
      instagramHandle: user.instagramHandle,
      createdAt: user.createdAt,
    },
    collectionItems: collectionItems.map((item) => ({
      title: item.catalogEntry.title,
      condition: item.condition,
      pricePaid: item.pricePaid,
      notes: item.notes,
      readAt: item.readAt,
    })),
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      total: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      items: order.orderItems.map((oi) => ({
        title: oi.collectionItem.catalogEntry.title,
        price: oi.priceSnapshot,
      })),
    })),
    reviews: reviews.map((review) => ({
      rating: review.rating,
      comment: review.text,
      createdAt: review.createdAt,
      catalogTitle: review.catalogEntry?.title ?? null,
    })),
    comments: comments.map((comment) => ({
      content: comment.content,
      createdAt: comment.createdAt,
    })),
    favorites: favorites.map((fav) => ({
      catalogTitle: fav.catalogEntry.title,
      addedAt: fav.createdAt,
    })),
    shippingAddresses: shippingAddresses.map((addr) => ({
      label: addr.label,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zipCode,
    })),
    subscriptionHistory: subscriptions.map((sub) => ({
      planType: sub.planType,
      status: sub.status,
      startedAt: sub.currentPeriodStart,
      endedAt: sub.currentPeriodEnd,
    })),
    notificationPreferences: notificationPreferences.map((pref) => ({
      type: pref.type,
      enabled: pref.enabled,
    })),
    legalAcceptances: legalAcceptances.map((acc) => ({
      documentType: acc.document.type,
      version: acc.document.version,
      acceptedAt: acc.acceptedAt,
    })),
  };
}

// ============================================================================
// USER: Schedule Account Deletion
// ============================================================================

export async function scheduleAccountDeletion(userId: string) {
  // Validate no pending deletion already exists
  const existingDeletion = await prisma.dataRequest.findFirst({
    where: {
      userId,
      type: 'DELETION',
      status: { in: ['PENDING', 'PROCESSING'] },
    },
  });

  if (existingDeletion) {
    throw new ConflictError(
      'Voce ja possui uma solicitacao de exclusao pendente. Aguarde o processamento.',
    );
  }

  return prisma.dataRequest.create({
    data: {
      userId,
      type: 'DELETION',
      status: 'PENDING',
      details: 'Solicitacao de exclusao de conta agendada pelo usuario.',
    },
  });
}

// ============================================================================
// SYSTEM: Execute Account Deletion (anonymization)
// ============================================================================

export async function executeAccountDeletion(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('Usuario nao encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete records that have onDelete: Cascade or are safe to remove entirely
    //    These are personal data records that should not be preserved.

    // RefreshTokens (CASCADE on user delete, but we do it explicitly in transaction)
    await tx.refreshToken.deleteMany({ where: { userId } });

    // PasswordResets (CASCADE on user delete)
    await tx.passwordReset.deleteMany({ where: { userId } });

    // CartItems (CASCADE on user delete)
    await tx.cartItem.deleteMany({ where: { userId } });

    // ShippingAddresses (CASCADE on user delete)
    await tx.shippingAddress.deleteMany({ where: { userId } });

    // BankAccounts (CASCADE on user delete)
    await tx.bankAccount.deleteMany({ where: { userId } });

    // Notifications (CASCADE on user delete)
    await tx.notification.deleteMany({ where: { userId } });

    // NotificationPreferences (CASCADE on user delete)
    await tx.notificationPreference.deleteMany({ where: { userId } });

    // Favorites (CASCADE on user delete)
    await tx.favorite.deleteMany({ where: { userId } });

    // CommentLikes (CASCADE on user delete)
    await tx.commentLike.deleteMany({ where: { userId } });

    // ClickLogs — anonymize by setting userId to null (optional relation)
    await tx.clickLog.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // CollectionItems — need to handle orderItems references first
    // Remove collection items that are NOT referenced by order items
    // For those referenced by orders, we keep them (order history preservation)
    const collectionItemsWithOrders = await tx.collectionItem.findMany({
      where: { userId },
      select: {
        id: true,
        orderItems: { select: { id: true }, take: 1 },
      },
    });

    const unreferencedItemIds = collectionItemsWithOrders
      .filter((ci) => ci.orderItems.length === 0)
      .map((ci) => ci.id);

    if (unreferencedItemIds.length > 0) {
      await tx.collectionItem.deleteMany({
        where: { id: { in: unreferencedItemIds } },
      });
    }

    // 2. Anonymize the user record
    //    Preserve: orders, disputes, subscriptions, legalAcceptances, dataRequests, reviews, comments
    //    Reviews and comments will show "Conta Excluida" as the user name through the FK relation.
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Conta Excluida',
        email: `deleted-${userId}@deleted.comicstrunk.com`,
        passwordHash: 'DELETED',
        bio: null,
        avatarUrl: null,
        websiteUrl: null,
        twitterHandle: null,
        instagramHandle: null,
      },
    });
  });
}
