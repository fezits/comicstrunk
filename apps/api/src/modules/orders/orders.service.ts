import { prisma } from '../../shared/lib/prisma';
import { generateOrderNumber } from '../../shared/lib/order-number';
import { roundCurrency } from '../../shared/lib/currency';
import { calculateCommission } from '../commission/commission.service';
import { assertOrderTransition, assertOrderItemTransition } from '../../shared/lib/order-state-machine';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/utils/api-error';
import { createNotification } from '../notifications/notifications.service';
import { sendOrderShippedEmail, sendItemSoldEmail } from '../notifications/email.service';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';

// === Batch commission rate lookup (avoids N+1 on commissionConfig table) ===

async function batchGetCommissionRates(planTypes: string[]): Promise<Map<string, number>> {
  const uniquePlans = [...new Set(planTypes)];
  const configs = await prisma.commissionConfig.findMany({
    where: { planType: { in: uniquePlans as any }, isActive: true },
  });
  const rateMap = new Map<string, number>();
  for (const config of configs) {
    rateMap.set(config.planType, Number(config.rate));
  }
  // Fallback defaults for any missing plan
  for (const plan of uniquePlans) {
    if (!rateMap.has(plan)) {
      rateMap.set(plan, plan === 'BASIC' ? 0.08 : 0.1);
    }
  }
  return rateMap;
}

// === Order includes for rich responses ===

