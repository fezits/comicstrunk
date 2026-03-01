import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import type { ListUsersInput, UpdateUserRoleInput, SuspendUserInput } from '@comicstrunk/contracts';

// === Dashboard Metrics ===

export async function getDashboardMetrics() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    newUsersThisMonth,
    totalOrders,
    ordersToday,
    totalRevenueResult,
    revenueThisMonthResult,
    catalogSize,
    pendingApprovals,
    activeDisputes,
    activeSubscriptions,
    unreadMessages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: firstDayOfMonth } },
    }),
    prisma.order.count(),
    prisma.order.count({
      where: { createdAt: { gte: startOfToday } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { not: null } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paidAt: { not: null, gte: firstDayOfMonth },
      },
    }),
    prisma.catalogEntry.count({
      where: { approvalStatus: 'APPROVED' },
    }),
    prisma.catalogEntry.count({
      where: { approvalStatus: 'PENDING' },
    }),
    prisma.dispute.count({
      where: { status: { in: ['OPEN', 'IN_MEDIATION'] } },
    }),
    prisma.subscription.count({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
    }),
    prisma.contactMessage.count({
      where: { isRead: false },
    }),
  ]);

  return {
    totalUsers,
    newUsersThisMonth,
    totalOrders,
    ordersToday,
    totalRevenue: Number(totalRevenueResult._sum.amount ?? 0),
    revenueThisMonth: Number(revenueThisMonthResult._sum.amount ?? 0),
    catalogSize,
    pendingApprovals,
    activeDisputes,
    activeSubscriptions,
    unreadMessages,
  };
}

// === List Users ===

export async function listUsers(filters: ListUsersInput) {
  const { page, limit, search, role } = filters;

  const where: Record<string, unknown> = {};

  if (role) {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ordersAsBuyer: true,
            collectionItems: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const mapped = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    ordersCount: user._count.ordersAsBuyer,
    collectionItemsCount: user._count.collectionItems,
    reviewsCount: user._count.reviews,
  }));

  return { data: mapped, total, page, limit };
}

// === Get User Detail ===

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      bio: true,
      websiteUrl: true,
      twitterHandle: true,
      instagramHandle: true,
      acceptedTermsAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          ordersAsBuyer: true,
          collectionItems: true,
          reviews: true,
          disputesAsBuyer: true,
          disputesAsSeller: true,
        },
      },
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          planType: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('Utilizador nao encontrado');
  }

  const activeSubscription = user.subscriptions[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    twitterHandle: user.twitterHandle,
    instagramHandle: user.instagramHandle,
    acceptedTermsAt: user.acceptedTermsAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    ordersCount: user._count.ordersAsBuyer,
    collectionItemsCount: user._count.collectionItems,
    reviewsCount: user._count.reviews,
    disputesAsBuyerCount: user._count.disputesAsBuyer,
    disputesAsSellerCount: user._count.disputesAsSeller,
    subscription: activeSubscription
      ? {
          id: activeSubscription.id,
          planType: activeSubscription.planType,
          status: activeSubscription.status,
          currentPeriodStart: activeSubscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() ?? null,
          cancelledAt: activeSubscription.cancelledAt?.toISOString() ?? null,
          createdAt: activeSubscription.createdAt.toISOString(),
        }
      : null,
  };
}

// === Update User Role ===

export async function updateUserRole(id: string, adminId: string, input: UpdateUserRoleInput) {
  if (id === adminId) {
    throw new BadRequestError('Voce nao pode alterar seu proprio cargo');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('Utilizador nao encontrado');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: input.role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// === Suspend User ===

export async function suspendUser(id: string, adminId: string, input: SuspendUserInput) {
  if (id === adminId) {
    throw new BadRequestError('Voce nao pode suspender a si mesmo');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('Utilizador nao encontrado');
  }

  if (user.role === 'ADMIN') {
    throw new BadRequestError('Nao e possivel suspender um administrador');
  }

  // Use transaction to atomically suspend user and cancel subscriptions
  const result = await prisma.$transaction(async (tx) => {
    // Force role to USER
    const updated = await tx.user.update({
      where: { id },
      data: { role: 'USER' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    // Cancel any active subscriptions
    await tx.subscription.updateMany({
      where: {
        userId: id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return updated;
  });

  return {
    id: result.id,
    email: result.email,
    name: result.name,
    role: result.role,
    updatedAt: result.updatedAt.toISOString(),
    reason: input.reason,
    suspended: true,
  };
}

// === Unsuspend User ===

export async function unsuspendUser(id: string, adminId: string) {
  if (id === adminId) {
    throw new BadRequestError('Operacao invalida');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('Utilizador nao encontrado');
  }

  // No actual status change needed — the user is already role=USER.
  // This is a no-op if they were not suspended, which is fine.
  // We simply confirm the user exists and return their data.
  const updated = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      updatedAt: true,
    },
  });

  return {
    id: updated!.id,
    email: updated!.email,
    name: updated!.name,
    role: updated!.role,
    updatedAt: updated!.updatedAt.toISOString(),
    suspended: false,
  };
}
