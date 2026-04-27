import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { generatePixPayment, isPixConfigured } from '../../shared/lib/pix';
import { mpPayment, mpRefund, isMercadoPagoConfigured } from '../../shared/lib/mercadopago';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/utils/api-error';
import { roundCurrency } from '../../shared/lib/currency';
import { createNotification } from '../notifications/notifications.service';
import { sendPaymentConfirmedEmail } from '../notifications/email.service';

// === Initiate PIX Payment ===

export async function initiatePixPayment(orderId: string, userId: string) {
  // 1. Fetch order with buyer email
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { select: { email: true } } },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.buyerId !== userId) {
    throw new ForbiddenError('Not your order');
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError('Order is not in PENDING status');
  }

  // 2. Check for existing non-expired payment
  const existingPayment = await prisma.payment.findFirst({
    where: { orderId },
  });

  if (existingPayment?.pixExpiresAt && existingPayment.pixExpiresAt > new Date()) {
    return existingPayment;
  }

  // 3. Calculate PIX expiry aligned with cart reservation
  const now = new Date();
  const maxPixDuration = 30 * 60 * 1000; // 30 minutes

  // Check for active cart items from this buyer to align PIX expiry with cart TTL
  const earliestCartExpiry = await prisma.cartItem.findFirst({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: 'asc' },
    select: { expiresAt: true },
  });

  let pixExpiresAt: Date;

  if (earliestCartExpiry) {
    const remainingCartMs = earliestCartExpiry.expiresAt.getTime() - now.getTime();
    const bufferMs = 5 * 60 * 1000; // 5 minute buffer

    if (remainingCartMs < 10 * 60 * 1000) {
      throw new BadRequestError('Cart reservation too short for payment');
    }

    const pixDurationMs = Math.min(remainingCartMs - bufferMs, maxPixDuration);
    pixExpiresAt = new Date(now.getTime() + pixDurationMs);
  } else {
    // No active cart items (order was already created from cart), use max duration
    pixExpiresAt = new Date(now.getTime() + maxPixDuration);
  }

  // 4. Generate PIX payment (local static PIX or Mercado Pago)
  let providerPaymentId: string;
  let providerStatus: string;
  let pixQrCode: string | null = null;
  let pixCopyPaste: string | null = null;

  if (isPixConfigured()) {
    // Local PIX via pix-utils — no intermediary, manual confirmation by admin
    const pixData = await generatePixPayment(
      Number(order.totalAmount),
      orderId,
      `Comics Trunk - ${order.orderNumber}`,
    );
    providerPaymentId = `pix-${orderId}`;
    providerStatus = 'pending';
    pixQrCode = pixData.pixQrCode;
    pixCopyPaste = pixData.pixCopyPaste;
  } else if (isMercadoPagoConfigured() && mpPayment) {
    // Mercado Pago dynamic PIX (fallback if MP is configured)
    const mpResponse = await mpPayment.create({
      body: {
        transaction_amount: Number(order.totalAmount),
        payment_method_id: 'pix',
        payer: { email: order.buyer.email },
        description: `Comics Trunk - ${order.orderNumber}`,
        external_reference: orderId,
        date_of_expiration: pixExpiresAt.toISOString(),
        notification_url: `${process.env.API_PUBLIC_URL || 'http://localhost:3001'}/api/v1/webhooks/mercadopago`,
      },
      requestOptions: {
        idempotencyKey: `pix-${orderId}`,
      },
    });

    const txData = mpResponse.point_of_interaction?.transaction_data;

    providerPaymentId = String(mpResponse.id);
    providerStatus = mpResponse.status ?? 'pending';
    pixQrCode = txData?.qr_code_base64 ?? null;
    pixCopyPaste = txData?.qr_code ?? null;
  } else {
    // Dev mode fallback — nothing configured
    console.warn('[Payments] No PIX provider configured — using dev mode mock');
    providerPaymentId = `dev-${orderId}`;
    providerStatus = 'pending';
    pixQrCode = null;
    pixCopyPaste = null;
  }

  // 5. Upsert Payment record
  if (existingPayment) {
    return prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        providerPaymentId,
        providerStatus,
        pixQrCode,
        pixCopyPaste,
        pixExpiresAt,
      },
    });
  }

  return prisma.payment.create({
    data: {
      orderId,
      amount: Number(order.totalAmount),
      method: 'PIX',
      providerPaymentId,
      providerStatus,
      pixQrCode,
      pixCopyPaste,
      pixExpiresAt,
    },
  });
}

