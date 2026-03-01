import { z } from 'zod';
import { paginationSchema } from './common';

// Enums
export const dealTypeEnum = z.enum(['COUPON', 'PROMOTION']);

// Partner Store schemas
export const createPartnerStoreSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  slug: z
    .string()
    .min(1, 'Slug é obrigatório')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  affiliateTag: z.string().min(1, 'Tag de afiliado é obrigatória').max(200),
  baseUrl: z.string().url('URL base inválida'),
  logoUrl: z.string().url('URL do logo inválida').optional(),
});

export const updatePartnerStoreSchema = createPartnerStoreSchema.partial();

export const listPartnerStoresSchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
});

// Deal schemas
export const createDealSchema = z.object({
  storeId: z.string().min(1, 'Loja é obrigatória'),
  type: dealTypeEnum,
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(5000).optional(),
  couponCode: z.string().max(50).optional(),
  discount: z.string().min(1, 'Desconto é obrigatório').max(50),
  affiliateBaseUrl: z.string().url('URL de afiliado inválida'),
  categoryId: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const listDealsSchema = paginationSchema.extend({
  storeId: z.string().optional(),
  categoryId: z.string().optional(),
  type: dealTypeEnum.optional(),
  sort: z.enum(['newest', 'discount', 'expiring']).optional(),
});

// Types
export type DealType = z.infer<typeof dealTypeEnum>;
export type CreatePartnerStoreInput = z.infer<typeof createPartnerStoreSchema>;
export type UpdatePartnerStoreInput = z.infer<typeof updatePartnerStoreSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type ListDealsInput = z.infer<typeof listDealsSchema>;
export type ListPartnerStoresInput = z.infer<typeof listPartnerStoresSchema>;
