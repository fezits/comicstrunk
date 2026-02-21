import { PrismaClient, PlanType, BillingInterval, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const adminPasswordHash = hashSync('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@comicstrunk.com' },
    update: {},
    create: {
      email: 'admin@comicstrunk.com',
      name: 'Admin',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      acceptedTermsAt: new Date(),
    },
  });
  console.log(`  Admin user: ${admin.email} (${admin.id})`);

  // Create default plan configs
  const freePlan = await prisma.planConfig.upsert({
    where: { id: 'plan-free-monthly' },
    update: {},
    create: {
      id: 'plan-free-monthly',
      planType: PlanType.FREE,
      name: 'Gratuito',
      price: 0,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 50,
      commissionRate: 0.1, // 10%
      trialDays: 0,
      isActive: true,
    },
  });
  console.log(`  Plan config: ${freePlan.name} (${freePlan.id})`);

  const basicPlan = await prisma.planConfig.upsert({
    where: { id: 'plan-basic-monthly' },
    update: {},
    create: {
      id: 'plan-basic-monthly',
      planType: PlanType.BASIC,
      name: 'Basico',
      price: 14.9,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 0,
      isActive: true,
    },
  });
  console.log(`  Plan config: ${basicPlan.name} (${basicPlan.id})`);

  // Create default commission configs
  const freeCommission = await prisma.commissionConfig.upsert({
    where: { id: 'commission-free' },
    update: {},
    create: {
      id: 'commission-free',
      planType: PlanType.FREE,
      rate: 0.1, // 10%
      isActive: true,
    },
  });
  console.log(`  Commission config: FREE ${freeCommission.rate} (${freeCommission.id})`);

  const basicCommission = await prisma.commissionConfig.upsert({
    where: { id: 'commission-basic' },
    update: {},
    create: {
      id: 'commission-basic',
      planType: PlanType.BASIC,
      rate: 0.08, // 8%
      isActive: true,
    },
  });
  console.log(`  Commission config: BASIC ${basicCommission.rate} (${basicCommission.id})`);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
