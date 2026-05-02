import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

vi.mock('../../shared/lib/metron', () => ({
  searchMetronIssues: vi.fn(),
  getMetronIssue: vi.fn(),
  getMetronRateStatus: vi.fn(() => ({ burst: 20, sustained: 5000 })),
}));
vi.mock('../../shared/lib/rika', () => ({
  searchRika: vi.fn(),
}));

import { getMetronIssue } from '../../shared/lib/metron';

const prisma = new PrismaClient();
const mockedGetMetron = vi.mocked(getMetronIssue);

let userToken: string;
let userId: string;
const createdIds: { catalog: string[]; collection: string[]; logs: string[] } = {
  catalog: [],
  collection: [],
  logs: [],
};

beforeAll(async () => {
  const u = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  userToken = u.accessToken;
  const user = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
  if (!user) throw new Error('TEST_ADMIN nao encontrado');
  userId = user.id;
});

beforeEach(() => {
  mockedGetMetron.mockReset();
});

afterAll(async () => {
  if (createdIds.collection.length > 0) {
    await prisma.collectionItem.deleteMany({ where: { id: { in: createdIds.collection } } });
  }
  if (createdIds.logs.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdIds.logs } } });
  }
  if (createdIds.catalog.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds.catalog } } });
  }
  await prisma.$disconnect();
});

describe('POST /api/v1/cover-scan/import', () => {
  it('cria CatalogEntry PENDING a partir de Metron e adiciona a colecao', async () => {
    mockedGetMetron.mockResolvedValue({
      id: 12345,
      series: { name: 'Test Series Import', volume: 1, year_began: 2024 },
      number: '7',
      issue: 'Test Series Import #7',
      cover_date: '2024-11-01',
      store_date: '2024-11-15',
      image: 'https://static.metron.cloud/test-import.jpg',
      description: 'Test description',
      isbn: '978-1234567890',
    });

    const log = await prisma.coverScanLog.create({
      data: {
        userId,
        rawText: '{}',
        ocrTokens: 'test',
        candidatesShown: [],
      },
    });
    createdIds.logs.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: log.id,
        externalSource: 'metron',
        externalRef: '12345',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { catalogEntryId, collectionItemId } = res.body.data;
    expect(catalogEntryId).toBeTruthy();
    expect(collectionItemId).toBeTruthy();
    createdIds.catalog.push(catalogEntryId);
    createdIds.collection.push(collectionItemId);

    const created = await prisma.catalogEntry.findUnique({ where: { id: catalogEntryId } });
    expect(created?.approvalStatus).toBe('PENDING');
    expect(created?.title).toContain('Test Series Import');
    expect(created?.editionNumber).toBe(7);
    expect(created?.createdById).toBe(userId);
    expect(created?.sourceKey).toBe('metron:12345');

    const collectionItem = await prisma.collectionItem.findUnique({
      where: { id: collectionItemId },
    });
    expect(collectionItem?.userId).toBe(userId);
  });

  it('returns 400 com input invalido', async () => {
    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: 'invalid',
        externalSource: 'metron',
        externalRef: '',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 sem auth', async () => {
    const res = await request.post('/api/v1/cover-scan/import').send({
      scanLogId: 'x',
      externalSource: 'metron',
      externalRef: '1',
    });
    expect(res.status).toBe(401);
  });

  it('reusa entry existente quando sourceKey ja foi importado (idempotente)', async () => {
    mockedGetMetron.mockResolvedValue({
      id: 99999,
      series: { name: 'Idempotent Test', volume: 1, year_began: 2024 },
      number: '1',
      issue: 'Idempotent Test #1',
      cover_date: null,
      store_date: null,
      image: 'https://example.com/x.jpg',
    });

    // pre-criar entry com sourceKey
    const existing = await prisma.catalogEntry.create({
      data: {
        title: 'Idempotent Test #1 (existente)',
        editionNumber: 1,
        sourceKey: 'metron:99999',
        approvalStatus: 'PENDING',
        createdById: userId,
      },
    });
    createdIds.catalog.push(existing.id);

    const log = await prisma.coverScanLog.create({
      data: {
        userId,
        rawText: '{}',
        ocrTokens: 'test',
        candidatesShown: [],
      },
    });
    createdIds.logs.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: log.id,
        externalSource: 'metron',
        externalRef: '99999',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.catalogEntryId).toBe(existing.id);
    if (res.body.data.collectionItemId) createdIds.collection.push(res.body.data.collectionItemId);
  });

  it('rejeita import quando sourceKey está em removed_source_keys', async () => {
    // Garantir que nao existe entrada no catalogo com esse sourceKey de uma
    // execucao anterior falha (pois o blacklist check so ocorre se nao existe
    // entry — existente e retornado sem checar blacklist, que e o comportamento
    // correto para entradas ja importadas antes da blacklist existir).
    const stale = await prisma.catalogEntry.findFirst({
      where: { sourceKey: 'metron:88888' },
      select: { id: true },
    });
    if (stale) {
      await prisma.collectionItem.deleteMany({ where: { catalogEntryId: stale.id } });
      await prisma.catalogEntry.delete({ where: { id: stale.id } });
    }

    // Mark sourceKey as blacklisted (admin removed it earlier via /admin/duplicates)
    await prisma.removedSourceKey.upsert({
      where: { sourceKey: 'metron:88888' },
      create: { sourceKey: 'metron:88888' },
      update: {},
    });

    mockedGetMetron.mockResolvedValue({
      id: 88888,
      series: { name: 'Blocked Test', volume: 1, year_began: 2024 },
      number: '1',
      issue: 'Blocked Test #1',
      cover_date: '2024-01-01',
      image: 'https://static.metron.cloud/blocked.jpg',
      description: 'Should be blocked',
    });

    const log = await prisma.coverScanLog.create({
      data: {
        userId,
        rawText: '{}',
        ocrTokens: 'blocked',
        candidatesShown: [],
      },
    });
    createdIds.logs.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: log.id,
        externalSource: 'metron',
        externalRef: '88888',
      })
      .expect(400);

    expect(res.body.error.message).toMatch(/removida do catálogo/i);

    // Cleanup
    await prisma.removedSourceKey.delete({ where: { sourceKey: 'metron:88888' } });
  });
});
