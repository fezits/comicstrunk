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

// Track all created IDs for cleanup
const createdCollectionItemIds: string[] = [];
const createdCatalogEntryIds: string[] = [];

beforeAll(async () => {
  // Login as admin and user
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Create a series for our test catalog entries
  const seriesRes = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `Collection CRUD Series ${Date.now()}`, totalEditions: 10 })
    .expect(201);
  testSeriesId = seriesRes.body.data.id;

  // Create 3 catalog entries and approve them
  for (let i = 1; i <= 3; i++) {
    const createRes = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Collection CRUD Entry ${i} ${Date.now()}`,
        author: 'Test Author',
        publisher: 'Test Publisher',
        seriesId: testSeriesId,
        editionNumber: i,
      })
      .expect(201);

    const entryId = createRes.body.data.id;
    createdCatalogEntryIds.push(entryId);

    // Submit and approve
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
});

afterAll(async () => {
  // Clean up collection items first (depends on catalog entries)
  if (createdCollectionItemIds.length > 0) {
    await prisma.collectionItem.deleteMany({
      where: { id: { in: createdCollectionItemIds } },
    });
  }
  // Also clean up any collection items linked to our catalog entries
  await prisma.collectionItem.deleteMany({
    where: { catalogEntryId: { in: createdCatalogEntryIds } },
  });
  // Clean up catalog entries (remove junction table rows first)
  for (const id of createdCatalogEntryIds) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
  }
  await prisma.catalogEntry.deleteMany({
    where: { id: { in: createdCatalogEntryIds } },
  });
  // Clean up series
  if (testSeriesId) {
    await prisma.series.deleteMany({ where: { id: testSeriesId } });
  }
  await prisma.$disconnect();
});

describe('Collection CRUD API', () => {
  // === ADD ITEM ===

  describe('POST /api/v1/collection', () => {
    it('user can add an approved catalog entry to collection', async () => {
      const res = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: approvedEntryId1,
          quantity: 1,
          pricePaid: 29.9,
          condition: 'NEW',
          notes: 'First edition',
          isRead: false,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.catalogEntryId).toBe(approvedEntryId1);
      expect(res.body.data.quantity).toBe(1);
      expect(res.body.data.condition).toBe('NEW');
      expect(res.body.data.isRead).toBe(false);
      expect(res.body.data.notes).toBe('First edition');
      expect(res.body.data.catalogEntry).toHaveProperty('title');
      createdCollectionItemIds.push(res.body.data.id);
    });

    it('user can add item with minimal fields (just catalogEntryId)', async () => {
      const res = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId2 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.catalogEntryId).toBe(approvedEntryId2);
      expect(res.body.data.quantity).toBe(1);
      expect(res.body.data.condition).toBe('NEW');
      expect(res.body.data.isRead).toBe(false);
      createdCollectionItemIds.push(res.body.data.id);
    });

    it('rejects duplicate — same user + same catalog entry', async () => {
      const res = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId1 })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/already in your collection/i);
    });

    it('rejects non-existent catalog entry', async () => {
      const res = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('rejects unapproved catalog entry', async () => {
      // Create a DRAFT entry (not approved)
      const draftRes = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `Draft Entry ${Date.now()}` })
        .expect(201);

      const draftId = draftRes.body.data.id;
      createdCatalogEntryIds.push(draftId);

      const res = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: draftId })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not found or not approved/i);
    });

    it('unauthenticated request returns 401', async () => {
      await request
        .post('/api/v1/collection')
        .send({ catalogEntryId: approvedEntryId3 })
        .expect(401);
    });
  });

  // === GET ITEM ===

  describe('GET /api/v1/collection/:id', () => {
    it('user can get their own collection item', async () => {
      const itemId = createdCollectionItemIds[0];
      const res = await request
        .get(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(itemId);
      expect(res.body.data.catalogEntry).toHaveProperty('title');
      expect(res.body.data.catalogEntry).toHaveProperty('series');
    });

    it('returns 404 for non-existent item', async () => {
      await request
        .get('/api/v1/collection/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('cannot access another user\'s collection item (ownership check)', async () => {
      const itemId = createdCollectionItemIds[0]; // belongs to TEST_USER
      await request
        .get(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // === UPDATE ITEM ===

  describe('PUT /api/v1/collection/:id', () => {
    it('user can update their own collection item', async () => {
      const itemId = createdCollectionItemIds[0];
      const res = await request
        .put(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quantity: 2,
          pricePaid: 35.5,
          condition: 'VERY_GOOD',
          notes: 'Updated notes',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(2);
      expect(Number(res.body.data.pricePaid)).toBeCloseTo(35.5);
      expect(res.body.data.condition).toBe('VERY_GOOD');
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('can update a single field', async () => {
      const itemId = createdCollectionItemIds[0];
      const res = await request
        .put(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ condition: 'GOOD' })
        .expect(200);

      expect(res.body.data.condition).toBe('GOOD');
      // Other fields remain unchanged
      expect(res.body.data.quantity).toBe(2);
    });

    it('cannot update another user\'s item', async () => {
      const itemId = createdCollectionItemIds[0]; // belongs to TEST_USER
      await request
        .put(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Hijacked' })
        .expect(404);
    });

    it('returns 404 for non-existent item', async () => {
      await request
        .put('/api/v1/collection/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'No item' })
        .expect(404);
    });
  });

  // === LIST ITEMS ===

  describe('GET /api/v1/collection', () => {
    it('returns paginated list of user\'s collection items', async () => {
      const res = await request
        .get('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('supports pagination with page and limit', async () => {
      const res = await request
        .get('/api/v1/collection?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.page).toBe(1);
    });

    it('filters by condition', async () => {
      const res = await request
        .get('/api/v1/collection?condition=GOOD')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      for (const item of res.body.data) {
        expect(item.condition).toBe('GOOD');
      }
    });

    it('filters by isRead', async () => {
      const res = await request
        .get('/api/v1/collection?isRead=false')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      for (const item of res.body.data) {
        expect(item.isRead).toBe(false);
      }
    });

    it('filters by seriesId', async () => {
      const res = await request
        .get(`/api/v1/collection?seriesId=${testSeriesId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports sortBy and sortOrder', async () => {
      const res = await request
        .get('/api/v1/collection?sortBy=title&sortOrder=asc')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('only returns items belonging to the authenticated user', async () => {
      // Admin should see empty or different collection
      const res = await request
        .get('/api/v1/collection')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin's collection should NOT contain user's items
      const userItemIds = createdCollectionItemIds;
      for (const item of res.body.data) {
        expect(userItemIds).not.toContain(item.id);
      }
    });
  });

  // === DELETE ITEM ===

  describe('DELETE /api/v1/collection/:id', () => {
    it('cannot delete another user\'s item', async () => {
      const itemId = createdCollectionItemIds[0]; // belongs to TEST_USER
      await request
        .delete(`/api/v1/collection/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 404 for non-existent item', async () => {
      await request
        .delete('/api/v1/collection/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('user can delete their own collection item', async () => {
      // Add a new item specifically for deletion
      const addRes = await request
        .post('/api/v1/collection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId3 })
        .expect(201);

      const deleteItemId = addRes.body.data.id;

      const res = await request
        .delete(`/api/v1/collection/${deleteItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's gone
      await request
        .get(`/api/v1/collection/${deleteItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });
});
