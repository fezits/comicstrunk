import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

const prisma = new PrismaClient();

let adminToken: string;
const TEST_KEYS = {
  a: '_test_dedup_gcd:dismiss_test_001',
  b: '_test_dedup_rika:dismiss_test_001',
};

beforeAll(async () => {
  const a = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = a.accessToken;
});

afterAll(async () => {
  await prisma.dismissedDuplicate.deleteMany({
    where: {
      OR: [
        { sourceKeyA: { startsWith: '_test_dedup_' } },
        { sourceKeyB: { startsWith: '_test_dedup_' } },
      ],
    },
  });
  await prisma.removedSourceKey.deleteMany({
    where: { sourceKey: { startsWith: '_test_dedup_' } },
  });
  await prisma.$disconnect();
});

describe('POST /api/v1/admin/duplicates/dismiss', () => {
  it('persiste o par ordenado lexicograficamente', async () => {
    const res = await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.b, sourceKeyB: TEST_KEYS.a }) // ordem invertida intencionalmente
      .expect(200);

    expect(res.body.success).toBe(true);

    const [keyA, keyB] = [TEST_KEYS.a, TEST_KEYS.b].sort();
    const stored = await prisma.dismissedDuplicate.findUnique({
      where: { sourceKeyA_sourceKeyB: { sourceKeyA: keyA, sourceKeyB: keyB } },
    });
    expect(stored).not.toBeNull();
  });

  it('é idempotente — segundo dismiss do mesmo par não falha', async () => {
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.a, sourceKeyB: TEST_KEYS.b })
      .expect(200);

    // Segundo POST: deve retornar 200 e não duplicar registro
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.a, sourceKeyB: TEST_KEYS.b })
      .expect(200);

    const count = await prisma.dismissedDuplicate.count({
      where: {
        sourceKeyA: { in: [TEST_KEYS.a, TEST_KEYS.b] },
        sourceKeyB: { in: [TEST_KEYS.a, TEST_KEYS.b] },
      },
    });
    expect(count).toBe(1);
  });

  it('rejeita body sem sourceKeys', async () => {
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gcdId: 'something', rikaId: 'else' }) // contrato antigo
      .expect(400);
  });
});
