import { prisma } from '../../shared/lib/prisma';
import { assertOrderItemTransition } from '../../shared/lib/order-state-machine';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../shared/utils/api-error';
import { createNotification } from '../notifications/notifications.service';
import { refundPayment } from '../payments/payments.service';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';
import type {
  CreateDisputeInput,
  SubmitDisputeResponseInput,
  ResolveDisputeInput,
  AddDisputeMessageInput,
} from '@comicstrunk/contracts';

// === Standard includes for dispute queries ===

function disputeIncludes() {
  return {
    buyer: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    },
    seller: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    },
    orderItem: {
      include: {
        collectionItem: {
          include: {
            catalogEntry: {
              select: {
                id: true,
                title: true,
                coverImageUrl: true,
                coverFileName: true,
              },
            },
          },
        },
      },
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    },
    evidence: {
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' as const },
    },
    messages: {
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' as const },
    },
  };
}

/** Resolve cover URLs for the catalog entry nested inside a dispute's orderItem */
function resolveDisputeCovers<T extends {
  orderItem: {
    collectionItem: { catalogEntry: { coverImageUrl: string | null; coverFileName?: string | null } } | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}>(dispute: T): T {
  if (!dispute.orderItem?.collectionItem?.catalogEntry) return dispute;
  return {
    ...dispute,
    orderItem: {
      ...dispute.orderItem,
      collectionItem: {
        ...dispute.orderItem.collectionItem,
        catalogEntry: resolveCoverUrl(dispute.orderItem.collectionItem.catalogEntry),
      },
    },
  };
}

// === Create Dispute ===

export async function createDispute(buyerId: string, data: CreateDisputeInput) {
  const dispute = await prisma.$transaction(async (tx) => {
    // 1. Find the order item with its order
    const orderItem = await tx.orderItem.findUnique({
      where: { id: data.orderItemId },
      include: {
        order: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundError('Item do pedido não encontrado');
    }

    // 2. Verify the buyer owns the order
    if (orderItem.order.buyerId !== buyerId) {
      throw new ForbiddenError('Você não tem permissão para abrir disputa neste item');
    }

    // 3. Validate state transition (item must be SHIPPED or DELIVERED to go to DISPUTED)
    assertOrderItemTransition(orderItem.status, 'DISPUTED');

    // 4. Check time window
    const now = new Date();
    if (orderItem.deliveredAt) {
      // If delivered, must be within 7 days
      const daysSinceDelivery =
        (now.getTime() - orderItem.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > 7) {
        throw new BadRequestError(
          'O prazo para abrir disputa expirou. Disputas devem ser abertas em até 7 dias após a entrega.',
        );
      }
    } else {
      // If not delivered yet, check within 30 days of shippedAt or createdAt
      const referenceDate = orderItem.shippedAt ?? orderItem.createdAt;
      const daysSinceReference =
        (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReference > 30) {
        throw new BadRequestError(
          'O prazo para abrir disputa expirou. Disputas devem ser abertas em até 30 dias.',
        );
      }
    }

    // 5. Check for existing open/in-mediation dispute on the same order item
    const existingDispute = await tx.dispute.findFirst({
      where: {
        orderItemId: data.orderItemId,
        status: { in: ['OPEN', 'IN_MEDIATION'] },
      },
    });

    if (existingDispute) {
      throw new ConflictError('Já existe uma disputa aberta para este item do pedido');
    }

    // 6. Create the dispute record
    const created = await tx.dispute.create({
      data: {
        orderId: orderItem.orderId,
        orderItemId: data.orderItemId,
        buyerId,
        sellerId: orderItem.sellerId,
        reason: data.reason,
        description: data.description,
        status: 'OPEN',
      },
      include: disputeIncludes(),
    });

    // 7. Update order item status to DISPUTED
    await tx.orderItem.update({
      where: { id: data.orderItemId },
      data: { status: 'DISPUTED' },
    });

    // 8. Check if ALL order items are now DISPUTED; if so, update the order
    const allItems = await tx.orderItem.findMany({
      where: { orderId: orderItem.orderId },
    });
    const allDisputed = allItems.every((item) => item.status === 'DISPUTED');
    if (allDisputed) {
      await tx.order.update({
        where: { id: orderItem.orderId },
        data: { status: 'DISPUTED' },
      });
    }

    return created;
  });

  // Fire-and-forget: notify seller about dispute
  createNotification({
    userId: dispute.sellerId,
    type: 'DISPUTE_OPENED',
    title: 'Disputa aberta',
    message: `Uma disputa foi aberta para um item do pedido #${dispute.order.orderNumber}.`,
    metadata: { disputeId: dispute.id, orderId: dispute.orderId },
  }).catch(() => {});

  return resolveDisputeCovers(dispute);
}

// === Get Dispute by ID ===

export async function getDispute(disputeId: string, userId: string, role: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: disputeIncludes(),
  });

  if (!dispute) {
    throw new NotFoundError('Disputa não encontrada');
  }

  // Access control: buyer, seller, or admin
  const isBuyer = dispute.buyerId === userId;
  const isSeller = dispute.sellerId === userId;
  const isAdmin = role === 'ADMIN';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError('Você não tem acesso a esta disputa');
  }

  return resolveDisputeCovers(dispute);
}

