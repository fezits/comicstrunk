import { Prisma } from '@prisma/client';
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
  // TRIALING status grants same benefits as ACTIVE (Phase 6 subscription support)
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
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

// === Admin: Commission Dashboard ===

interface CommissionByRate {
  rate: number;
  transaction_count: bigint;
  total_commission: number | null;
  total_sales: number | null;
}

export async function getCommissionDashboard(periodStart: Date, periodEnd: Date) {
  const validStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

  // Use raw SQL for efficient aggregation grouped by commission rate
  const byRate = await prisma.$queryRaw<CommissionByRate[]>`
    SELECT
      oi.commission_rate_snapshot as rate,
      COUNT(*) as transaction_count,
      SUM(oi.commission_amount_snapshot) as total_commission,
      SUM(oi.price_snapshot) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN (${Prisma.join(validStatuses)})
      AND o.created_at >= ${periodStart}
      AND o.created_at <= ${periodEnd}
    GROUP BY oi.commission_rate_snapshot
  `;

  // Compute totals from the grouped results
  let totalCommission = 0;
  let totalSales = 0;
  let transactionCount = 0;

  const byPlan = byRate.map((row) => {
    const commission = Number(row.total_commission ?? 0);
    const sales = Number(row.total_sales ?? 0);
    const count = Number(row.transaction_count);
    totalCommission += commission;
    totalSales += sales;
    transactionCount += count;

    return {
      rate: Number(row.rate),
      transactionCount: count,
      totalCommission: roundCurrency(commission),
      totalSales: roundCurrency(sales),
    };
  });

  return {
    byPlan,
    totals: {
      totalCommission: roundCurrency(totalCommission),
      totalSales: roundCurrency(totalSales),
      transactionCount,
    },
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
  };
}

// === Admin: Commission Transactions ===

export async function getCommissionTransactions(
  page: number,
  limit: number,
  periodStart?: Date,
  periodEnd?: Date,
) {
  const validStatuses = [
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
  ] as const;

  const where: Prisma.OrderItemWhereInput = {
    order: {
      status: { in: [...validStatuses] },
      ...(periodStart && periodEnd
        ? { createdAt: { gte: periodStart, lte: periodEnd } }
        : {}),
    },
  };

  const [transactions, total] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            buyer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        collectionItem: {
          select: {
            catalogEntry: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderItem.count({ where }),
  ]);

  // Flatten the response for easier consumption
  const mapped = transactions.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    orderNumber: item.order.orderNumber,
    orderStatus: item.order.status,
    orderCreatedAt: item.order.createdAt,
    buyerId: item.order.buyer.id,
    buyerName: item.order.buyer.name,
    buyerEmail: item.order.buyer.email,
    sellerId: item.sellerId,
    catalogEntryTitle: item.collectionItem.catalogEntry.title,
    priceSnapshot: Number(item.priceSnapshot),
    commissionRateSnapshot: Number(item.commissionRateSnapshot),
    commissionAmountSnapshot: Number(item.commissionAmountSnapshot),
    sellerNetSnapshot: Number(item.sellerNetSnapshot),
    status: item.status,
  }));

  return { transactions: mapped, total, page, limit };
}
