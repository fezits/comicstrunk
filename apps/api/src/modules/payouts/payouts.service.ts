import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/utils/api-error';
import { createNotification } from '../notifications/notifications.service';

const num = (v: unknown): number => Number(v ?? 0);

/**
 * Garante que o seller tem registro em SellerBalance.
 */
async function ensureBalance(userId: string, tx: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient) {
  const existing = await tx.sellerBalance.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.sellerBalance.create({ data: { userId } });
}

/**
 * Credita `sellerNetSnapshot` no saldo do vendedor quando OrderItem vira COMPLETED.
 * Idempotente: se já existe entry SALE_CREDIT pra esse orderItem, não credita duplicado.
 */
export async function creditOrderItemToBalance(orderItemId: string): Promise<void> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      sellerId: true,
      sellerNetSnapshot: true,
      status: true,
    },
  });
  if (!item) return;
  if (item.status !== 'COMPLETED') return;

  await prisma.$transaction(async (tx) => {
    // Idempotência: já creditado?
    const existing = await tx.sellerBalanceEntry.findFirst({
      where: { orderItemId, kind: 'SALE_CREDIT' },
    });
    if (existing) return;

    const balance = await ensureBalance(item.sellerId, tx);
    const amount = num(item.sellerNetSnapshot);
    if (amount <= 0) return;

    await tx.sellerBalanceEntry.create({
      data: {
        balanceId: balance.id,
        userId: item.sellerId,
        kind: 'SALE_CREDIT',
        amount,
        orderItemId,
        notes: `Crédito da venda concluída (item ${orderItemId.slice(-6)})`,
      },
    });

    await tx.sellerBalance.update({
      where: { id: balance.id },
      data: {
        available: { increment: amount },
        totalEarned: { increment: amount },
      },
    });
  });
}

// ===========================================================================
// Seller-facing
// ===========================================================================

export async function getMyBalance(userId: string) {
  const balance = await ensureBalance(userId);
  return {
    available: num(balance.available),
    pending: num(balance.pending),
    totalEarned: num(balance.totalEarned),
    totalPaidOut: num(balance.totalPaidOut),
  };
}

export async function listMyBalanceEntries(userId: string, page = 1, limit = 50) {
  const [entries, total] = await Promise.all([
    prisma.sellerBalanceEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sellerBalanceEntry.count({ where: { userId } }),
  ]);
  return {
    data: entries.map((e) => ({ ...e, amount: num(e.amount) })),
    total,
    page,
    limit,
  };
}

export async function requestPayout(userId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new BadRequestError('Informe um valor maior que zero');
  }

  const balance = await ensureBalance(userId);
  const available = num(balance.available);
  if (amount > available) {
    throw new BadRequestError(
      `Saldo disponível R$ ${available.toFixed(2)} é menor que o solicitado R$ ${amount.toFixed(2)}`,
    );
  }

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  if (!bankAccount) {
    throw new BadRequestError('Cadastre uma conta bancária antes de solicitar saque');
  }

  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.payoutRequest.create({
      data: {
        sellerId: userId,
        amount,
        bankSnapshot: {
          bankName: bankAccount.bankName,
          branchNumber: bankAccount.branchNumber,
          accountNumber: bankAccount.accountNumber,
          cpf: bankAccount.cpf,
          holderName: bankAccount.holderName,
          accountType: bankAccount.accountType,
        },
      },
    });

    // Move do available pra pending até admin processar
    await tx.sellerBalance.update({
      where: { id: balance.id },
      data: {
        available: { decrement: amount },
        pending: { increment: amount },
      },
    });
    return created;
  });

  // Notifica admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  for (const admin of admins) {
    createNotification({
      userId: admin.id,
      type: 'PAYOUT_REQUESTED',
      title: 'Novo pedido de saque',
      message: `Vendedor solicitou saque de R$ ${amount.toFixed(2).replace('.', ',')}`,
      metadata: { payoutId: payout.id, sellerId: userId, amount },
    }).catch(() => undefined);
  }
  // Notifica o próprio vendedor (confirmação)
  createNotification({
    userId,
    type: 'PAYOUT_REQUESTED',
    title: 'Saque solicitado',
    message: `Sua solicitação de saque de R$ ${amount.toFixed(2).replace('.', ',')} foi registrada. Aguarde aprovação.`,
    metadata: { payoutId: payout.id, amount },
  }).catch(() => undefined);

  return { ...payout, amount: num(payout.amount) };
}

