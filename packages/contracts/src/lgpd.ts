import { z } from 'zod';
import { paginationSchema } from './common';

// === Enums ===

export const dataRequestTypeEnum = z.enum(['ACCESS', 'CORRECTION', 'DELETION', 'EXPORT']);
export const dataRequestStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']);

// === Schemas ===

export const createDataRequestSchema = z.object({
  type: dataRequestTypeEnum,
  details: z.string().max(5000, 'Detalhes devem ter no maximo 5000 caracteres').optional(),
});

export const listDataRequestsSchema = paginationSchema.extend({
  status: dataRequestStatusEnum.optional(),
  type: dataRequestTypeEnum.optional(),
});

export const rejectDataRequestSchema = z.object({
  reason: z.string().min(1, 'Motivo da rejeicao e obrigatorio').max(5000),
});

// === Types ===

export type DataRequestType = z.infer<typeof dataRequestTypeEnum>;
export type DataRequestStatus = z.infer<typeof dataRequestStatusEnum>;
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;
export type ListDataRequestsInput = z.infer<typeof listDataRequestsSchema>;
export type RejectDataRequestInput = z.infer<typeof rejectDataRequestSchema>;
