import { z } from 'zod';
import { paginationSchema } from './common';

// === Payment Schemas ===

export const initiatePaymentSchema = z.object({
  orderId: z.string(),
});

export const paymentStatusSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  method: z.string(),
  providerPaymentId: z.string().nullable(),
  providerStatus: z.string().nullable(),
  amount: z.number(),
  pixQrCode: z.string().nullable(),
  pixCopyPaste: z.string().nullable(),
  pixExpiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  refundedAmount: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminApprovePaymentSchema = z.object({
  orderId: z.string(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
});

export const listPaymentsSchema = paginationSchema.extend({
  status: z.string().optional(),
});

// === Inferred Types ===

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type AdminApprovePaymentInput = z.infer<typeof adminApprovePaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
