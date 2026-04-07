import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let approvedEntryId: string;
let draftEntryId: string;
let testSeriesId: string;

// Seller review test data
let buyerUserId: string;
let sellerUserId: string;
let completedOrderId: string;

const createdReviewIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Get test user IDs
  const buyerUser = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  const sellerUser = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
  buyerUserId = buyerUser!.id;
  sellerUserId = sellerUser!.id;

  // Get or create a test series
  let series = await prisma.series.findFirst({ where: { title: { startsWith: TEST_PREFIX } } });
  if (!series) {
    series = await prisma.series.create({
      data: { title: `${TEST_PREFIX}Review Test Series`, totalEditions: 10 },
    });
  }
  testSeriesId = series.id;

  // Create APPROVED catalog entry
  const approved = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Review Test Entry`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: sellerUserId,
      approvalStatus: 'APPROVED',
    },
  });
  approvedEntryId = approved.id;

  // Create DRAFT catalog entry
  const draft = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Review Draft Entry`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: sellerUserId,
      approvalStatus: 'DRAFT',
    },
  });
  draftEntryId = draft.id;

  // Create a collection item for the order (seller owns it)
  const collectionItem = await prisma.collectionItem.create({
    data: {
      userId: sellerUserId,
      catalogEntryId: approvedEntryId,
      quantity: 1,
      condition: 'GOOD',
      isForSale: true,
      salePrice: 25.0,
    },
  });

  // Create a COMPLETED order (buyer = TEST_USER, seller = TEST_ADMIN)
  const order = await prisma.order.create({
    data: {
      orderNumber: `${TEST_PREFIX}ORD-${Date.now()}`,
      buyerId: buyerUserId,
      status: 'COMPLETED',
      shippingAddressSnapshot: JSON.stringify({ street: 'Test St', city: 'Test City' }),
      totalAmount: 25.0,
      orderItems: {
        create: {
          collectionItemId: collectionItem.id,
          sellerId: sellerUserId,
          priceSnapshot: 25.0,
          commissionRateSnapshot: 0.1,
          commissionAmountSnapshot: 2.5,
          sellerNetSnapshot: 22.5,
          status: 'COMPLETED',
        },
      },
    },
  });
  completedOrderId = order.id;
});

afterAll(async () => {
  // Clean up reviews
  for (const id of createdReviewIds) {
    await prisma.review.deleteMany({ where: { id } });
  }
  // Clean remaining reviews on our test entries
  await prisma.review.deleteMany({
    where: {
      OR: [
        { catalogEntryId: approvedEntryId },
        { orderId: completedOrderId },
      ],
    },
  });

  // Clean order items, orders, collection items
  if (completedOrderId) {
    await prisma.orderItem.deleteMany({ where: { orderId: completedOrderId } });
    await prisma.order.deleteMany({ where: { id: completedOrderId } });
  }
  await prisma.collectionItem.deleteMany({
    where: { userId: sellerUserId, catalogEntryId: approvedEntryId },
  });

  // Clean catalog entries
  await prisma.catalogEntry.deleteMany({
    where: { id: { in: [approvedEntryId, draftEntryId].filter(Boolean) } },
  });

  await prisma.$disconnect();
});

// ============================================================================
// Catalog Reviews
// ============================================================================

