import { prisma } from '../../shared/lib/prisma';
import { roundCurrency } from '../../shared/lib/currency';
import { NotFoundError } from '../../shared/utils/api-error';
import type {
  CreateCommissionConfigInput,
  UpdateCommissionConfigInput,
} from '@comicstrunk/contracts';

// === Default commission rates by plan ===

const DEFAULT_RATES: Record<string, number> = {
  FREE: 0.1, // 10%
  BASIC: 0.08, // 8%
};

/**
 * Ensures default commission configs exist in the database.
 * Called lazily on first getCommissionRate if no configs found.
 */
async function ensureDefaultConfigs(): Promise<void> {
  const count = await prisma.commissionConfig.count();
  if (count > 0) return;

  await prisma.commissionConfig.createMany({
    data: [
      { planType: 'FREE', rate: DEFAULT_RATES.FREE, isActive: true },
      { planType: 'BASIC', rate: DEFAULT_RATES.BASIC, isActive: true },
    ],
  });
  console.log('[Commission] Seeded default commission configs: FREE=10%, BASIC=8%');
}

/**
 * Get the active commission rate for a given plan type.
 * Falls back to 0.10 (10%) if no config found.
 */
export async function getCommissionRate(planType: string): Promise<number> {
  await ensureDefaultConfigs();

  const config = await prisma.commissionConfig.findFirst({
    where: { planType: planType as 'FREE' | 'BASIC', isActive: true },
  });

  return config ? Number(config.rate) : DEFAULT_RATES.FREE;
}

/**
 * Calculate commission and seller net from a price and rate.
 */
export function calculateCommission(
  price: number,
  commissionRate: number,
): { commission: number; sellerNet: number; rate: number } {
  const commission = roundCurrency(price * commissionRate);
  const sellerNet = roundCurrency(price - commission);
  return { commission, sellerNet, rate: commissionRate };
}

/**
 * Preview commission for a seller based on their subscription plan.
 */
export async function previewCommission(
  price: number,
  userId: string,
): Promise<{
  price: number;
  commissionRate: number;
  commissionAmount: number;
  sellerNet: number;
}> {
  // Look up user's subscription to determine plan type
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  const planType = subscription?.planType ?? 'FREE';
  const commissionRate = await getCommissionRate(planType);
  const { commission, sellerNet } = calculateCommission(price, commissionRate);

  return {
    price,
    commissionRate,
    commissionAmount: commission,
    sellerNet,
  };
}

// === Admin CRUD for commission configs ===

export async function listCommissionConfigs() {
  return prisma.commissionConfig.findMany({
    orderBy: { planType: 'asc' },
  });
}

export async function getCommissionConfig(id: string) {
  const config = await prisma.commissionConfig.findUnique({ where: { id } });
  if (!config) {
    throw new NotFoundError('Commission config not found');
  }
  return config;
}

export async function createCommissionConfig(data: CreateCommissionConfigInput) {
  return prisma.commissionConfig.create({
    data: {
      planType: data.planType,
      rate: data.rate,
      minRate: data.minRate ?? null,
      maxRate: data.maxRate ?? null,
      isActive: data.isActive,
    },
  });
}

export async function updateCommissionConfig(id: string, data: UpdateCommissionConfigInput) {
  // Verify the config exists
  await getCommissionConfig(id);

  return prisma.commissionConfig.update({
    where: { id },
    data: {
      ...(data.planType !== undefined && { planType: data.planType }),
      ...(data.rate !== undefined && { rate: data.rate }),
      ...(data.minRate !== undefined && { minRate: data.minRate }),
      ...(data.maxRate !== undefined && { maxRate: data.maxRate }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}
