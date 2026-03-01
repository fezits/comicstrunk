import { z } from 'zod';

// === Bank Account Schemas ===

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1).max(100),
  branchNumber: z.string().min(1).max(20),
  accountNumber: z.string().min(1).max(30),
  cpf: z.string().min(11).max(14),
  holderName: z.string().min(1).max(200),
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  isPrimary: z.boolean().default(false),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export const bankAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  bankName: z.string(),
  branchNumber: z.string(),
  accountNumber: z.string(),
  cpf: z.string(),
  holderName: z.string(),
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminBankAccountListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  userId: z.string().optional(),
});

// === Inferred Types ===

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankAccount = z.infer<typeof bankAccountSchema>;
export type AdminBankAccountListInput = z.infer<typeof adminBankAccountListSchema>;
