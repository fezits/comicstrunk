// Ensure NODE_ENV is set before anything else
process.env.NODE_ENV = 'test';

import { PrismaClient, PlanType, BillingInterval, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const TEST_USERS = [
  {
    email: 'admin@comicstrunk.com',
    name: 'Admin',
    password: 'Admin123!',
    role: UserRole.ADMIN,
    acceptedTermsAt: new Date(),
  },
  {
    email: 'user@test.com',
    name: 'Test User',
    password: 'Test1234',
    role: UserRole.USER,
    acceptedTermsAt: new Date(),
  },
  {
    email: 'subscriber@test.com',
    name: 'Subscriber User',
    password: 'Test1234',
    role: UserRole.SUBSCRIBER,
    acceptedTermsAt: new Date(),
  },
  {
    email: 'noterms@test.com',
    name: 'No Terms User',
    password: 'Test1234',
    role: UserRole.USER,
    acceptedTermsAt: new Date(), // required by schema, but used for edge case tests
  },
];

export async function setup() {
  const prisma = new PrismaClient();

  try {
    // Clean up test data in reverse dependency order
    await prisma.passwordReset.deleteMany({});
    await prisma.refreshToken.deleteMany({});

    // Delete test users (the ones we'll seed)
    for (const u of TEST_USERS) {
      await prisma.user.deleteMany({ where: { email: u.email } });
    }

    // Also clean up any users created during tests
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@test-signup',
        },
      },
    });

    // Seed test users
    for (const u of TEST_USERS) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          name: u.name,
          passwordHash: hashSync(u.password, 12),
          role: u.role,
          acceptedTermsAt: u.acceptedTermsAt,
        },
      });
    }

    // Seed plan configs
    await prisma.planConfig.upsert({
      where: { id: 'plan-free-monthly' },
      update: {},
      create: {
        id: 'plan-free-monthly',
        planType: PlanType.FREE,
        name: 'Gratuito',
        price: 0,
        billingInterval: BillingInterval.MONTHLY,
        collectionLimit: 50,
        commissionRate: 0.1,
        trialDays: 0,
        isActive: true,
      },
    });

    await prisma.planConfig.upsert({
      where: { id: 'plan-basic-monthly' },
      update: {},
      create: {
        id: 'plan-basic-monthly',
        planType: PlanType.BASIC,
        name: 'Basico',
        price: 14.9,
        billingInterval: BillingInterval.MONTHLY,
        collectionLimit: 200,
        commissionRate: 0.08,
        trialDays: 0,
        isActive: true,
      },
    });

    console.log('Test database seeded successfully');
  } catch (error) {
    console.error('Failed to seed test database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  const prisma = new PrismaClient();

  try {
    // Clean up test-created data
    await prisma.passwordReset.deleteMany({});
    await prisma.refreshToken.deleteMany({});

    // Clean up signup test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@test-signup',
        },
      },
    });

    console.log('Test database cleaned up');
  } catch (error) {
    console.error('Failed to clean up test database:', error);
  } finally {
    await prisma.$disconnect();
  }
}
