import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let seriesId1: string;
let seriesId2: string;

const createdCatalogEntryIds: string[] = [];
const createdSeriesIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Create 2 series with different total editions
  const series1Res = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `${TEST_PREFIX}Progress Series A ${Date.now()}`, totalEditions: 10 })
    .expect(201);
  seriesId1 = series1Res.body.data.id;
  createdSeriesIds.push(seriesId1);

  const series2Res = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `${TEST_PREFIX}Progress Series B ${Date.now()}`, totalEditions: 5 })
    .expect(201);
  seriesId2 = series2Res.body.data.id;
  createdSeriesIds.push(seriesId2);

  // Create catalog entries for series 1 (3 editions out of 10)
  for (let i = 1; i <= 3; i++) {
    const createRes = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${TEST_PREFIX}Progress A Ed ${i} ${Date.now()}`,
        seriesId: seriesId1,
        editionNumber: i,
      })
      .expect(201);

    const entryId = createRes.body.data.id;
    createdCatalogEntryIds.push(entryId);

    await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request
      .patch(`/api/v1/catalog/${entryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  }

  // Create catalog entries for series 2 (2 editions out of 5)
  for (let i = 1; i <= 2; i++) {
    const createRes = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${TEST_PREFIX}Progress B Ed ${i} ${Date.now()}`,
        seriesId: seriesId2,
        editionNumber: i,
      })
      .expect(201);

    const entryId = createRes.body.data.id;
    createdCatalogEntryIds.push(entryId);

    await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request
      .patch(`/api/v1/catalog/${entryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  }

  // Add all 5 catalog entries to user's collection
  for (const entryId of createdCatalogEntryIds) {
    await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entryId })
      .expect(201);
  }
});

afterAll(async () => {
  // Clean up collection items
  await prisma.collectionItem.deleteMany({
    where: { catalogEntryId: { in: createdCatalogEntryIds } },
  });
  // Clean up catalog entries
  for (const id of createdCatalogEntryIds) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
  }
  await prisma.catalogEntry.deleteMany({
    where: { id: { in: createdCatalogEntryIds } },
  });
  for (const id of createdSeriesIds) {
    await prisma.series.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Collection Series Progress API', () => {
  describe('GET /api/v1/collection/series-progress', () => {
    it('returns progress for all series in collection', async () => {
      const res = await request
        .get('/api/v1/collection/series-progress')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Should have at least our 2 series
      const series1Progress = res.body.data.find(
        (s: { seriesId: string }) => s.seriesId === seriesId1,
      );
      const series2Progress = res.body.data.find(
        (s: { seriesId: string }) => s.seriesId === seriesId2,
      );

      expect(series1Progress).toBeDefined();
      expect(series2Progress).toBeDefined();
    });

    it('series 1 shows 3 collected out of 10 (30%)', async () => {
      const res = await request
        .get('/api/v1/collection/series-progress')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const series1 = res.body.data.find(
        (s: { seriesId: string }) => s.seriesId === seriesId1,
      );

      expect(series1).toBeDefined();
      expect(series1.collected).toBe(3);
      expect(series1.totalEditions).toBe(10);
      expect(series1.percentage).toBe(30);
      expect(series1.seriesTitle).toContain(`${TEST_PREFIX}Progress Series A`);
    });

    it('series 2 shows 2 collected out of 5 (40%)', async () => {
      const res = await request
        .get('/api/v1/collection/series-progress')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const series2 = res.body.data.find(
        (s: { seriesId: string }) => s.seriesId === seriesId2,
      );

      expect(series2).toBeDefined();
      expect(series2.collected).toBe(2);
      expect(series2.totalEditions).toBe(5);
      expect(series2.percentage).toBe(40);
      expect(series2.seriesTitle).toContain(`${TEST_PREFIX}Progress Series B`);
    });

    it('filters by seriesId to show only one series', async () => {
      const res = await request
        .get(`/api/v1/collection/series-progress?seriesId=${seriesId1}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].seriesId).toBe(seriesId1);
      expect(res.body.data[0].collected).toBe(3);
      expect(res.body.data[0].totalEditions).toBe(10);
    });

    it('filter by seriesId for second series', async () => {
      const res = await request
        .get(`/api/v1/collection/series-progress?seriesId=${seriesId2}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].seriesId).toBe(seriesId2);
      expect(res.body.data[0].collected).toBe(2);
      expect(res.body.data[0].percentage).toBe(40);
    });

    it('returns empty array for a series not in collection', async () => {
      // Create a series with no items in the user's collection
      const emptySeriesRes = await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}Empty Series ${Date.now()}`, totalEditions: 20 })
        .expect(201);
      const emptySeriesId = emptySeriesRes.body.data.id;
      createdSeriesIds.push(emptySeriesId);

      const res = await request
        .get(`/api/v1/collection/series-progress?seriesId=${emptySeriesId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('different user sees their own progress (not other user\'s)', async () => {
      const res = await request
        .get('/api/v1/collection/series-progress')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Admin should NOT see user's series progress for our test series
      const series1 = res.body.data.find(
        (s: { seriesId: string }) => s.seriesId === seriesId1,
      );
      expect(series1).toBeUndefined();
    });

    it('unauthenticated request returns 401', async () => {
      await request.get('/api/v1/collection/series-progress').expect(401);
    });
  });
});
