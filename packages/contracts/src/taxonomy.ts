import { z } from 'zod';

// === Category Schemas ===
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// === Tag Schemas ===
export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
});

export const updateTagSchema = createTagSchema.partial();

// === Character Schemas ===
export const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(2000).trim().optional(),
});

export const updateCharacterSchema = createCharacterSchema.partial();

// === Inferred Types ===
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