// === Get Payment Status ===

export async function getPaymentStatus(orderId: string, userId: string) {
  // Find payment by orderId
  const payment = await prisma.payment.findFirst({
    where: { orderId },
    include: {
      order: { select: { buyerId: true } },
    },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Validate order ownership
  if (payment.order!.buyerId !== userId) {
    throw new ForbiddenError('Not your order');
  }

  // If Mercado Pago is configured and payment is still pending, try polling
  if (
    isMercadoPagoConfigured() &&
    mpPayment &&
    payment.providerPaymentId &&
    !payment.providerPaymentId.startsWith('dev-') &&
    !payment.providerPaymentId.startsWith('pix-') &&
    payment.providerStatus === 'pending'
  ) {
    try {
      const mpStatus = await mpPayment.get({ id: payment.providerPaymentId });

      if (mpStatus.status && mpStatus.status !== payment.providerStatus) {
        // Update provider status
        await prisma.payment.update({
          where: { id: payment.id },
          data: { providerStatus: mpStatus.status },
        });

        // If approved, process the payment confirmation
        if (mpStatus.status === 'approved') {
          await processPaymentConfirmation(orderId);
        }

        // Refetch after updates
        return prisma.payment.findFirst({ where: { orderId } });
      }
    } catch (error) {
      console.error('[Payments] Error polling Mercado Pago status:', error);
      // Continue with cached status on polling failure
    }
  }

  // Remove the included order relation from response + normalize Decimals
  const { order: _order, ...paymentData } = payment;
  return normalizePayment(paymentData);
}

// === Process Payment Confirmation ===

export async function processPaymentConfirmation(orderId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Update order status to PAID
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    // 2. Update all PENDING items to PAID
    await tx.orderItem.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'PAID' },
    });

    // 3. Update payment record
    await tx.payment.updateMany({
      where: { orderId },
      data: { paidAt: new Date(), providerStatus: 'approved' },
    });
  });

  // Fire-and-forget: notify buyer of payment confirmation
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { name: true, email: true } },
        orderItems: { select: { id: true } },
      },
    });
    if (order) {
      createNotification({
        userId: order.buyerId,
        type: 'PAYMENT_CONFIRMED',
        title: 'Pagamento confirmado',
        message: `O pagamento do pedido ${order.orderNumber} foi confirmado com sucesso!`,
        metadata: { orderId, orderNumber: order.orderNumber },
      }).catch(() => {});

      // Fire-and-forget: send payment confirmed email
      void sendPaymentConfirmedEmail(order.buyerId, order.buyer.email, {
        userName: order.buyer.name,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount).toFixed(2),
        itemCount: order.orderItems.length,
      });
    }
  } catch {
    // Non-blocking — payment confirmation is the critical path, not the notification
  }
}

// === Get Payment by Order ID ===

export async function getPaymentByOrderId(orderId: string) {
  return prisma.payment.findFirst({
    where: { orderId },
  });
}

// === Process Webhook Event ===

