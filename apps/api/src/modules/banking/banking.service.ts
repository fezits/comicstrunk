import { cpf } from 'cpf-cnpj-validator';
import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/utils/api-error';
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  AdminBankAccountListInput,
} from '@comicstrunk/contracts';

// =============================================================================
// CPF VALIDATION HELPER
// =============================================================================

function validateAndStripCpf(rawCpf: string): string {
  if (!cpf.isValid(rawCpf)) {
    throw new BadRequestError('Invalid CPF');
  }
  return cpf.strip(rawCpf);
}

// =============================================================================
// SELLER BANK ACCOUNT CRUD
// =============================================================================

/**
 * Create a new bank account for a seller.
 * Validates CPF, auto-sets as primary if it is the user's first account.
 * Uses transaction to enforce single-primary constraint.
 */
export async function createBankAccount(userId: string, data: CreateBankAccountInput) {
  const cleanCpf = validateAndStripCpf(data.cpf);

  // Check if user has any existing accounts
  const existingCount = await prisma.bankAccount.count({ where: { userId } });
  const shouldBePrimary = data.isPrimary || existingCount === 0;

  if (shouldBePrimary) {
    // Use transaction: unset all existing primary flags, then create with isPrimary=true
    return prisma.$transaction(async (tx) => {
      await tx.bankAccount.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      return tx.bankAccount.create({
        data: {
          userId,
          bankName: data.bankName,
          branchNumber: data.branchNumber,
          accountNumber: data.accountNumber,
          cpf: cleanCpf,
          holderName: data.holderName,
          accountType: data.accountType,
          isPrimary: true,
          pixKey: data.pixKey ?? null,
          pixKeyType: data.pixKeyType ?? null,
        },
      });
    });
  }

  return prisma.bankAccount.create({
    data: {
      userId,
      bankName: data.bankName,
      branchNumber: data.branchNumber,
      accountNumber: data.accountNumber,
      cpf: cleanCpf,
      holderName: data.holderName,
      accountType: data.accountType,
      isPrimary: false,
      pixKey: data.pixKey ?? null,
      pixKeyType: data.pixKeyType ?? null,
    },
  });
}

/**
 * List all bank accounts for a user, ordered by creation date (newest first).
 */
export async function listUserBankAccounts(userId: string) {
  return prisma.bankAccount.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Get a single bank account by ID. Validates ownership.
 */
export async function getBankAccount(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new NotFoundError('Bank account not found');
  }

  if (account.userId !== userId) {
    throw new ForbiddenError('You can only access your own bank accounts');
  }

  return account;
}

/**
 * Update a bank account. Validates ownership and CPF if provided.
 * Enforces single-primary constraint via transaction.
 */
export async function updateBankAccount(
  userId: string,
  accountId: string,
  data: UpdateBankAccountInput,
) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new NotFoundError('Bank account not found');
  }

  if (account.userId !== userId) {
    throw new ForbiddenError('You can only update your own bank accounts');
  }

  // Validate CPF if provided in update
  const updateData: Record<string, unknown> = { ...data };
  if (data.cpf !== undefined) {
    updateData.cpf = validateAndStripCpf(data.cpf);
  }

  // If setting isPrimary to false, ensure it's not the only account
  if (data.isPrimary === false && account.isPrimary) {
    const totalAccounts = await prisma.bankAccount.count({ where: { userId } });
    if (totalAccounts <= 1) {
      throw new BadRequestError('Cannot unset primary on only account');
    }
  }

  // If setting isPrimary to true, use transaction to unset others
  if (data.isPrimary === true) {
    return prisma.$transaction(async (tx) => {
      await tx.bankAccount.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      return tx.bankAccount.update({
        where: { id: accountId },
        data: updateData,
      });
    });
  }

  return prisma.bankAccount.update({
    where: { id: accountId },
    data: updateData,
  });
}

/**
 * Delete a bank account. Validates ownership.
 * If the deleted account was primary and others remain, auto-promote the most recent.
 */
export async function deleteBankAccount(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new NotFoundError('Bank account not found');
  }

  if (account.userId !== userId) {
    throw new ForbiddenError('You can only delete your own bank accounts');
  }

  const wasPrimary = account.isPrimary;

  await prisma.bankAccount.delete({ where: { id: accountId } });

  // If deleted account was primary, promote the most recent remaining account
  if (wasPrimary) {
    const mostRecent = await prisma.bankAccount.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (mostRecent) {
      await prisma.bankAccount.update({
        where: { id: mostRecent.id },
        data: { isPrimary: true },
      });
    }
  }
}

/**
 * Set a bank account as the primary account.
 * Uses transaction to atomically swap the primary flag.
 */
export async function setPrimaryBankAccount(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new NotFoundError('Bank account not found');
  }

  if (account.userId !== userId) {
    throw new ForbiddenError('You can only set primary on your own bank accounts');
  }

  return prisma.$transaction(async (tx) => {
    await tx.bankAccount.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });

    return tx.bankAccount.update({
      where: { id: accountId },
      data: { isPrimary: true },
    });
  });
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Admin: List all bank accounts with user info. Supports pagination and userId filter.
 */
export async function adminListBankAccounts(filters: AdminBankAccountListInput) {
  const { page, limit, userId } = filters;
  const skip = (page - 1) * limit;

  const where = userId ? { userId } : {};

  const [accounts, total] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bankAccount.count({ where }),
  ]);

  return { accounts, total, page, limit };
}
