import { BadRequestError } from '../utils/api-error';

// === Order Status Transitions ===

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
};

// === Order Item Status Transitions ===

export const ORDER_ITEM_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED', 'REFUNDED'],
  REFUNDED: [],
};

/**
 * Assert that an order status transition is valid.
 * Throws BadRequestError if the transition is not allowed.
 */
export function assertOrderTransition(current: string, next: string): void {
  const allowed = ORDER_TRANSITIONS[current];
  if (!allowed) {
    throw new BadRequestError(`Unknown order status: ${current}`);
  }
  if (!allowed.includes(next)) {
    throw new BadRequestError(
      `Invalid order transition: ${current} -> ${next}. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
}

/**
 * Assert that an order item status transition is valid.
 * Throws BadRequestError if the transition is not allowed.
 */
export function assertOrderItemTransition(current: string, next: string): void {
  const allowed = ORDER_ITEM_TRANSITIONS[current];
  if (!allowed) {
    throw new BadRequestError(`Unknown order item status: ${current}`);
  }
  if (!allowed.includes(next)) {
    throw new BadRequestError(
      `Invalid order item transition: ${current} -> ${next}. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
}
