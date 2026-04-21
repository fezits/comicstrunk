import { prisma } from '../../shared/lib/prisma';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/utils/api-error';
import type {
  CreateShippingAddressInput,
  UpdateShippingAddressInput,
  CreateShippingMethodInput,
  UpdateShippingMethodInput,
  UpdateTrackingInput,
} from '@comicstrunk/contracts';

// =============================================================================
// ADDRESS CRUD (SHIP-01, SHIP-02)
// =============================================================================

export async function createAddress(userId: string, data: CreateShippingAddressInput) {
  // Check if user has any addresses
  const existingCount = await prisma.shippingAddress.count({ where: { userId } });
  const shouldBeDefault = data.isDefault || existingCount === 0;

  if (shouldBeDefault) {
    // Use transaction: unset all existing defaults, then create with isDefault=true
    return prisma.$transaction(async (tx) => {
      await tx.shippingAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.shippingAddress.create({
        data: {
          userId,
          label: data.label,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          isDefault: true,
        },
      });
    });
  }

  return prisma.shippingAddress.create({
    data: {
      userId,
      label: data.label,
      street: data.street,
      number: data.number,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      isDefault: false,
    },
  });
}

export async function listAddresses(userId: string) {
  return prisma.shippingAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getAddress(userId: string, addressId: string) {
  const address = await prisma.shippingAddress.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  if (address.userId !== userId) {
    throw new ForbiddenError('You can only access your own addresses');
  }

  return address;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  data: UpdateShippingAddressInput,
) {
  // Verify ownership
  const address = await prisma.shippingAddress.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  if (address.userId !== userId) {
    throw new ForbiddenError('You can only update your own addresses');
  }

  if (data.isDefault) {
    // Use transaction: unset all defaults, then update this one
    return prisma.$transaction(async (tx) => {
      await tx.shippingAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.shippingAddress.update({
        where: { id: addressId },
        data,
      });
    });
  }

  return prisma.shippingAddress.update({
    where: { id: addressId },
    data,
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  // Verify ownership
  const address = await prisma.shippingAddress.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  if (address.userId !== userId) {
    throw new ForbiddenError('You can only delete your own addresses');
  }

  const wasDefault = address.isDefault;

  await prisma.shippingAddress.delete({ where: { id: addressId } });

  // If deleted address was default, promote the most recent remaining address
  if (wasDefault) {
    const mostRecent = await prisma.shippingAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (mostRecent) {
      await prisma.shippingAddress.update({
        where: { id: mostRecent.id },
        data: { isDefault: true },
      });
    }
  }
}

export async function setDefaultAddress(userId: string, addressId: string) {
  // Verify ownership
  const address = await prisma.shippingAddress.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  if (address.userId !== userId) {
    throw new ForbiddenError('You can only set default on your own addresses');
  }

  return prisma.$transaction(async (tx) => {
    await tx.shippingAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return tx.shippingAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });
}

// =============================================================================
// SHIPPING METHODS (SHIP-03)
// =============================================================================

export async function listShippingMethods() {
  return prisma.shippingMethod.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function listActiveShippingMethods() {
  return prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function createShippingMethod(data: CreateShippingMethodInput) {
  return prisma.shippingMethod.create({
    data: {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    },
  });
}

export async function updateShippingMethod(id: string, data: UpdateShippingMethodInput) {
  const method = await prisma.shippingMethod.findUnique({ where: { id } });

  if (!method) {
    throw new NotFoundError('Shipping method not found');
  }

  return prisma.shippingMethod.update({
    where: { id },
    data,
  });
}

export async function deleteShippingMethod(id: string) {
  const method = await prisma.shippingMethod.findUnique({ where: { id } });

  if (!method) {
    throw new NotFoundError('Shipping method not found');
  }

  await prisma.shippingMethod.delete({ where: { id } });
}

// =============================================================================
// TRACKING UPDATE (SHIP-04, SHIP-05)
// =============================================================================

export async function updateTracking(
  sellerId: string,
  orderItemId: string,
  data: UpdateTrackingInput,
) {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });

  if (!orderItem) {
    throw new NotFoundError('Order item not found');
  }

  // Verify the seller owns this order item
  if (orderItem.sellerId !== sellerId) {
    throw new ForbiddenError('You can only update tracking for your own order items');
  }

  // Only allow tracking update when status is PROCESSING
  if (orderItem.status !== 'PROCESSING') {
    throw new BadRequestError(
      `Cannot add tracking when item status is ${orderItem.status}. Item must be in PROCESSING status.`,
    );
  }

  const updated = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: {
      trackingCode: data.trackingCode,
      carrier: data.carrier,
      shippedAt: new Date(),
      status: 'SHIPPED',
    },
  });

  // SHIP-05: Placeholder for buyer notification (deferred to Phase 7)
  console.log(`[SHIPPING] Tracking updated for order item ${orderItemId}`);

  return updated;
}
