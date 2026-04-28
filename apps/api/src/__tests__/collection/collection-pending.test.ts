import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdIds: { collection: string[]; catalog: string[] } = {
  collection: [],
  catalog: [],
};

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;
  const u = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (!u) throw new Error('TEST_USER nao encontrado');
  userId = u.id;
});

afterAll(async () => {
  if (createdIds.collection.length > 0) {
    await prisma.collectionItem.deleteMany({ where: { id: { in: createdIds.collection } } });
  }
  if (createdIds.catalog.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds.catalog } } });
  }
  await prisma.$disconnect();
});

describe('addItem: PENDING e DRAFT permitidos na colecao', () => {
  it('aceita PENDING (relaxado na Fase 3)', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: `${TEST_PREFIX}Test PENDING Entry ${Date.now()}`,
        publisher: 'Test',
        approvalStatus: 'PENDING',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    if (res.body.data?.id) createdIds.collection.push(res.body.data.id);
  });

  it('rejeita REJECTED', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: `${TEST_PREFIX}Test REJECTED Entry ${Date.now()}`,
        publisher: 'Test',
        approvalStatus: 'REJECTED',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('aceita DRAFT (rascunho do user)', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: `${TEST_PREFIX}Test DRAFT Entry ${Date.now()}`,
        publisher: 'Test',
        approvalStatus: 'DRAFT',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    if (res.body.data?.id) createdIds.collection.push(res.body.data.id);
  });
});
