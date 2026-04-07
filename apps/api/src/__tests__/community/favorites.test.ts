import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let userToken: string;
let approvedEntryId: string;
let draftEntryId: string;
let testSeriesId: string;
let testUserId: string;

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  testUserId = user!.id;

  // Get or create test series
  let series = await prisma.series.findFirst({ where: { title: { startsWith: TEST_PREFIX } } });
  if (!series) {
    series = await prisma.series.create({
      data: { title: `${TEST_PREFIX}Favorites Test Series`, totalEditions: 5 },
    });
  }
  testSeriesId = series.id;

  // Create APPROVED catalog entry
  const approved = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Favorites Test Entry`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: testUserId,
      approvalStatus: 'APPROVED',
    },
  });
  approvedEntryId = approved.id;

  // Create DRAFT catalog entry
  const draft = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Favorites Draft Entry`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: testUserId,
      approvalStatus: 'DRAFT',
    },
  });
  draftEntryId = draft.id;
});

afterAll(async () => {
  // Clean favorites
  await prisma.favorite.deleteMany({
    where: { catalogEntryId: { in: [approvedEntryId, draftEntryId].filter(Boolean) } },
  });

  // Clean catalog entries
  await prisma.catalogEntry.deleteMany({
    where: { id: { in: [approvedEntryId, draftEntryId].filter(Boolean) } },
  });

  await prisma.$disconnect();
});

// ============================================================================
// Favorites
// ============================================================================

describe('Favorites', () => {
  describe('POST /api/v1/favorites/toggle', () => {
    it('adds favorite (favorited: true)', async () => {
      const res = await request
        .post('/api/v1/favorites/toggle')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.favorited).toBe(true);
    });

    it('removes favorite on second toggle (favorited: false)', async () => {
      const res = await request
        .post('/api/v1/favorites/toggle')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.favorited).toBe(false);
    });

    it('returns 404 for non-APPROVED entry', async () => {
      await request
        .post('/api/v1/favorites/toggle')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: draftEntryId })
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      await request
        .post('/api/v1/favorites/toggle')
        .send({ catalogEntryId: approvedEntryId })
        .expect(401);
    });
  });

  describe('GET /api/v1/favorites/check/:catalogEntryId', () => {
    it('returns isFavorited: true when favorited', async () => {
      // First, add the favorite
      await request
        .post('/api/v1/favorites/toggle')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId });

      const res = await request
        .get(`/api/v1/favorites/check/${approvedEntryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorited).toBe(true);
    });

    it('returns isFavorited: false when not favorited', async () => {
      const res = await request
        .get(`/api/v1/favorites/check/${draftEntryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorited).toBe(false);
    });

    it('returns 401 without auth', async () => {
      await request
        .get(`/api/v1/favorites/check/${approvedEntryId}`)
        .expect(401);
    });
  });

  describe('GET /api/v1/favorites', () => {
    it('returns paginated favorites with catalog entry details', async () => {
      const res = await request
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const fav = res.body.data[0];
      expect(fav).toHaveProperty('catalogEntry');
      expect(fav.catalogEntry).toHaveProperty('title');
      expect(fav.catalogEntry).toHaveProperty('author');
    });

    it('returns 401 without auth', async () => {
      await request
        .get('/api/v1/favorites')
        .expect(401);
    });
  });
});
