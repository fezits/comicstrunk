// Ensure NODE_ENV is set before anything else
process.env.NODE_ENV = 'test';

import { PrismaClient, PlanType, BillingInterval, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import slugify from 'slugify';

// ============================================================================
// TEST DATA PREFIX — all test-created taxonomy/series use this prefix so
// cleanup can target ONLY test data without wiping seed/production data.
// ============================================================================
export const TEST_PREFIX = '_test_';

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
    acceptedTermsAt: new Date(),
  },
];

const TEST_CATEGORIES = [
  { name: `${TEST_PREFIX}Manga`, description: 'Quadrinhos japoneses (test)' },
  { name: `${TEST_PREFIX}Superhero`, description: 'Quadrinhos de super-herois (test)' },
  { name: `${TEST_PREFIX}Indie`, description: 'Quadrinhos independentes (test)' },
];

const TEST_TAGS = [
  { name: `${TEST_PREFIX}Shonen` },
  { name: `${TEST_PREFIX}Action` },
  { name: `${TEST_PREFIX}Classic` },
];

const TEST_CHARACTERS = [
  { name: `${TEST_PREFIX}Goku`, description: 'Protagonista de Dragon Ball (test)' },
  { name: `${TEST_PREFIX}Batman`, description: 'O Cavaleiro das Trevas (test)' },
  { name: `${TEST_PREFIX}Luffy`, description: 'Capitao dos Chapeu de Palha (test)' },
];

const TEST_SERIES = [
  { title: `${TEST_PREFIX}Dragon Ball`, description: 'Serie classica (test)', totalEditions: 42 },
  { title: `${TEST_PREFIX}One Piece`, description: 'A maior aventura pirata (test)', totalEditions: 105 },
  { title: `${TEST_PREFIX}Batman`, description: 'Serie iconica da DC (test)', totalEditions: 4 },
];

/**
 * Clean up ONLY test-created data. Never touches seed data.
 * Identifies test data by the _test_ prefix in names/titles.
 */
async function cleanupTestData(prisma: PrismaClient) {
  // Find test catalog entries (linked to test series)
  const testSeries = await prisma.series.findMany({
    where: { title: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const testSeriesIds = testSeries.map((s) => s.id);

  if (testSeriesIds.length > 0) {
    const testEntries = await prisma.catalogEntry.findMany({
      where: { seriesId: { in: testSeriesIds } },
      select: { id: true },
    });
    const testEntryIds = testEntries.map((e) => e.id);

    if (testEntryIds.length > 0) {
      await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: { in: testEntryIds } } });
      await prisma.catalogTag.deleteMany({ where: { catalogEntryId: { in: testEntryIds } } });
      await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: { in: testEntryIds } } });
      await prisma.catalogEntry.deleteMany({ where: { id: { in: testEntryIds } } });
    }

    await prisma.series.deleteMany({ where: { id: { in: testSeriesIds } } });
  }

  // Also clean orphan catalog entries created directly by tests (with _test_ title prefix)
  const orphanTestEntries = await prisma.catalogEntry.findMany({
    where: { title: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const orphanIds = orphanTestEntries.map((e) => e.id);
  if (orphanIds.length > 0) {
    // Find collection items linked to these catalog entries
    const orphanCollItems = await prisma.collectionItem.findMany({
      where: { catalogEntryId: { in: orphanIds } },
      select: { id: true },
    });
    const orphanCollItemIds = orphanCollItems.map((c) => c.id);

    // Delete cart items and order items that reference these collection items
    if (orphanCollItemIds.length > 0) {
      await prisma.cartItem.deleteMany({ where: { collectionItemId: { in: orphanCollItemIds } } });
      await prisma.orderItem.deleteMany({ where: { collectionItemId: { in: orphanCollItemIds } } });
    }

    // Delete all dependent records before deleting catalog entries
    await prisma.favorite.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.comment.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.review.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.collectionItem.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: { in: orphanIds } } });
    await prisma.catalogEntry.deleteMany({ where: { id: { in: orphanIds } } });
  }

  // Clean test taxonomy by prefix
  await prisma.category.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.tag.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.character.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });

  // Clean password resets and refresh tokens for test users only
  const testEmails = TEST_USERS.map((u) => u.email);
  const testUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true },
  });
  const testUserIds = testUsers.map((u) => u.id);

  if (testUserIds.length > 0) {
    await prisma.passwordReset.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } });
  }

  // Clean up signup-test users
  await prisma.refreshToken.deleteMany({
    where: { user: { email: { contains: '@test-signup' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: '@test-signup' } },
  });
}

export async function setup() {
  const prisma = new PrismaClient();

  try {
    // Clean up ONLY test data — seed/production data is preserved
    await cleanupTestData(prisma);

    // Seed test users — upsert so we don't conflict with seed admin
    for (const u of TEST_USERS) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          passwordHash: hashSync(u.password, 12),
          name: u.name,
          role: u.role,
        },
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

    // Seed test categories (prefixed — won't collide with seed data)
    for (const cat of TEST_CATEGORIES) {
      const slug = slugify(cat.name, { lower: true, strict: true });
      await prisma.category.upsert({
        where: { slug },
        update: { name: cat.name, description: cat.description },
        create: { name: cat.name, slug, description: cat.description },
      });
    }

    // Seed test tags (prefixed)
    for (const tag of TEST_TAGS) {
      const slug = slugify(tag.name, { lower: true, strict: true });
      await prisma.tag.upsert({
        where: { slug },
        update: { name: tag.name },
        create: { name: tag.name, slug },
      });
    }

    // Seed test characters (prefixed)
    for (const char of TEST_CHARACTERS) {
      const slug = slugify(char.name, { lower: true, strict: true });
      await prisma.character.upsert({
        where: { slug },
        update: { name: char.name, description: char.description },
        create: { name: char.name, slug, description: char.description },
      });
    }

    // Seed test series (prefixed)
    for (const s of TEST_SERIES) {
      const existing = await prisma.series.findFirst({ where: { title: s.title } });
      if (!existing) {
        await prisma.series.create({
          data: {
            title: s.title,
            description: s.description,
            totalEditions: s.totalEditions,
          },
        });
      }
    }

    console.log('Test database seeded (test-only data with _test_ prefix, seed data preserved)');
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
    // Clean up ONLY test data — seed/production data is preserved
    await cleanupTestData(prisma);

    console.log('Test database cleaned up (seed data preserved)');
  } catch (error) {
    console.error('Failed to clean up test database:', error);
  } finally {
    await prisma.$disconnect();
  }
}