export async function processWebhookEvent(
  eventId: string,
  eventType: string,
  payload: unknown,
  dataId: string | undefined,
) {
  // 1. Idempotency guard: try to insert event
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'mercadopago',
        eventId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    // Unique constraint violation = duplicate event, skip silently
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.log(`[Webhook] Duplicate event ${eventId} skipped`);
      return;
    }
    throw error;
  }

  // 2. Process payment events (Gap #6: registra falha pra retry posterior)
  if (
    dataId &&
    (eventType === 'payment.updated' ||
      eventType === 'payment.created' ||
      eventType === 'payment')
  ) {
    try {
      if (isMercadoPagoConfigured() && mpPayment) {
        const mpStatus = await mpPayment.get({ id: dataId });

        if (mpStatus.status === 'approved') {
          const payment = await prisma.payment.findFirst({
            where: { providerPaymentId: dataId },
          });

          if (payment) {
            await processPaymentConfirmation(payment.orderId!);
          }
        }
      }
    } catch (error) {
      // Marca como falha, NÃO marca processedAt — cron de retry vai reprocessar
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Webhook] Error processing payment event ${eventId}:`, msg);
      await prisma.webhookEvent
        .update({
          where: { provider_eventId: { provider: 'mercadopago', eventId } },
          data: {
            attempts: { increment: 1 },
            lastError: msg.slice(0, 500),
            lastAttemptAt: new Date(),
          },
        })
        .catch(() => undefined);
      return;
    }
  }

  // 3. Mark webhook as processed (apenas no caminho feliz)
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: 'mercadopago', eventId } },
    data: { processedAt: new Date(), lastAttemptAt: new Date() },
  });
}

// === Webhook Retry (Gap #6) ===

/**
 * Reprocessa eventos webhook que ainda não foram marcados como processed.
 * Usado pelo cron job (a cada 10min). Reusa `processWebhookEvent` que já tem
 * idempotência via `webhookEvents` table.
 */
export async function retryPendingWebhooks(maxAttempts = 5): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const pending = await prisma.webhookEvent.findMany({
    where: {
      provider: 'mercadopago',
      processedAt: null,
      attempts: { lt: maxAttempts },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: fiveMinAgo } }],
    },
    take: 50, // batch
  });

  let succeeded = 0;
  for (const ev of pending) {
    try {
      const payload = ev.payload as { data?: { id?: string | number } } | null;
      const dataId = payload?.data?.id != null ? String(payload.data.id) : undefined;

      if (!dataId || !isMercadoPagoConfigured() || !mpPayment) {
        // Sem como reprocessar — marca como processed pra parar de tentar
        await prisma.webhookEvent.update({
          where: { id: ev.id },
          data: {
            processedAt: new Date(),
            lastError: 'Skipped: MP not configured or no dataId',
            lastAttemptAt: new Date(),
          },
        });
        continue;
      }

      const mpStatus = await mpPayment.get({ id: dataId });
      if (mpStatus.status === 'approved') {
        const payment = await prisma.payment.findFirst({
          where: { providerPaymentId: dataId },
        });
        if (payment) {
          await processPaymentConfirmation(payment.orderId!);
        }
      }

      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: { processedAt: new Date(), lastAttemptAt: new Date() },
      });
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.webhookEvent
        .update({
          where: { id: ev.id },
          data: {
            attempts: { increment: 1 },
            lastError: msg.slice(0, 500),
            lastAttemptAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }
  return succeeded;
}

// === Admin: Approve Payment ===

export async function adminApprovePayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { select: { email: true } } },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError('Order is not in PENDING status');
  }

  // Find or create Payment record (may not exist if PIX was never initiated)
  let payment = await prisma.payment.findFirst({ where: { orderId } });

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        orderId,
        amount: Number(order.totalAmount),
        method: 'PIX',
        providerPaymentId: `admin-approved-${orderId}`,
        providerStatus: 'approved',
        paidAt: new Date(),
      },
    });
  }

  // Use the same confirmation flow as webhook
  await processPaymentConfirmation(orderId);

  // Ensure payment record reflects approval
  await prisma.payment.updateMany({
    where: { orderId },
    data: {
      paidAt: new Date(),
      providerStatus: 'approved',
      method: 'PIX',
    },
  });

  // Return updated order
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: true,
      payments: true,
    },
  });
}

// === Admin: Reject Payment ===

export async function adminRejectPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError('Order is not in PENDING status');
  }

  await prisma.$transaction(async (tx) => {
    // Transition order to CANCELLED
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    // Cancel all PENDING items
    await tx.orderItem.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // Mark payment record as rejected
    await tx.payment.updateMany({
      where: { orderId },
      data: { providerStatus: 'rejected' },
    });
  });

  // Gap #2: Notificar comprador que o pagamento foi rejeitado
  try {
    createNotification({
      userId: order.buyerId,
      type: 'PAYMENT_REJECTED',
      title: 'Pagamento não confirmado',
      message: `Não conseguimos confirmar o pagamento do pedido ${order.orderNumber}. Os itens foram liberados — você pode tentar comprar novamente ou entrar em contato com o suporte.`,
      metadata: { orderId, orderNumber: order.orderNumber },
    }).catch(() => {});
  } catch {
    // Non-blocking — rejeição é o caminho crítico, notificação é cosmética
  }

  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: true,
      payments: true,
    },
  });
}

// === Refund Payment ===

export async function refundPayment(paymentId: string, amount?: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: { orderItems: true },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  if (!payment.paidAt) {
    throw new BadRequestError('Payment has not been completed yet');
  }

  const paymentAmount = Number(payment.amount);
  const currentRefunded = Number(payment.refundedAmount ?? 0);
  const refundAmount = amount ?? roundCurrency(paymentAmount - currentRefunded);

  if (refundAmount <= 0) {
    throw new BadRequestError('Invalid refund amount');
  }

  if (currentRefunded + refundAmount > paymentAmount) {
    throw new BadRequestError('Refund amount exceeds remaining payment balance');
  }

  const isFullRefund = roundCurrency(currentRefunded + refundAmount) >= paymentAmount;

  // Attempt Mercado Pago refund if configured and has a real provider payment ID
  if (
    isMercadoPagoConfigured() &&
    mpRefund &&
    payment.providerPaymentId &&
    !payment.providerPaymentId.startsWith('dev-') &&
    !payment.providerPaymentId.startsWith('admin-approved-')
  ) {
    try {
      if (isFullRefund) {
        await mpRefund.total({ payment_id: payment.providerPaymentId });
      } else {
        await mpRefund.create({
          payment_id: payment.providerPaymentId,
          body: { amount: refundAmount },
        });
      }
    } catch (error) {
      console.error('[Payments] Mercado Pago refund failed:', error);
      // Log but continue — admin can retry, and local record still updates
    }
  }

  // Update payment record
  const newRefundedAmount = roundCurrency(currentRefunded + refundAmount);
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      refundedAmount: newRefundedAmount,
      providerStatus: isFullRefund ? 'refunded' : 'approved',
    },
  });

  // If full refund: transition all PAID items to REFUNDED and order to CANCELLED
  if (isFullRefund) {
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: payment.orderId!, status: 'PAID' },
        data: { status: 'REFUNDED' },
      });

      await tx.order.update({
        where: { id: payment.orderId! },
        data: { status: 'CANCELLED' },
      });
    });
  }

  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: { orderItems: true },
      },
    },
  });
}

// === Helpers para serializar Decimal como Number ===

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function normalizePayment<T extends { amount?: unknown; refundedAmount?: unknown }>(p: T): T {
  return {
    ...p,
    amount: num(p.amount) as unknown,
    refundedAmount: num(p.refundedAmount) as unknown,
  } as T;
}

function normalizeOrderTotal<T extends { totalAmount?: unknown }>(o: T): T {
  return { ...o, totalAmount: num(o.totalAmount) as unknown } as T;
}

// === User: Payment History ===

export async function getUserPaymentHistory(
  userId: string,
  page: number,
  limit: number,
) {
  const where: Prisma.PaymentWhereInput = {
    order: { buyerId: userId },
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  const normalized = payments.map((p) =>
    normalizePayment({ ...p, order: p.order ? normalizeOrderTotal(p.order) : p.order }),
  );

  return { payments: normalized, total, page, limit };
}

// === Admin: List Pending Payments ===

export async function adminListPendingPayments(page: number, limit: number) {
  const where: Prisma.OrderWhereInput = {
    status: 'PENDING',
    payments: { some: {} },
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        payments: true,
        buyer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' }, // oldest first — most urgent
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  const normalized = orders.map((o) => ({
    ...normalizeOrderTotal(o),
    payments: o.payments.map(normalizePayment),
  }));

  return { orders: normalized, total, page, limit };
}

// === Admin: List All Payments ===

export async function adminListAllPayments(filters: {
  status?: string;
  page: number;
  limit: number;
}) {
  const { status, page, limit } = filters;

  const where: Prisma.PaymentWhereInput = {
    ...(status && { providerStatus: status }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            buyer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  const normalized = payments.map((p) =>
    normalizePayment({ ...p, order: p.order ? normalizeOrderTotal(p.order) : p.order }),
  );

  return { payments: normalized, total, page, limit };
}