export async function listMyPayouts(userId: string, page = 1, limit = 20) {
  const [data, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { sellerId: userId },
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payoutRequest.count({ where: { sellerId: userId } }),
  ]);
  return {
    data: data.map((p) => ({ ...p, amount: num(p.amount) })),
    total,
    page,
    limit,
  };
}

// ===========================================================================
// Admin-facing
// ===========================================================================

export async function adminListPayouts(filters: {
  status?: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  page: number;
  limit: number;
}) {
  const { status, page, limit } = filters;
  const where = status ? { status } : {};

  const [data, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payoutRequest.count({ where }),
  ]);
  return {
    data: data.map((p) => ({ ...p, amount: num(p.amount) })),
    total,
    page,
    limit,
  };
}

export async function adminApprovePayout(payoutId: string, adminId: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new NotFoundError('Solicitação não encontrada');
  if (payout.status !== 'REQUESTED') {
    throw new BadRequestError(`Solicitação está ${payout.status}, não pode ser aprovada`);
  }

  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status: 'APPROVED', approvedAt: new Date(), processedById: adminId },
  });

  createNotification({
    userId: payout.sellerId,
    type: 'PAYOUT_APPROVED',
    title: 'Saque aprovado',
    message: `Seu saque de R$ ${num(payout.amount).toFixed(2).replace('.', ',')} foi aprovado e está em processamento.`,
    metadata: { payoutId },
  }).catch(() => undefined);

  return { ...updated, amount: num(updated.amount) };
}

export async function adminMarkPaid(payoutId: string, adminId: string, externalReceipt?: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new NotFoundError('Solicitação não encontrada');
  if (!['REQUESTED', 'APPROVED'].includes(payout.status)) {
    throw new BadRequestError(`Solicitação está ${payout.status}, não pode ser marcada como paga`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        approvedAt: payout.approvedAt ?? new Date(),
        processedById: adminId,
        externalReceipt: externalReceipt ?? null,
      },
    });

    const balance = await ensureBalance(payout.sellerId, tx);
    const amount = num(payout.amount);

    // Cria entry de débito
    await tx.sellerBalanceEntry.create({
      data: {
        balanceId: balance.id,
        userId: payout.sellerId,
        kind: 'PAYOUT_DEBIT',
        amount: -amount,
        payoutId,
        notes: `Saque pago${externalReceipt ? ` (recibo: ${externalReceipt})` : ''}`,
      },
    });

    // Move do pending pra totalPaidOut
    await tx.sellerBalance.update({
      where: { id: balance.id },
      data: {
        pending: { decrement: amount },
        totalPaidOut: { increment: amount },
      },
    });

    return updated;
  });

  createNotification({
    userId: payout.sellerId,
    type: 'PAYOUT_PAID',
    title: 'Saque pago',
    message: `Seu saque de R$ ${num(payout.amount).toFixed(2).replace('.', ',')} foi pago. Confira sua conta bancária.`,
    metadata: { payoutId, externalReceipt },
  }).catch(() => undefined);

  return { ...result, amount: num(result.amount) };
}

export async function adminRejectPayout(payoutId: string, adminId: string, reason: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new NotFoundError('Solicitação não encontrada');
  if (payout.status === 'PAID') {
    throw new BadRequestError('Saque já pago não pode ser rejeitado');
  }
  if (payout.status === 'REJECTED') {
    throw new BadRequestError('Solicitação já está rejeitada');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        processedById: adminId,
        adminNotes: reason,
      },
    });

    // Devolve do pending pro available
    const balance = await ensureBalance(payout.sellerId, tx);
    const amount = num(payout.amount);
    await tx.sellerBalance.update({
      where: { id: balance.id },
      data: {
        pending: { decrement: amount },
        available: { increment: amount },
      },
    });

    return updated;
  });

  createNotification({
    userId: payout.sellerId,
    type: 'PAYOUT_REJECTED',
    title: 'Saque rejeitado',
    message: `Seu saque foi rejeitado: ${reason}. O valor voltou para o saldo disponível.`,
    metadata: { payoutId, reason },
  }).catch(() => undefined);

  return { ...result, amount: num(result.amount) };
}