// === List Buyer Disputes ===

export async function listBuyerDisputes(
  buyerId: string,
  filters: { status?: string; page: number; limit: number },
) {
  const { status, page, limit } = filters;

  const where: Record<string, unknown> = { buyerId };
  if (status) {
    where.status = status;
  }

  const [rawDisputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: disputeIncludes(),
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  const disputes = rawDisputes.map(resolveDisputeCovers);

  return { disputes, total, page, limit };
}

// === List Seller Disputes ===

export async function listSellerDisputes(
  sellerId: string,
  filters: { status?: string; page: number; limit: number },
) {
  const { status, page, limit } = filters;

  const where: Record<string, unknown> = { sellerId };
  if (status) {
    where.status = status;
  }

  const [rawDisputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: disputeIncludes(),
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  const disputes = rawDisputes.map(resolveDisputeCovers);

  return { disputes, total, page, limit };
}

// === Add Evidence ===

export async function addEvidence(
  disputeId: string,
  userId: string,
  imageUrl: string,
  description?: string,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { evidence: true },
  });

  if (!dispute) {
    throw new NotFoundError('Disputa não encontrada');
  }

  // Only buyer or seller in this dispute can add evidence
  const isBuyer = dispute.buyerId === userId;
  const isSeller = dispute.sellerId === userId;

  if (!isBuyer && !isSeller) {
    throw new ForbiddenError('Você não tem permissão para adicionar evidências nesta disputa');
  }

  // Dispute must be OPEN or IN_MEDIATION
  if (dispute.status !== 'OPEN' && dispute.status !== 'IN_MEDIATION') {
    throw new BadRequestError('Não é possível adicionar evidências a uma disputa encerrada');
  }

  // Max 5 evidence items per party
  const userEvidenceCount = dispute.evidence.filter((e) => e.submittedById === userId).length;
  if (userEvidenceCount >= 5) {
    throw new BadRequestError('Limite máximo de 5 evidências por parte atingido');
  }

  const evidence = await prisma.disputeEvidence.create({
    data: {
      disputeId,
      submittedById: userId,
      imageUrl,
      description: description || null,
    },
    include: {
      submittedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return evidence;
}

// === Cancel Dispute ===

export async function cancelDispute(disputeId: string, buyerId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      orderItem: true,
    },
  });

  if (!dispute) {
    throw new NotFoundError('Disputa não encontrada');
  }

  // Only the buyer can cancel
  if (dispute.buyerId !== buyerId) {
    throw new ForbiddenError('Apenas o comprador pode cancelar a disputa');
  }

  // Only OPEN disputes can be cancelled
  if (dispute.status !== 'OPEN') {
    throw new BadRequestError('Apenas disputas abertas podem ser canceladas');
  }

  // Update dispute status and revert order item status
  const updated = await prisma.$transaction(async (tx) => {
    const cancelledDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: { status: 'CANCELLED' },
      include: disputeIncludes(),
    });

    // Revert order item status: go back to the status before DISPUTED
    // The item was SHIPPED or DELIVERED before the dispute was opened.
    // We check deliveredAt to determine what to revert to.
    const previousStatus = dispute.orderItem.deliveredAt ? 'DELIVERED' : 'SHIPPED';

    await tx.orderItem.update({
      where: { id: dispute.orderItemId },
      data: { status: previousStatus },
    });

    // Check if order should also revert from DISPUTED
    const allItems = await tx.orderItem.findMany({
      where: { orderId: dispute.orderId },
    });
    const anyStillDisputed = allItems.some(
      (item) => item.id !== dispute.orderItemId && item.status === 'DISPUTED',
    );
    if (!anyStillDisputed) {
      // Find the order's current status
      const order = await tx.order.findUnique({
        where: { id: dispute.orderId },
      });
      if (order && order.status === 'DISPUTED') {
        // Revert to SHIPPED or DELIVERED based on whether any items are delivered
        const hasDelivered = allItems.some(
          (item) => item.id !== dispute.orderItemId && item.deliveredAt,
        );
        const revertOrderStatus = hasDelivered ? 'DELIVERED' : 'SHIPPED';
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { status: revertOrderStatus },
        });
      }
    }

    return cancelledDispute;
  });

  return resolveDisputeCovers(updated);
}

