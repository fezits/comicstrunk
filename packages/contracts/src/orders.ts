import { z } from 'zod';

// === Order Schemas ===

export const createOrderSchema = z.object({
  shippingAddressId: z.string(),
});

export const updateOrderItemStatusSchema = z.object({
  status: z.enum([
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'DISPUTED',
    'REFUNDED',
  ]),
});

export const updateTrackingSchema = z.object({
  trackingCode: z.string().min(1).max(100),
  carrier: z.string().min(1).max(100),
});

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  collectionItemId: z.string(),
  sellerId: z.string(),
  priceSnapshot: z.number(),
  commissionRateSnapshot: z.number(),
  commissionAmountSnapshot: z.number(),
  sellerNetSnapshot: z.number(),
  status: z.string(),
  trackingCode: z.string().nullable(),
  carrier: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  buyerId: z.string(),
  status: z.string(),
  shippingAddressSnapshot: z.unknown(),
  totalAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  orderItems: z.array(orderItemSchema),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'PENDING',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ])
    .optional(),
});

// === Inferred Types ===

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderItemStatusInput = z.infer<typeof updateOrderItemStatusSchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
