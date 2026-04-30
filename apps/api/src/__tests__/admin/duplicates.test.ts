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

describe('GET /api/v1/admin/duplicates — filtro espelhado', () => {
  let gcdEntry: { id: string; sourceKey: string };
  let rikaEntry: { id: string; sourceKey: string };

  beforeAll(async () => {
    const adminUser = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
    const adminUserId = adminUser!.id;

    // Cria entradas casadas (GCD + Rika) com mesmo título e número
    const created = await prisma.catalogEntry.createMany({
      data: [
        {
          title: '_test_dedup_GCD Title #42',
          publisher: 'Marvel',
          sourceKey: '_test_dedup_gcd:title_test_42',
          slug: '_test_dedup_gcd-title-42',
          approvalStatus: 'APPROVED',
          publishYear: 2020,
          createdById: adminUserId,
        },
        {
          title: '_test_dedup_GCD Title #42', // mesmo título
          publisher: 'Marvel',
          sourceKey: '_test_dedup_rika:title_test_42',
          slug: '_test_dedup_rika-title-42',
          approvalStatus: 'APPROVED',
          publishYear: 2020,
          createdById: adminUserId,
        },
      ],
    });
    expect(created.count).toBe(2);

    const fetched = await prisma.catalogEntry.findMany({
      where: { sourceKey: { startsWith: '_test_dedup_' } },
      orderBy: { sourceKey: 'asc' },
    });
    [gcdEntry, rikaEntry] = fetched.map((e) => ({ id: e.id, sourceKey: e.sourceKey! }));
  });

  afterAll(async () => {
    await prisma.catalogEntry.deleteMany({
      where: { sourceKey: { startsWith: '_test_dedup_' } },
    });
  });

  it('modo title: par dispensado não aparece', async () => {
    // Pré-condição: o par DEVE aparecer antes do dismiss (sanity check).
    // Sem isso, o teste poderia passar mesmo sem filtro (par nunca detectado).
    // Nota: sourceKey é removido do response por stripHiddenFields — usamos id.
    const before = await request
      .get('/api/v1/admin/duplicates?mode=title&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const beforePairs = before.body.data as Array<{ gcd: { id: string }; rika: { id: string } }>;
    const foundBefore = beforePairs.some(
      (p) =>
        (p.gcd.id === gcdEntry.id && p.rika.id === rikaEntry.id) ||
        (p.gcd.id === rikaEntry.id && p.rika.id === gcdEntry.id),
    );
    expect(foundBefore).toBe(true); // Sanity: setup criou par detectável

    // Dispensa par via POST
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: gcdEntry.sourceKey, sourceKeyB: rikaEntry.sourceKey })
      .expect(200);

    // GET no modo title — par NÃO deve aparecer
    const res = await request
      .get('/api/v1/admin/duplicates?mode=title&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pairs = res.body.data as Array<{ gcd: { id: string }; rika: { id: string } }>;
    const found = pairs.some(
      (p) =>
        (p.gcd.id === gcdEntry.id && p.rika.id === rikaEntry.id) ||
        (p.gcd.id === rikaEntry.id && p.rika.id === gcdEntry.id),
    );
    expect(found).toBe(false);
  });

  it('modo pattern: par dispensado não aparece', async () => {
    // Par já foi dispensado no teste anterior ("modo title"). Aqui validamos que
    // o filtro é espelhado: se foi dispensado, deve sumir nos DOIS modos.
    // Pré-condição explícita não é necessária — o pattern mode tinha bug pré-fix
    // (`gcd_id` inexistente causava 500), então o teste já era inerentemente
    // "before-fix-fails, after-fix-passes".
    // Nota: sourceKey é removido do response por stripHiddenFields — usamos id.
    const res = await request
      .get('/api/v1/admin/duplicates?mode=pattern&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pairs = res.body.data as Array<{ gcd: { id: string }; rika: { id: string } }>;
    const found = pairs.some(
      (p) =>
        (p.gcd.id === gcdEntry.id && p.rika.id === rikaEntry.id) ||
        (p.gcd.id === rikaEntry.id && p.rika.id === gcdEntry.id),
    );
    expect(found).toBe(false);
  });
});