// === Seller Response to Dispute ===

export async function respondToDispute(
  disputeId: string,
  sellerId: string,
  data: SubmitDisputeResponseInput,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      order: { select: { orderNumber: true } },
    },
  });

  if (!dispute) {
    throw new NotFoundError('Disputa nao encontrada');
  }

  if (dispute.sellerId !== sellerId) {
    throw new ForbiddenError('Voce nao tem permissao para responder a esta disputa');
  }

  if (dispute.status !== 'OPEN') {
    throw new BadRequestError('Apenas disputas abertas podem receber resposta do vendedor');
  }

  // Check 48h deadline — warn if late but still allow
  const hoursSinceCreation =
    (Date.now() - dispute.createdAt.getTime()) / (1000 * 60 * 60);
  const isLateResponse = hoursSinceCreation > 48;

  if (isLateResponse) {
    console.warn(
      `[Disputes] Resposta tardia do vendedor para disputa ${disputeId}. ` +
        `Horas desde abertura: ${hoursSinceCreation.toFixed(1)}h (prazo: 48h)`,
    );
  }

  // Create message and update status in transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Create the seller's response message
    await tx.disputeMessage.create({
      data: {
        disputeId,
        senderId: sellerId,
        message: data.message,
      },
    });

    // Update dispute status to IN_MEDIATION
    return tx.dispute.update({
      where: { id: disputeId },
      data: { status: 'IN_MEDIATION' },
      include: disputeIncludes(),
    });
  });

  // Fire-and-forget: notify buyer that seller responded
  createNotification({
    userId: dispute.buyerId,
    type: 'DISPUTE_RESPONDED',
    title: 'Vendedor respondeu a disputa',
    message: `O vendedor respondeu a sua disputa do pedido #${dispute.order.orderNumber}.`,
    metadata: { disputeId: dispute.id, orderId: dispute.orderId },
  }).catch(() => {});

  return {
    ...resolveDisputeCovers(updated),
    lateResponse: isLateResponse,
  };
}

// === Admin: Resolve Dispute ===

