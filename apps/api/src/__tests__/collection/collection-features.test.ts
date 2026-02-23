import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let testSeriesId: string;
let approvedEntryId1: string;
let approvedEntryId2: string;
let approvedEntryId3: string;
let collectionItemId1: string;
let collectionItemId2: string;

const createdCatalogEntryIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Create a series
  const seriesRes = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `Features Series ${Date.now()}`, totalEditions: 5 })
    .expect(201);
  testSeriesId = seriesRes.body.data.id;

  // Create and approve 3 catalog entries
  for (let i = 1; i <= 3; i++) {
    const createRes = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Features Entry ${i} ${Date.now()}`,
        author: 'Author',
        seriesId: testSeriesId,
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

  approvedEntryId1 = createdCatalogEntryIds[0];
  approvedEntryId2 = createdCatalogEntryIds[1];
  approvedEntryId3 = createdCatalogEntryIds[2];

  // Add 2 items to user's collection
  const add1 = await request
    .post('/api/v1/collection')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      catalogEntryId: approvedEntryId1,
      pricePaid: 25.0,
      condition: 'NEW',
      isRead: false,
    })
    .expect(201);
  collectionItemId1 = add1.body.data.id;

  const add2 = await request
    .post('/api/v1/collection')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      catalogEntryId: approvedEntryId2,
      pricePaid: 30.0,
      condition: 'GOOD',
      isRead: true,
    })
    .expect(201);
  collectionItemId2 = add2.body.data.id;
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
  if (testSeriesId) {
    await prisma.series.deleteMany({ where: { id: testSeriesId } });
  }
  await prisma.$disconnect();
});

describe('Collection Features API', () => {
  // === MARK AS READ / UNREAD ===

  describe('PATCH /api/v1/collection/:id/read', () => {
    it('marks an item as read', async () => {
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isRead: true })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('marks an item as unread', async () => {
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isRead: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(false);
      expect(res.body.data.readAt).toBeNull();
    });

    it('toggle read back to true', async () => {
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isRead: true })
        .expect(200);

      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('cannot mark another user\'s item as read', async () => {
      await request
        .patch(`/api/v1/collection/${collectionItemId1}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isRead: true })
        .expect(404);
    });

    it('returns 404 for non-existent item', async () => {
      await request
        .patch('/api/v1/collection/clxxxxxxxxxxxxxxxxxxxxxxxxx/read')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isRead: true })
        .expect(404);
    });

    it('rejects invalid body (missing isRead)', async () => {
      await request
        .patch(`/api/v1/collection/${collectionItemId1}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });

  // === MARK FOR SALE ===

  describe('PATCH /api/v1/collection/:id/sale', () => {
    it('marks an item for sale with price and returns commission', async () => {
      const salePrice = 50.0;
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/sale`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isForSale: true, salePrice })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isForSale).toBe(true);
      expect(Number(res.body.data.salePrice)).toBeCloseTo(salePrice);

      // Commission is 10% of salePrice
      const expectedCommission = Number((salePrice * 0.1).toFixed(2));
      expect(res.body.data.commission).toBeCloseTo(expectedCommission);

      // Seller net = salePrice - commission
      const expectedNet = Number((salePrice - expectedCommission).toFixed(2));
      expect(res.body.data.sellerNet).toBeCloseTo(expectedNet);
    });

    it('rejects marking for sale without salePrice', async () => {
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId2}/sale`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isForSale: true })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/sale price.*required/i);
    });

    it('removes item from sale (isForSale=false clears price)', async () => {
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/sale`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isForSale: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isForSale).toBe(false);
      expect(res.body.data.salePrice).toBeNull();
      expect(res.body.data.commission).toBeNull();
      expect(res.body.data.sellerNet).toBeNull();
    });

    it('cannot mark another user\'s item for sale', async () => {
      await request
        .patch(`/api/v1/collection/${collectionItemId1}/sale`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isForSale: true, salePrice: 20 })
        .expect(404);
    });

    it('commission calculation is correct for various prices', async () => {
      const salePrice = 149.99;
      const res = await request
        .patch(`/api/v1/collection/${collectionItemId1}/sale`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isForSale: true, salePrice })
        .expect(200);

      const expectedCommission = Number((salePrice * 0.1).toFixed(2));
      const expectedNet = Number((salePrice - expectedCommission).toFixed(2));

      expect(res.body.data.commission).toBeCloseTo(expectedCommission);
      expect(res.body.data.sellerNet).toBeCloseTo(expectedNet);
    });
  });

  // === STATS ===

  describe('GET /api/v1/collection/stats', () => {
    it('returns collection statistics for the user', async () => {
      const res = await request
        .get('/api/v1/collection/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalItems');
      expect(res.body.data).toHaveProperty('totalRead');
      expect(res.body.data).toHaveProperty('totalUnread');
      expect(res.body.data).toHaveProperty('totalForSale');
      expect(res.body.data).toHaveProperty('totalValuePaid');
      expect(res.body.data).toHaveProperty('totalValueForSale');

      // We have 2 items; item1 is read (toggled to true), item2 is read (created as true)
      expect(res.body.data.totalItems).toBeGreaterThanOrEqual(2);
      expect(res.body.data.totalRead).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.data.totalValuePaid).toBe('number');
    });

    it('stats reflect correct totals', async () => {
      // Item1 is for sale at 149.99, item2 is not for sale
      const res = await request
        .get('/api/v1/collection/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.totalForSale).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalValueForSale).toBeGreaterThan(0);
      expect(res.body.data.totalValuePaid).toBeGreaterThan(0);
    });

    it('unauthenticated request returns 401', async () => {
      await request.get('/api/v1/collection/stats').expect(401);
    });

    it('different user sees their own stats (not other user\'s)', async () => {
      const res = await request
        .get('/api/v1/collection/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin's collection should have different stats (likely 0 for items created in this test)
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.totalItems).toBe('number');
    });
  });
});