function orderIncludes() {
  return {
    orderItems: {
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
  };
}

/**
 * Resolve URLs de capa + converte campos Decimal (Prisma) para Number.
 *
 * Sem essa conversão o frontend recebe `{ d: [...], e: ..., s: ... }` ao invés
 * de número e exibe "R$ NaN" em /admin/payments, /orders/{id}, etc.
 */
function resolveOrderCovers<T extends {
  totalAmount?: unknown;
  orderItems: Array<{
    priceSnapshot?: unknown;
    commissionRateSnapshot?: unknown;
    commissionAmountSnapshot?: unknown;
    sellerNetSnapshot?: unknown;
    collectionItem: {
      salePrice?: unknown;
      pricePaid?: unknown;
      catalogEntry: { coverImageUrl: string | null; coverFileName?: string | null };
    } | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}>(order: T): T {
  const num = (v: unknown): number | null => (v == null ? null : Number(v));
  return {
    ...order,
    totalAmount: num(order.totalAmount) as unknown,
    orderItems: order.orderItems.map((item) => ({
      ...item,
      priceSnapshot: num(item.priceSnapshot) as unknown,
      commissionRateSnapshot: num(item.commissionRateSnapshot) as unknown,
      commissionAmountSnapshot: num(item.commissionAmountSnapshot) as unknown,
      sellerNetSnapshot: num(item.sellerNetSnapshot) as unknown,
      collectionItem: item.collectionItem
        ? {
            ...item.collectionItem,
            salePrice: num(item.collectionItem.salePrice) as unknown,
            pricePaid: num(item.collectionItem.pricePaid) as unknown,
            catalogEntry: item.collectionItem.catalogEntry
              ? resolveCoverUrl(item.collectionItem.catalogEntry)
              : item.collectionItem.catalogEntry,
          }
        : item.collectionItem,
    })),
  };
}

// === Create Order from Cart (ORDR-01 through ORDR-07) ===

export async function createOrder(buyerId: string, shippingAddressId: string) {
  const order = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Fetch active (non-expired) cart items for buyer
    const cartItems = await tx.cartItem.findMany({
      where: {
        userId: buyerId,
        expiresAt: { gt: now },
      },
      include: {
        collectionItem: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    // 2. Fetch and validate shipping address
    const address = await tx.shippingAddress.findUnique({
      where: { id: shippingAddressId },
    });

    if (!address) {
      throw new NotFoundError('Shipping address not found');
    }

    if (address.userId !== buyerId) {
      throw new ForbiddenError('Shipping address does not belong to you');
    }

    // 3. Generate unique order number with retry for collision handling
    let orderNumber = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      orderNumber = generateOrderNumber();
      const existing = await tx.order.findUnique({
        where: { orderNumber },
      });
      if (!existing) break;
      if (attempt === 2) {
        throw new BadRequestError('Failed to generate unique order number. Please try again.');
      }
    }

    // 4. Batch-fetch all seller subscriptions — one query instead of N
    const uniqueSellerIds = [...new Set(cartItems.map((ci) => ci.collectionItem.userId))];
    const sellerSubscriptions = await tx.subscription.findMany({
      where: {
        userId: { in: uniqueSellerIds },
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build a Map: sellerId → planType (first/latest active subscription wins)
    const sellerPlanMap = new Map<string, string>();
    for (const sub of sellerSubscriptions) {
      if (!sellerPlanMap.has(sub.userId)) {
        sellerPlanMap.set(sub.userId, sub.planType);
      }
    }

    // 5. Batch-fetch commission rates for all distinct seller plans
    const distinctPlans = [...new Set(sellerPlanMap.values())];
    // Also include FREE as fallback for sellers with no subscription
    if (!distinctPlans.includes('FREE')) distinctPlans.push('FREE');
    const commissionRateMap = await batchGetCommissionRates(distinctPlans);

    // 6. Build order items with price/commission snapshots
    let totalAmount = 0;
    let shippingTotal = 0;
    const orderItemsData: Array<{
      collectionItemId: string;
      sellerId: string;
      priceSnapshot: number;
      commissionRateSnapshot: number;
      commissionAmountSnapshot: number;
      sellerNetSnapshot: number;
    }> = [];

    for (const cartItem of cartItems) {
      const { collectionItem } = cartItem;
      const sellerId = collectionItem.userId;
      const price = Number(collectionItem.salePrice ?? 0);
      const shipping = Number(collectionItem.shippingCost ?? 0);

      // Look up seller's plan from the pre-fetched map
      const planType = sellerPlanMap.get(sellerId) ?? 'FREE';

      // Get commission rate for seller's plan (from pre-fetched map)
      const commissionRate = commissionRateMap.get(planType) ?? 0.1;

      // Calculate commission and seller net (commission só sobre price, não sobre frete)
      const { commission, sellerNet } = calculateCommission(price, commissionRate);

      orderItemsData.push({
        collectionItemId: collectionItem.id,
        sellerId,
        priceSnapshot: roundCurrency(price),
        commissionRateSnapshot: commissionRate,
        commissionAmountSnapshot: commission,
        sellerNetSnapshot: sellerNet,
      });

      totalAmount += price;
      shippingTotal += shipping;
    }

    totalAmount = roundCurrency(totalAmount + shippingTotal);
    shippingTotal = roundCurrency(shippingTotal);

    // 7. Snapshot shipping address as JSON
    const shippingAddressSnapshot = JSON.parse(JSON.stringify({
      id: address.id,
      label: address.label,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
    }));

    // 8. Create order with nested order items
    const order = await tx.order.create({
      data: {
        orderNumber,
        buyerId,
        totalAmount,
        shippingTotal,
        shippingAddressSnapshot,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: orderIncludes(),
    });

    // 9. Clear buyer's cart (delete all cart items)
    await tx.cartItem.deleteMany({
      where: { userId: buyerId },
    });

    return order;
  });

  // Fire-and-forget: notify each unique seller about the new sale
  const uniqueSellerIds = [...new Set(order.orderItems.map((item) => item.sellerId))];
  for (const sellerId of uniqueSellerIds) {
    createNotification({
      userId: sellerId,
      type: 'ITEM_SOLD',
      title: 'Nova venda!',
      message: 'Voce tem um novo pedido. Confira os detalhes e prepare o envio.',
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    }).catch(() => {});
  }

  // Fire-and-forget: send item sold email to each seller
  void (async () => {
    try {
      for (const sellerId of uniqueSellerIds) {
        const seller = await prisma.user.findUnique({
          where: { id: sellerId },
          select: { name: true, email: true },
        });
        if (!seller) continue;

        // Aggregate items for this seller in this order
        const sellerItems = order.orderItems.filter((item) => item.sellerId === sellerId);
        for (const item of sellerItems) {
          const title =
            item.collectionItem?.catalogEntry?.title ?? 'Item do catalogo';
          void sendItemSoldEmail(sellerId, seller.email, {
            sellerName: seller.name,
            orderNumber: order.orderNumber,
            itemTitle: title,
            salePrice: Number(item.priceSnapshot).toFixed(2),
            sellerNet: Number(item.sellerNetSnapshot).toFixed(2),
          });
        }
      }
    } catch {
      // Non-blocking — notifications already sent above
    }
  })();

  return resolveOrderCovers(order);
}

// === Get Order by ID ===

export async function getOrder(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderIncludes(),
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Verify caller is buyer or a seller on the order
  const isBuyer = order.buyerId === userId;
  const isSeller = order.orderItems.some((item) => item.sellerId === userId);

  if (!isBuyer && !isSeller) {
    throw new ForbiddenError('You do not have access to this order');
  }

  return resolveOrderCovers(order);
}

// === Get Order by Number ===

export async function getOrderByNumber(userId: string, orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: orderIncludes(),
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const isBuyer = order.buyerId === userId;
  const isSeller = order.orderItems.some((item) => item.sellerId === userId);

  if (!isBuyer && !isSeller) {
    throw new ForbiddenError('You do not have access to this order');
  }

  return resolveOrderCovers(order);
}

// === List Buyer Orders ===

export async function listBuyerOrders(
  buyerId: string,
  filters: { status?: string; page: number; limit: number },
) {
  const { status, page, limit } = filters;

  const where: Record<string, unknown> = { buyerId };
  if (status) {
    where.status = status;
  }

  const [rawOrders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderItems: {
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
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  const orders = rawOrders.map(resolveOrderCovers);

  return { orders, total, page, limit };
}

// === List Seller Orders ===

export async function listSellerOrders(
  sellerId: string,
  filters: { status?: string; page: number; limit: number },
) {
  const { status, page, limit } = filters;

  // Find orders that have at least one item with this seller
  const where: Record<string, unknown> = {
    orderItems: {
      some: { sellerId },
    },
  };
  if (status) {
    where.status = status;
  }

  const [rawOrders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderItems: {
          where: { sellerId }, // Only include this seller's items
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
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  const orders = rawOrders.map(resolveOrderCovers);

  return { orders, total, page, limit };
}

// === Update Order Item Status ===

export async function updateOrderItemStatus(
  userId: string,
  orderItemId: string,
  newStatus: string,
) {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: true,
    },
  });

  if (!orderItem) {
    throw new NotFoundError('Order item not found');
  }

  // Permission check:
  // - Buyer can confirm delivery (DELIVERED->COMPLETED)
  // - Seller can advance processing statuses (PAID->PROCESSING, PROCESSING->SHIPPED, etc.)
  // - Admin can do anything (role check is done in route via authorize)
  const isBuyer = orderItem.order.buyerId === userId;
  const isSeller = orderItem.sellerId === userId;

  if (!isBuyer && !isSeller) {
    throw new ForbiddenError('You do not have permission to update this order item');
  }

  // Buyers podem: confirmar entrega (DELIVERED), finalizar (COMPLETED) ou abrir
  // disputa (DISPUTED). Gap #10: incluir DELIVERED — sem isso o comprador
  // ficava preso porque a state machine exige SHIPPED → DELIVERED → COMPLETED.
  if (isBuyer && !isSeller) {
    const buyerAllowed = ['DELIVERED', 'COMPLETED', 'DISPUTED'];
    if (!buyerAllowed.includes(newStatus)) {
      throw new ForbiddenError(
        'Compradores podem apenas confirmar entrega, finalizar ou abrir disputas',
      );
    }
  }

  // Validate state machine transition
  assertOrderItemTransition(orderItem.status, newStatus);

  // Build update data with relevant timestamps
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'SHIPPED') {
    updateData.shippedAt = new Date();
  } else if (newStatus === 'DELIVERED') {
    updateData.deliveredAt = new Date();
  } else if (newStatus === 'CANCELLED') {
    updateData.cancelledAt = new Date();
  }

  const updatedItem = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: updateData,
  });

  // When item reaches COMPLETED: mark collection item as no longer for sale
  // + credita o sellerNetSnapshot no saldo do vendedor (Gap #7)
  if (newStatus === 'COMPLETED') {
    await prisma.collectionItem.update({
      where: { id: orderItem.collectionItemId },
      data: {
        isForSale: false,
        salePrice: null,
      },
    });
    // Credita saldo (idempotente)
    const { creditOrderItemToBalance } = await import('../payouts/payouts.service');
    await creditOrderItemToBalance(orderItemId).catch((err) =>
      console.error('[orders] Falha ao creditar saldo do vendedor:', err),
    );
  }

  // Fire-and-forget: notify buyer of shipping status changes
  if (newStatus === 'SHIPPED') {
    createNotification({
      userId: orderItem.order.buyerId,
      type: 'ORDER_SHIPPED',
      title: 'Pedido enviado',
      message: `Um item do seu pedido foi enviado!${orderItem.trackingCode ? ` Codigo de rastreio: ${orderItem.trackingCode}` : ''}`,
      metadata: { orderId: orderItem.orderId, orderItemId: orderItem.id, trackingCode: orderItem.trackingCode },
    }).catch(() => {});

    // Fire-and-forget: send shipping email to buyer
    if (orderItem.trackingCode) {
      void (async () => {
        try {
          const buyer = await prisma.user.findUnique({
            where: { id: orderItem.order.buyerId },
            select: { name: true, email: true },
          });
          const itemWithCatalog = await prisma.orderItem.findUnique({
            where: { id: orderItem.id },
            include: {
              collectionItem: {
                include: {
                  catalogEntry: { select: { title: true } },
                },
              },
            },
          });
          if (buyer && itemWithCatalog) {
            const itemTitle =
              itemWithCatalog.collectionItem?.catalogEntry?.title ?? 'Item do catalogo';
            void sendOrderShippedEmail(orderItem.order.buyerId, buyer.email, {
              userName: buyer.name,
              orderNumber: orderItem.order.orderNumber,
              trackingCode: orderItem.trackingCode!,
              itemTitle,
            });
          }
        } catch {
          // Non-blocking
        }
      })();
    }
  } else if (newStatus === 'DELIVERED') {
    createNotification({
      userId: orderItem.order.buyerId,
      type: 'ORDER_SHIPPED',
      title: 'Pedido entregue',
      message: 'Um item do seu pedido foi marcado como entregue.',
      metadata: { orderId: orderItem.orderId, orderItemId: orderItem.id },
    }).catch(() => {});
  }

  // Check if all items in the order have reached a terminal state
  await syncOrderStatus(orderItem.orderId);

  return updatedItem;
}

// === Cancel Order ===

export async function cancelOrder(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.buyerId !== userId) {
    throw new ForbiddenError('Only the buyer can cancel an order');
  }

  // Validate order-level transition
  assertOrderTransition(order.status, 'CANCELLED');

  // Cancel all eligible items (not already COMPLETED, SHIPPED, or DELIVERED)
  const terminalStatuses = ['COMPLETED', 'SHIPPED', 'DELIVERED'];
  const cancellableItems = order.orderItems.filter(
    (item) => !terminalStatuses.includes(item.status),
  );

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Cancel each eligible item
    for (const item of cancellableItems) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
      });
    }

    // Update order status to CANCELLED
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  });

  // Return updated order
  const updated = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderIncludes(),
  });

  return updated ? resolveOrderCovers(updated) : null;
}

// === Helper: Sync Order Status from Items ===

async function syncOrderStatus(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
  });

  const allCompleted = items.every((item) => item.status === 'COMPLETED');
  const allCancelled = items.every((item) => item.status === 'CANCELLED');

  if (allCompleted) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });
  } else if (allCancelled) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  }
}
