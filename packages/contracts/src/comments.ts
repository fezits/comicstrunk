import { z } from 'zod';
import { paginationSchema } from './common';

// === Comment Schemas ===

export const createCommentSchema = z.object({
  catalogEntryId: z.string().min(1),
  parentId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const catalogCommentsQuerySchema = paginationSchema.extend({
  catalogEntryId: z.string().min(1),
});

// === Comment Types ===

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CatalogCommentsQuery = z.infer<typeof catalogCommentsQuerySchema>;
