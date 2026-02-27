import { prisma } from '../../shared/lib/prisma';
import { generateOrderNumber } from '../../shared/lib/order-number';
import { roundCurrency } from '../../shared/lib/currency';
import { getCommissionRate, calculateCommission } from '../commission/commission.service';
import { assertOrderTransition, assertOrderItemTransition } from '../../shared/lib/order-state-machine';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/utils/api-error';

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
              },
            },
          },
        },
      },
    },
  };
}

// === Create Order from Cart (ORDR-01 through ORDR-07) ===

export async function createOrder(buyerId: string, shippingAddressId: string) {
  return prisma.$transaction(async (tx) => {
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

    // 4. Build order items with price/commission snapshots
    let totalAmount = 0;
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

      // a. Get seller's current subscription plan
      const subscription = await tx.subscription.findFirst({
        where: { userId: sellerId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      const planType = subscription?.planType ?? 'FREE';

      // b. Get commission rate for seller's plan
      const commissionRate = await getCommissionRate(planType);

      // c. Calculate commission and seller net
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
    }

    totalAmount = roundCurrency(totalAmount);

    // 5. Snapshot shipping address as JSON
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

    // 6. Create order with nested order items
    const order = await tx.order.create({
      data: {
        orderNumber,
        buyerId,
        totalAmount,
        shippingAddressSnapshot,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: orderIncludes(),
    });

    // 7. Clear buyer's cart (delete all cart items)
    await tx.cartItem.deleteMany({
      where: { userId: buyerId },
    });

    return order;
  });
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

  return order;
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

  return order;
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

  const [orders, total] = await Promise.all([
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

  const [orders, total] = await Promise.all([
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

  // Buyers can only confirm delivery or open dispute
  if (isBuyer && !isSeller) {
    const buyerAllowed = ['COMPLETED', 'DISPUTED'];
    if (!buyerAllowed.includes(newStatus)) {
      throw new ForbiddenError('Buyers can only confirm delivery or open disputes');
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
  if (newStatus === 'COMPLETED') {
    await prisma.collectionItem.update({
      where: { id: orderItem.collectionItemId },
      data: {
        isForSale: false,
        salePrice: null,
      },
    });
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
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderIncludes(),
  });
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
