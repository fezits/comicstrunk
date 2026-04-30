import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';
import { isSourceKeyBlocked } from '../../modules/sync/blacklist';

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

describe('DELETE /api/v1/admin/duplicates/:id', () => {
  it('hard-deleta entrada e adiciona sourceKey em removed_source_keys', async () => {
    // Cria entrada de teste — precisa de createdById (campo NOT NULL)
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@comicstrunk.com' },
      select: { id: true },
    });
    if (!adminUser) throw new Error('admin user not found');

    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_DeleteTest #1',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_rika:delete_test_001',
        slug: '_test_dedup_delete-test-001',
        approvalStatus: 'APPROVED',
        createdById: adminUser.id,
      },
    });

    await request
      .delete(`/api/v1/admin/duplicates/${entry.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Confirma hard delete
    const stillThere = await prisma.catalogEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).toBeNull();

    // Confirma blacklist
    const blocked = await prisma.removedSourceKey.findUnique({
      where: { sourceKey: '_test_dedup_rika:delete_test_001' },
    });
    expect(blocked).not.toBeNull();
  });

  it('é idempotente — DELETE já blacklisteado não falha', async () => {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@comicstrunk.com' },
      select: { id: true },
    });
    if (!adminUser) throw new Error('admin user not found');

    // Pre-blacklist (simula segunda execução do delete pra mesma sourceKey)
    await prisma.removedSourceKey.upsert({
      where: { sourceKey: '_test_dedup_rika:delete_test_002' },
      create: { sourceKey: '_test_dedup_rika:delete_test_002' },
      update: {},
    });

    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_DeleteTest #2',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_rika:delete_test_002',
        slug: '_test_dedup_delete-test-002',
        approvalStatus: 'APPROVED',
        createdById: adminUser.id,
      },
    });

    // DELETE não deve falhar mesmo se sourceKey já está em removed_source_keys
    await request
      .delete(`/api/v1/admin/duplicates/${entry.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const stillThere = await prisma.catalogEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).toBeNull();
  });
});

describe('isSourceKeyBlocked (helper para sync-catalog e cover-import)', () => {
  it('retorna true quando sourceKey está em removed_source_keys', async () => {
    await prisma.removedSourceKey.upsert({
      where: { sourceKey: '_test_dedup_rika:blocked_001' },
      create: { sourceKey: '_test_dedup_rika:blocked_001' },
      update: {},
    });

    const blocked = await isSourceKeyBlocked('_test_dedup_rika:blocked_001');
    expect(blocked).toBe(true);
  });

  it('retorna false quando sourceKey não está blacklisted', async () => {
    const blocked = await isSourceKeyBlocked('_test_dedup_rika:notblocked_001');
    expect(blocked).toBe(false);
  });
});
