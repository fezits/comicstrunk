import request from 'supertest';
import { createApp } from '../../create-app';
import { prisma } from '../../shared/lib/prisma';
import { TEST_PREFIX } from '../global-setup';

describe('createOrder — multi-seller commission calculation', () => {
  const app = createApp();
  let buyerToken: string;
  let buyerId: string;
  let seller1Id: string;
  let seller2Id: string;
  let addressId: string;
  let collItem1Id: string;
  let collItem2Id: string;

  beforeAll(async () => {
    // Create buyer
    const buyerRes = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}buyer-n1@test.com`,
      name: `${TEST_PREFIX} Buyer N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    buyerToken = buyerRes.body.data.accessToken;
    buyerId = buyerRes.body.data.user.id;

    // Create seller1 (no subscription = FREE plan)
    const s1Res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}seller1-n1@test.com`,
      name: `${TEST_PREFIX} Seller1 N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    seller1Id = s1Res.body.data.user.id;

    // Create seller2 (no subscription = FREE plan)
    const s2Res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}seller2-n1@test.com`,
      name: `${TEST_PREFIX} Seller2 N1`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    seller2Id = s2Res.body.data.user.id;

    // Create a catalog entry for each seller's item
    const cat = await prisma.catalogEntry.create({
      data: {
        title: `${TEST_PREFIX} Comic N1`,
        approvalStatus: 'APPROVED',
        createdById: seller1Id,
      },
    });

    // Seller1 collection item for sale
    const ci1 = await prisma.collectionItem.create({
      data: { userId: seller1Id, catalogEntryId: cat.id, isForSale: true, salePrice: 25.0 },
    });
    collItem1Id = ci1.id;

    // Seller2 collection item for sale
    const ci2 = await prisma.collectionItem.create({
      data: { userId: seller2Id, catalogEntryId: cat.id, isForSale: true, salePrice: 30.0 },
    });
    collItem2Id = ci2.id;

    // Add both items to buyer cart
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000);
    await prisma.cartItem.createMany({
      data: [
        { userId: buyerId, collectionItemId: collItem1Id, reservedAt: now, expiresAt: expires },
        { userId: buyerId, collectionItemId: collItem2Id, reservedAt: now, expiresAt: expires },
      ],
    });

    // Create shipping address for buyer
    const addr = await prisma.shippingAddress.create({
      data: {
        userId: buyerId,
        label: 'Casa',
        street: 'Rua Teste',
        number: '1',
        neighborhood: 'Centro',
        city: 'SP',
        state: 'SP',
        zipCode: '01001-000',
      },
    });
    addressId = addr.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { collectionItemId: { in: [collItem1Id, collItem2Id] } } });
    await prisma.order.deleteMany({ where: { buyerId } });
    await prisma.cartItem.deleteMany({ where: { userId: buyerId } });
    await prisma.collectionItem.deleteMany({ where: { id: { in: [collItem1Id, collItem2Id] } } });
    await prisma.catalogEntry.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
    await prisma.shippingAddress.deleteMany({ where: { userId: buyerId } });
    await prisma.user.deleteMany({
      where: { email: { in: [
        `${TEST_PREFIX}buyer-n1@test.com`,
        `${TEST_PREFIX}seller1-n1@test.com`,
        `${TEST_PREFIX}seller2-n1@test.com`,
      ] } },
    });
  });

  /**
   * Verifies multi-seller orders are created with correct commission snapshots.
   * Both sellers have no subscription (FREE plan, 10% commission).
   * This is a behavioral correctness test — query count reduction is verified
   * by the absence of N+1 behavior in production (not assertable without DB instrumentation).
   */
  it('creates an order with items from two sellers and correct commission snapshots', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ shippingAddressId: addressId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderItems).toHaveLength(2);

    for (const item of res.body.data.orderItems) {
      expect(Number(item.commissionRateSnapshot)).toBe(0.1);
    }

    const totalAmount = Number(res.body.data.totalAmount);
    expect(totalAmount).toBe(55.0);
  });
});
