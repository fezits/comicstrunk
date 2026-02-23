// Ensure NODE_ENV is set before anything else
process.env.NODE_ENV = 'test';

import { PrismaClient, PlanType, BillingInterval, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import slugify from 'slugify';

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
  { name: 'Manga', description: 'Quadrinhos japoneses' },
  { name: 'Superhero', description: 'Quadrinhos de super-herois' },
  { name: 'Indie', description: 'Quadrinhos independentes' },
];

const TEST_TAGS = [
  { name: 'Shonen' },
  { name: 'Action' },
  { name: 'Classic' },
];

const TEST_CHARACTERS = [
  { name: 'Goku', description: 'Protagonista de Dragon Ball' },
  { name: 'Batman', description: 'O Cavaleiro das Trevas' },
  { name: 'Luffy', description: 'Capitao dos Chapeu de Palha' },
];

const TEST_SERIES = [
  { title: 'Dragon Ball', description: 'Serie classica de Akira Toriyama', totalEditions: 42 },
  { title: 'One Piece', description: 'A maior aventura pirata', totalEditions: 105 },
  { title: 'Batman: O Cavaleiro das Trevas', description: 'Serie iconica da DC', totalEditions: 4 },
];

export async function setup() {
  const prisma = new PrismaClient();

  try {
    // Clean up test data in reverse dependency order
    await prisma.catalogCharacter.deleteMany({});
    await prisma.catalogTag.deleteMany({});
    await prisma.catalogCategory.deleteMany({});
    await prisma.catalogEntry.deleteMany({});
    await prisma.series.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.character.deleteMany({});
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

    // Seed test users — ALWAYS reset password hash so password-reset test doesn't break login
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

    // Seed categories
    for (const cat of TEST_CATEGORIES) {
      const slug = slugify(cat.name, { lower: true, strict: true });
      await prisma.category.upsert({
        where: { slug },
        update: { name: cat.name, description: cat.description },
        create: { name: cat.name, slug, description: cat.description },
      });
    }

    // Seed tags
    for (const tag of TEST_TAGS) {
      const slug = slugify(tag.name, { lower: true, strict: true });
      await prisma.tag.upsert({
        where: { slug },
        update: { name: tag.name },
        create: { name: tag.name, slug },
      });
    }

    // Seed characters
    for (const char of TEST_CHARACTERS) {
      const slug = slugify(char.name, { lower: true, strict: true });
      await prisma.character.upsert({
        where: { slug },
        update: { name: char.name, description: char.description },
        create: { name: char.name, slug, description: char.description },
      });
    }

    // Seed series (no unique constraint, so delete + create)
    for (const s of TEST_SERIES) {
      // Check if exists by title to avoid duplicates
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

    console.log('Test database seeded successfully (users + taxonomy + series)');
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
    // Clean up test-created data in reverse dependency order
    await prisma.catalogCharacter.deleteMany({});
    await prisma.catalogTag.deleteMany({});
    await prisma.catalogCategory.deleteMany({});
    await prisma.catalogEntry.deleteMany({});
    await prisma.series.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.character.deleteMany({});
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
