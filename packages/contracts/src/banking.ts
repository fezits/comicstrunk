import { z } from 'zod';

// === Bank Account Schemas ===

export const pixKeyTypeSchema = z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']);
export type PixKeyType = z.infer<typeof pixKeyTypeSchema>;

const pixPair = {
  pixKey: z.string().max(80).optional().nullable(),
  pixKeyType: pixKeyTypeSchema.optional().nullable(),
};

export const createBankAccountSchema = z
  .object({
    bankName: z.string().min(1).max(100),
    branchNumber: z.string().min(1).max(20),
    accountNumber: z.string().min(1).max(30),
    cpf: z.string().min(11).max(14),
    holderName: z.string().min(1).max(200),
    accountType: z.enum(['CHECKING', 'SAVINGS']),
    isPrimary: z.boolean().default(false),
    ...pixPair,
  })
  .refine(
    (v) => (v.pixKey == null) === (v.pixKeyType == null),
    {
      message: 'pixKey e pixKeyType devem ser preenchidos juntos',
      path: ['pixKey'],
    },
  );

export const updateBankAccountSchema = z
  .object({
    bankName: z.string().min(1).max(100).optional(),
    branchNumber: z.string().min(1).max(20).optional(),
    accountNumber: z.string().min(1).max(30).optional(),
    cpf: z.string().min(11).max(14).optional(),
    holderName: z.string().min(1).max(200).optional(),
    accountType: z.enum(['CHECKING', 'SAVINGS']).optional(),
    isPrimary: z.boolean().optional(),
    ...pixPair,
  })
  .refine(
    (v) => {
      // Allow either both undefined (no change) OR both null (clearing) OR both filled.
      const keySet = v.pixKey !== undefined;
      const typeSet = v.pixKeyType !== undefined;
      if (keySet !== typeSet) return false;
      if (keySet && (v.pixKey == null) !== (v.pixKeyType == null)) return false;
      return true;
    },
    {
      message: 'pixKey e pixKeyType devem ser preenchidos juntos',
      path: ['pixKey'],
    },
  );

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
  pixKey: z.string().nullable(),
  pixKeyType: pixKeyTypeSchema.nullable(),
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
