import { PrismaClient, PlanType, BillingInterval, UserRole, HomepageSectionType } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { seedCatalog } from './seed-catalog';
import { seedDeals } from './seed-deals';

const prisma = new PrismaClient();

async function seedHomepage() {
  console.log('\n  Seeding homepage sections...');

  const sections = [
    {
      id: 'homepage-banner-carousel',
      type: HomepageSectionType.BANNER_CAROUSEL,
      title: 'Destaques',
      sortOrder: 0,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-catalog-highlights',
      type: HomepageSectionType.CATALOG_HIGHLIGHTS,
      title: 'Catalogo em Destaque',
      sortOrder: 1,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-deals-of-day',
      type: HomepageSectionType.DEALS_OF_DAY,
      title: 'Ofertas do Dia',
      sortOrder: 2,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-featured-coupons',
      type: HomepageSectionType.FEATURED_COUPONS,
      title: 'Cupons em Destaque',
      sortOrder: 3,
      isVisible: true,
      contentRefs: {},
    },
  ];

  for (const section of sections) {
    const result = await prisma.homepageSection.upsert({
      where: { id: section.id },
      update: {
        title: section.title,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        contentRefs: section.contentRefs,
      },
      create: {
        id: section.id,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        contentRefs: section.contentRefs,
      },
    });
    console.log(`  Homepage section: ${result.title} (${result.type})`);
  }
}

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

  // Create default plan configs (FREE + BASIC for all billing intervals)
  const planConfigs = [
    {
      id: 'plan-free-monthly',
      planType: PlanType.FREE,
      name: 'Gratuito',
      price: 0,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 50,
      commissionRate: 0.1, // 10%
      trialDays: 0,
    },
    {
      id: 'plan-basic-monthly',
      planType: PlanType.BASIC,
      name: 'Basico Mensal',
      price: 9.9,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-quarterly',
      planType: PlanType.BASIC,
      name: 'Basico Trimestral',
      price: 24.9,
      billingInterval: BillingInterval.QUARTERLY,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-semiannual',
      planType: PlanType.BASIC,
      name: 'Basico Semestral',
      price: 44.9,
      billingInterval: BillingInterval.SEMIANNUAL,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-annual',
      planType: PlanType.BASIC,
      name: 'Basico Anual',
      price: 79.9,
      billingInterval: BillingInterval.ANNUAL,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
  ];

  for (const plan of planConfigs) {
    const result = await prisma.planConfig.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        collectionLimit: plan.collectionLimit,
        commissionRate: plan.commissionRate,
        trialDays: plan.trialDays,
        isActive: true,
      },
      create: {
        id: plan.id,
        planType: plan.planType,
        name: plan.name,
        price: plan.price,
        billingInterval: plan.billingInterval,
        collectionLimit: plan.collectionLimit,
        commissionRate: plan.commissionRate,
        trialDays: plan.trialDays,
        isActive: true,
      },
    });
    console.log(`  Plan config: ${result.name} (${result.id})`);
  }

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

  // Seed catalog data (categories, tags, characters, series, entries)
  await seedCatalog(admin.id);

  // Seed partner stores and deals
  await seedDeals();

  // Seed homepage sections
  await seedHomepage();

  console.log('\nSeeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