describe('Catalog Reviews', () => {
  describe('GET /api/v1/reviews/catalog/:catalogEntryId', () => {
    it('returns empty list for entry with no reviews', async () => {
      const res = await request
        .get(`/api/v1/reviews/catalog/${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('works without authentication (public)', async () => {
      const res = await request
        .get(`/api/v1/reviews/catalog/${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/reviews/catalog', () => {
    it('authenticated user creates review with rating and text', async () => {
      const res = await request
        .post('/api/v1/reviews/catalog')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId, rating: 4, text: 'Great comic!' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.text).toBe('Great comic!');
      expect(res.body.data.user).toHaveProperty('name');
      createdReviewIds.push(res.body.data.id);
    });

    it('creates review with rating only (text optional)', async () => {
      // Use admin to create a second review (user already has one)
      const res = await request
        .post('/api/v1/reviews/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ catalogEntryId: approvedEntryId, rating: 5 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.text).toBeNull();
      createdReviewIds.push(res.body.data.id);
    });

    it('recalculates averageRating on catalog entry', async () => {
      const entry = await prisma.catalogEntry.findUnique({
        where: { id: approvedEntryId },
      });

      // User gave 4, Admin gave 5 → average = 4.5
      expect(Number(entry!.averageRating)).toBe(4.5);
      expect(entry!.ratingCount).toBe(2);
    });

    it('returns 401 without auth', async () => {
      await request
        .post('/api/v1/reviews/catalog')
        .send({ catalogEntryId: approvedEntryId, rating: 3 })
        .expect(401);
    });

    it('returns 400 for non-APPROVED entry', async () => {
      const res = await request
        .post('/api/v1/reviews/catalog')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: draftEntryId, rating: 3 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 409 for duplicate review (same user + entry)', async () => {
      const res = await request
        .post('/api/v1/reviews/catalog')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ catalogEntryId: approvedEntryId, rating: 3 })
        .expect(409);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reviews/catalog/:id (with reviews)', () => {
    it('returns paginated reviews with user info', async () => {
      const res = await request
        .get(`/api/v1/reviews/catalog/${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty('rating');
      expect(res.body.data[0]).toHaveProperty('user');
      expect(res.body.data[0].user).toHaveProperty('name');
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe('GET /api/v1/reviews/catalog/:catalogEntryId/mine', () => {
    it("returns user's own review", async () => {
      const res = await request
        .get(`/api/v1/reviews/catalog/${approvedEntryId}/mine`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
    });

    it('returns null if user has no review', async () => {
      const res = await request
        .get(`/api/v1/reviews/catalog/${draftEntryId}/mine`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toBeNull();
    });

    it('returns 401 without auth', async () => {
      await request
        .get(`/api/v1/reviews/catalog/${approvedEntryId}/mine`)
        .expect(401);
    });
  });

  describe('PUT /api/v1/reviews/:id', () => {
    it('owner can update rating and text', async () => {
      const reviewId = createdReviewIds[0];
      const res = await request
        .put(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, text: 'Updated review!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.text).toBe('Updated review!');
    });

    it('recalculates averageRating after update', async () => {
      const entry = await prisma.catalogEntry.findUnique({
        where: { id: approvedEntryId },
      });

      // Both reviews now have rating 5 → average = 5
      expect(Number(entry!.averageRating)).toBe(5);
    });

    it('returns 403 for non-owner', async () => {
      const reviewId = createdReviewIds[0]; // user's review
      await request
        .put(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 1 })
        .expect(403);
    });

    it('returns 404 for non-existent review', async () => {
      await request
        .put('/api/v1/reviews/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 3 })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/reviews/:id', () => {
    it('returns 403 for non-owner', async () => {
      const reviewId = createdReviewIds[0]; // user's review
      await request
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('owner can delete review', async () => {
      const reviewId = createdReviewIds[0];
      const res = await request
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('recalculates averageRating after deletion', async () => {
      const entry = await prisma.catalogEntry.findUnique({
        where: { id: approvedEntryId },
      });

      // Only admin's review (5) remains
      expect(Number(entry!.averageRating)).toBe(5);
      expect(entry!.ratingCount).toBe(1);
    });
  });
});

// ============================================================================
// Seller Reviews
// ============================================================================

describe('Seller Reviews', () => {
  describe('POST /api/v1/reviews/seller', () => {
    it('buyer creates seller review on COMPLETED order', async () => {
      const res = await request
        .post('/api/v1/reviews/seller')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sellerId: sellerUserId,
          orderId: completedOrderId,
          rating: 5,
          text: 'Great seller!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.user).toHaveProperty('name');
      createdReviewIds.push(res.body.data.id);
    });

    it('returns 403 if not the buyer', async () => {
      // Admin is the seller, not the buyer
      const res = await request
        .post('/api/v1/reviews/seller')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sellerId: sellerUserId,
          orderId: completedOrderId,
          rating: 4,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('returns 409 for duplicate seller review', async () => {
      const res = await request
        .post('/api/v1/reviews/seller')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sellerId: sellerUserId,
          orderId: completedOrderId,
          rating: 4,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      await request
        .post('/api/v1/reviews/seller')
        .send({
          sellerId: sellerUserId,
          orderId: completedOrderId,
          rating: 4,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/reviews/seller/:sellerId', () => {
    it('returns reviews with averageRating and ratingCount', async () => {
      const res = await request
        .get(`/api/v1/reviews/seller/${sellerUserId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reviews');
      expect(res.body.data).toHaveProperty('averageRating');
      expect(res.body.data).toHaveProperty('ratingCount');
      expect(res.body.data.ratingCount).toBeGreaterThanOrEqual(1);
    });

    it('returns empty stats for seller with no reviews', async () => {
      const res = await request
        .get(`/api/v1/reviews/seller/${buyerUserId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.averageRating).toBe(0);
      expect(res.body.data.ratingCount).toBe(0);
    });
  });
});
