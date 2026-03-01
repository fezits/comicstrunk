import { z } from 'zod';
import { paginationSchema } from './common';

// === Contact Category Values ===

export const CONTACT_CATEGORIES = ['SUGGESTION', 'PROBLEM', 'PARTNERSHIP', 'OTHER'] as const;

export type ContactCategoryValue = (typeof CONTACT_CATEGORIES)[number];

// === Create Contact Message Schema ===

export const createContactMessageSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  email: z.string().email('E-mail invalido'),
  category: z.enum(CONTACT_CATEGORIES, {
    errorMap: () => ({ message: 'Categoria invalida' }),
  }),
  subject: z.string().min(1, 'Assunto e obrigatorio').max(200, 'Assunto deve ter no maximo 200 caracteres'),
  message: z
    .string()
    .min(10, 'Mensagem deve ter no minimo 10 caracteres')
    .max(5000, 'Mensagem deve ter no maximo 5000 caracteres'),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;

// === List Contact Messages Schema (admin) ===

export const listContactMessagesSchema = paginationSchema.extend({
  isRead: z.coerce.boolean().optional(),
  isResolved: z.coerce.boolean().optional(),
  category: z.enum(CONTACT_CATEGORIES).optional(),
});

export type ListContactMessagesInput = z.infer<typeof listContactMessagesSchema>;
