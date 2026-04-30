import { z } from 'zod';

// === Admin List Users Schema ===

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  role: z.enum(['USER', 'SUBSCRIBER', 'ADMIN']).optional(),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

// === Admin Update User Role Schema ===

export const updateUserRoleSchema = z.object({
  role: z.enum(['USER', 'SUBSCRIBER', 'ADMIN']),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

// === Admin Suspend User Schema ===

export const suspendUserSchema = z.object({
  reason: z.string().min(10, 'O motivo deve ter pelo menos 10 caracteres'),
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

// === Admin Dismiss Duplicate Pair Schema ===

export const dismissDuplicateSchema = z.object({
  sourceKeyA: z.string().min(1).max(255),
  sourceKeyB: z.string().min(1).max(255),
});

export type DismissDuplicateInput = z.infer<typeof dismissDuplicateSchema>;
