import { z } from 'zod';

// === Shipping Address Schemas ===

export const createShippingAddressSchema = z.object({
  label: z.string().max(50).optional(),
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z
    .string()
    .length(2, 'Estado deve ter 2 caracteres')
    .transform((v) => v.toUpperCase()),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000-000 ou 00000000'),
  isDefault: z.boolean().default(false),
});

export const updateShippingAddressSchema = createShippingAddressSchema.partial();

// === Shipping Method Schemas ===

export const shippingMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
});

export const createShippingMethodSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const updateShippingMethodSchema = createShippingMethodSchema.partial();

// === Inferred Types ===

export type CreateShippingAddressInput = z.infer<typeof createShippingAddressSchema>;
export type UpdateShippingAddressInput = z.infer<typeof updateShippingAddressSchema>;
export type ShippingAddress = z.infer<typeof shippingMethodSchema>;
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;
export type CreateShippingMethodInput = z.infer<typeof createShippingMethodSchema>;
export type UpdateShippingMethodInput = z.infer<typeof updateShippingMethodSchema>;
