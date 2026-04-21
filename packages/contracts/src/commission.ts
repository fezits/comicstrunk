import { z } from 'zod';

// === Commission Config Schemas ===

export const commissionConfigSchema = z.object({
  id: z.string(),
  planType: z.enum(['FREE', 'BASIC']),
  rate: z.number(),
  minRate: z.number().nullable(),
  maxRate: z.number().nullable(),
  isActive: z.boolean(),
});

export const createCommissionConfigSchema = z.object({
  planType: z.enum(['FREE', 'BASIC']),
  rate: z.number().min(0).max(1),
  minRate: z.number().min(0).max(1).optional(),
  maxRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().default(true),
});

export const updateCommissionConfigSchema = createCommissionConfigSchema.partial();

export const commissionPreviewSchema = z.object({
  price: z.coerce.number().positive(),
});

// === Inferred Types ===

export type CommissionConfig = z.infer<typeof commissionConfigSchema>;
export type CreateCommissionConfigInput = z.infer<typeof createCommissionConfigSchema>;
export type UpdateCommissionConfigInput = z.infer<typeof updateCommissionConfigSchema>;
export type CommissionPreviewInput = z.infer<typeof commissionPreviewSchema>;
