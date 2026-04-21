import { z } from 'zod';
import { paginationSchema } from './common';

export const disputeReasonEnum = z.enum([
  'NOT_RECEIVED',
  'DIFFERENT_FROM_LISTING',
  'DAMAGED_IN_TRANSIT',
  'NOT_SHIPPED_ON_TIME',
]);

export const disputeStatusEnum = z.enum([
  'OPEN',
  'IN_MEDIATION',
  'RESOLVED_REFUND',
  'RESOLVED_PARTIAL_REFUND',
  'RESOLVED_NO_REFUND',
  'CANCELLED',
]);

export const createDisputeSchema = z.object({
  orderItemId: z.string().min(1, 'ID do item é obrigatório'),
  reason: disputeReasonEnum,
  description: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres').max(5000),
});

export const submitDisputeResponseSchema = z.object({
  message: z.string().min(10, 'Resposta deve ter no mínimo 10 caracteres').max(5000),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(['RESOLVED_REFUND', 'RESOLVED_PARTIAL_REFUND', 'RESOLVED_NO_REFUND']),
  resolution: z.string().min(10, 'Justificativa deve ter no mínimo 10 caracteres').max(5000),
  refundAmount: z.number().positive('Valor deve ser positivo').optional(),
});

export const addDisputeMessageSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(5000),
});

export const listDisputesSchema = paginationSchema.extend({
  status: disputeStatusEnum.optional(),
});

export const addEvidenceSchema = z.object({
  description: z.string().max(500).optional(),
});

// Types
export type DisputeReason = z.infer<typeof disputeReasonEnum>;
export type DisputeStatus = z.infer<typeof disputeStatusEnum>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type SubmitDisputeResponseInput = z.infer<typeof submitDisputeResponseSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type AddDisputeMessageInput = z.infer<typeof addDisputeMessageSchema>;
export type ListDisputesInput = z.infer<typeof listDisputesSchema>;
