import { z } from 'zod';

// === Cart Schemas ===

export const addToCartSchema = z.object({
  collectionItemId: z.string(),
});

export const cartItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  collectionItemId: z.string(),
  reservedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  collectionItem: z.object({
    id: z.string(),
    title: z.string(),
    coverImageUrl: z.string().nullable(),
    salePrice: z.number().nullable(),
    condition: z.string(),
    seller: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
});

// === Inferred Types ===

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