export async function resolveDispute(
  disputeId: string,
  adminId: string,
  data: ResolveDisputeInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Validate dispute exists and is in a resolvable state
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        orderItem: true,
      },
    });

    if (!dispute) {
      throw new NotFoundError('Disputa nao encontrada');
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'IN_MEDIATION') {
      throw new BadRequestError(
        'Apenas disputas abertas ou em mediacao podem ser resolvidas',
      );
    }

    // 2. Validate refundAmount for partial refund
    if (data.status === 'RESOLVED_PARTIAL_REFUND') {
      if (!data.refundAmount) {
        throw new BadRequestError(
          'Valor do reembolso e obrigatorio para reembolso parcial',
        );
      }
      const itemPrice = Number(dispute.orderItem.priceSnapshot);
      if (data.refundAmount > itemPrice) {
        throw new BadRequestError(
          'Valor do reembolso nao pode exceder o preco do item',
        );
      }
    }

    // 3. Update the dispute
    const updatedDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: data.status,
        resolution: data.resolution,
        resolvedById: adminId,
        resolvedAt: new Date(),
        refundAmount: data.refundAmount ?? null,
      },
      include: disputeIncludes(),
    });

    // 4. Handle refund cases
    if (data.status === 'RESOLVED_REFUND' || data.status === 'RESOLVED_PARTIAL_REFUND') {
      // Find the payment for this order
      const payment = await tx.payment.findFirst({
        where: { orderId: dispute.orderId },
      });

      if (payment && payment.paidAt) {
        // Determine refund amount: full item price or partial
        const refundAmount =
          data.status === 'RESOLVED_REFUND'
            ? Number(dispute.orderItem.priceSnapshot)
            : data.refundAmount!;

        // We need to call refundPayment outside the transaction since it has its own
        // For now, store the intent and execute after transaction
        // Update order item status to REFUNDED within the transaction
        await tx.orderItem.update({
          where: { id: dispute.orderItemId },
          data: { status: 'REFUNDED' },
        });
      } else {
        // No paid payment found — still update order item status
        await tx.orderItem.update({
          where: { id: dispute.orderItemId },
          data: { status: 'REFUNDED' },
        });
      }
    }

    // 5. Handle no-refund case: revert order item status
    if (data.status === 'RESOLVED_NO_REFUND') {
      const previousStatus = dispute.orderItem.deliveredAt ? 'DELIVERED' : 'SHIPPED';
      await tx.orderItem.update({
        where: { id: dispute.orderItemId },
        data: { status: previousStatus },
      });

      // Check if order should revert from DISPUTED
      const allItems = await tx.orderItem.findMany({
        where: { orderId: dispute.orderId },
      });
      const anyStillDisputed = allItems.some(
        (item) => item.id !== dispute.orderItemId && item.status === 'DISPUTED',
      );
      if (!anyStillDisputed) {
        const order = await tx.order.findUnique({
          where: { id: dispute.orderId },
        });
        if (order && order.status === 'DISPUTED') {
          const hasDelivered = allItems.some(
            (item) => item.id !== dispute.orderItemId && item.deliveredAt,
          );
          const revertOrderStatus = hasDelivered ? 'DELIVERED' : 'SHIPPED';
          await tx.order.update({
            where: { id: dispute.orderId },
            data: { status: revertOrderStatus },
          });
        }
      }
    }

    return updatedDispute;
  });

  // After transaction: process refund through payment provider if needed
  if (data.status === 'RESOLVED_REFUND' || data.status === 'RESOLVED_PARTIAL_REFUND') {
    const payment = await prisma.payment.findFirst({
      where: { orderId: result.orderId },
    });

    if (payment && payment.paidAt) {
      const refundAmount =
        data.status === 'RESOLVED_REFUND'
          ? Number(result.orderItem.priceSnapshot)
          : data.refundAmount!;

      try {
        await refundPayment(payment.id, refundAmount);
      } catch (error) {
        console.error(
          `[Disputes] Falha ao processar reembolso para disputa ${disputeId}:`,
          error,
        );
        // The dispute is already resolved — refund failure is logged but
        // does not roll back the dispute resolution. Admin can retry.
      }
    }
  }

  // Fire-and-forget: notify both buyer and seller
  createNotification({
    userId: result.buyerId,
    type: 'DISPUTE_RESOLVED',
    title: 'Disputa resolvida',
    message: `A disputa do pedido #${result.order.orderNumber} foi resolvida.`,
    metadata: {
      disputeId: result.id,
      orderId: result.orderId,
      resolution: data.status,
    },
  }).catch(() => {});

  createNotification({
    userId: result.sellerId,
    type: 'DISPUTE_RESOLVED',
    title: 'Disputa resolvida',
    message: `A disputa do pedido #${result.order.orderNumber} foi resolvida.`,
    metadata: {
      disputeId: result.id,
      orderId: result.orderId,
      resolution: data.status,
    },
  }).catch(() => {});

  return resolveDisputeCovers(result);
}

