import { prisma } from '../../shared/lib/prisma';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../shared/utils/api-error';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';

// === Constants ===

const CART_ITEM_LIMIT = 50;
const RESERVATION_HOURS = 24;

// === Cart includes for rich responses ===

function cartItemIncludes() {
  return {
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
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  };
}

/** Resolve cover URLs for the catalog entry nested inside a cart item's collectionItem */
function resolveCartItemCovers<T extends {
  collectionItem: { catalogEntry: { coverImageUrl: string | null; coverFileName?: string | null } } | null;
  [key: string]: unknown;
}>(item: T): T {
  if (!item.collectionItem?.catalogEntry) return item;
  return {
    ...item,
    collectionItem: {
      ...item.collectionItem,
      catalogEntry: resolveCoverUrl(item.collectionItem.catalogEntry),
    },
  };
}

// === Add to Cart with Atomic Reservation (CART-01, CART-02, CART-06, CART-07) ===

export async function addToCart(userId: string, collectionItemId: string) {
  const cartItem = await prisma.$transaction(async (tx) => {
    // 1. Find the collection item (include user for ownership check)
    const item = await tx.collectionItem.findUnique({
      where: { id: collectionItemId },
      include: { user: { select: { id: true } } },
    });

    if (!item) {
      throw new NotFoundError('Collection item not found');
    }

    // 2. Check item is for sale
    if (!item.isForSale) {
      throw new BadRequestError('This item is not for sale');
    }

    // 3. Self-purchase prevention (CART-06)
    if (item.userId === userId) {
      throw new BadRequestError('Cannot add your own item to cart');
    }

    // 4. Check if already reserved by anyone (CART-07)
    const now = new Date();
    const existingReservation = await tx.cartItem.findFirst({
      where: {
        collectionItemId,
        expiresAt: { gt: now },
      },
    });

    if (existingReservation) {
      throw new ConflictError('This item is already reserved');
    }

    // 5. Check cart limit (CART-02)
    const activeCartCount = await tx.cartItem.count({
      where: {
        userId,
        expiresAt: { gt: now },
      },
    });

    if (activeCartCount >= CART_ITEM_LIMIT) {
      throw new BadRequestError(`Cart limit reached (maximum ${CART_ITEM_LIMIT} items)`);
    }

    // 6. Create CartItem with 24-hour reservation (CART-01)
    const expiresAt = new Date(now.getTime() + RESERVATION_HOURS * 60 * 60 * 1000);

    const cartItem = await tx.cartItem.create({
      data: {
        userId,
        collectionItemId,
        reservedAt: now,
        expiresAt,
      },
      include: cartItemIncludes(),
    });

    return cartItem;
  });

  return resolveCartItemCovers(cartItem);
}

// === Get Cart (CART-03, CART-04) ===

export async function getCart(userId: string) {
  const now = new Date();

  const items = await prisma.cartItem.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    include: cartItemIncludes(),
    orderBy: { createdAt: 'desc' },
  });

  // Add remaining time info and resolve cover URLs
  return items.map((item) => ({
    ...resolveCartItemCovers(item),
    remainingMs: item.expiresAt.getTime() - now.getTime(),
  }));
}

// === Remove from Cart (CART-05) ===

export async function removeFromCart(userId: string, cartItemId: string) {
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
  });

  if (!cartItem) {
    throw new NotFoundError('Cart item not found');
  }

  if (cartItem.userId !== userId) {
    throw new ForbiddenError('You can only remove your own cart items');
  }

  await prisma.cartItem.delete({ where: { id: cartItemId } });
}

// === Clear Cart ===

export async function clearCart(userId: string) {
  const now = new Date();

  const result = await prisma.cartItem.deleteMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
  });

  return { deletedCount: result.count };
}

// === Cart Summary ===

export async function getCartSummary(userId: string) {
  const now = new Date();

  const items = await prisma.cartItem.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    include: {
      collectionItem: {
        select: { salePrice: true },
      },
    },
  });

  const totalAmount = items.reduce((sum, item) => {
    return sum + Number(item.collectionItem.salePrice ?? 0);
  }, 0);

  return {
    itemCount: items.length,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}