// === Admin: List All Disputes ===

export async function listAllDisputes(filters: {
  status?: string;
  page: number;
  limit: number;
}) {
  const { status, page, limit } = filters;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [rawDisputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: disputeIncludes(),
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  const disputes = rawDisputes.map(resolveDisputeCovers);

  return { disputes, total, page, limit };
}

// === Admin: Dispute Stats ===

export async function getDisputeStats() {
  // Count disputes by status
  const statusCounts = await prisma.dispute.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    byStatus[row.status] = row._count.id;
  }

  // Calculate average resolution time for resolved disputes
  const resolvedDisputes = await prisma.dispute.findMany({
    where: {
      status: { in: ['RESOLVED_REFUND', 'RESOLVED_PARTIAL_REFUND', 'RESOLVED_NO_REFUND'] },
      resolvedAt: { not: null },
    },
    select: {
      createdAt: true,
      resolvedAt: true,
    },
  });

  let avgResolutionHours: number | null = null;
  if (resolvedDisputes.length > 0) {
    const totalHours = resolvedDisputes.reduce((sum, d) => {
      const hours =
        (d.resolvedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedDisputes.length) * 10) / 10;
  }

  // Calculate total refunded amount
  const refundResult = await prisma.dispute.aggregate({
    where: {
      status: { in: ['RESOLVED_REFUND', 'RESOLVED_PARTIAL_REFUND'] },
      refundAmount: { not: null },
    },
    _sum: { refundAmount: true },
  });

  const totalRefundedAmount = Number(refundResult._sum.refundAmount ?? 0);

  return {
    byStatus,
    totalDisputes: Object.values(byStatus).reduce((a, b) => a + b, 0),
    avgResolutionHours,
    totalRefundedAmount,
  };
}

// === Add Message to Dispute ===

export async function addMessage(
  disputeId: string,
  userId: string,
  data: AddDisputeMessageInput,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Disputa nao encontrada');
  }

  // Validate user is buyer, seller, or admin (we check admin by looking at resolvedById)
  const isBuyer = dispute.buyerId === userId;
  const isSeller = dispute.sellerId === userId;

  if (!isBuyer && !isSeller) {
    // Check if user is an admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Voce nao tem permissao para enviar mensagens nesta disputa');
    }
  }

  // Validate dispute is not in a final state
  const finalStatuses = [
    'RESOLVED_REFUND',
    'RESOLVED_PARTIAL_REFUND',
    'RESOLVED_NO_REFUND',
    'CANCELLED',
  ];
  if (finalStatuses.includes(dispute.status)) {
    throw new BadRequestError('Nao e possivel enviar mensagens em uma disputa encerrada');
  }

  const message = await prisma.disputeMessage.create({
    data: {
      disputeId,
      senderId: userId,
      message: data.message,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return message;
}
