import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;
const BARCODE_PREFIX = `${TEST_PREFIX}JSON_`;

beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = accessToken;
});

afterAll(async () => {
  // Clean up test entries by barcode prefix
  const testEntries = await prisma.catalogEntry.findMany({
    where: { barcode: { startsWith: BARCODE_PREFIX } },
    select: { id: true },
  });
  const ids = testEntries.map((e) => e.id);
  if (ids.length > 0) {
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogEntry.deleteMany({ where: { id: { in: ids } } });
  }
  // Clean up auto-created test series/categories
  await prisma.series.deleteMany({
    where: { title: { startsWith: TEST_PREFIX } },
  });
  await prisma.category.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.$disconnect();
});

describe('JSON Import API', () => {
  it('imports valid JSON rows and creates entries', async () => {
    const rows = [
      {
        id: `${BARCODE_PREFIX}001`,
        name: `${TEST_PREFIX}Batman # 14 - Taticas de Terror`,
        publisher: 'Panini',
        universe: `${TEST_PREFIX}DC_Universe`,
        series: `${TEST_PREFIX}Batman_Series`,
        price: 31.9,
        pubDate: '6/2024',
        pages: '232',
        coverFile: 'test001.jpg',
      },
      {
        id: `${BARCODE_PREFIX}002`,
        name: `${TEST_PREFIX}One Piece # 100`,
        publisher: 'Panini',
        universe: `${TEST_PREFIX}Manga_Universe`,
        series: `${TEST_PREFIX}OnePiece_Series`,
        price: 29.9,
        pubDate: '3/2023',
        pages: '200',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.errors).toHaveLength(0);
    expect(res.body.data.seriesCreated).toContain(`${TEST_PREFIX}Batman_Series`);
    expect(res.body.data.seriesCreated).toContain(`${TEST_PREFIX}OnePiece_Series`);
    expect(res.body.data.categoriesCreated).toContain(`${TEST_PREFIX}DC_Universe`);
    expect(res.body.data.categoriesCreated).toContain(`${TEST_PREFIX}Manga_Universe`);
  });

  it('stores coverPrice, publishYear, publishMonth, pageCount correctly', async () => {
    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}001` },
    });

    expect(entry).not.toBeNull();
    expect(Number(entry!.coverPrice)).toBe(31.9);
    expect(entry!.publishYear).toBe(2024);
    expect(entry!.publishMonth).toBe(6);
    expect(entry!.pageCount).toBe(232);
    expect(entry!.coverFileName).toBe('test001.jpg');
  });

  it('extracts edition number from name', async () => {
    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}001` },
    });
    expect(entry?.editionNumber).toBe(14);

    const entry2 = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}002` },
    });
    expect(entry2?.editionNumber).toBe(100);
  });

  it('links category via junction table', async () => {
    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}001` },
      include: { categories: { include: { category: true } } },
    });

    expect(entry?.categories).toHaveLength(1);
    expect(entry?.categories[0].category.name).toBe(`${TEST_PREFIX}DC_Universe`);
  });

  it('links series correctly', async () => {
    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}001` },
      include: { series: true },
    });

    expect(entry?.series).not.toBeNull();
    expect(entry?.series?.title).toBe(`${TEST_PREFIX}Batman_Series`);
  });

  it('skips duplicates by barcode', async () => {
    const rows = [
      {
        id: `${BARCODE_PREFIX}001`, // Already exists from first test
        name: `${TEST_PREFIX}Duplicate Entry`,
        publisher: 'Panini',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.created).toBe(0);
  });

  it('reuses existing series (does not create duplicates)', async () => {
    const rows = [
      {
        id: `${BARCODE_PREFIX}003`,
        name: `${TEST_PREFIX}Batman # 15`,
        publisher: 'Panini',
        series: `${TEST_PREFIX}Batman_Series`, // Already created
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);
    expect(res.body.data.seriesCreated).not.toContain(`${TEST_PREFIX}Batman_Series`);
  });

  it('returns validation errors for invalid rows', async () => {
    const rows = [
      { id: '', name: '' }, // Invalid: empty required fields
      {
        id: `${BARCODE_PREFIX}004`,
        name: `${TEST_PREFIX}Valid Entry`,
        publisher: 'Panini',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.created).toBe(1);
  });

  it('defaults to APPROVED status', async () => {
    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}001` },
    });
    expect(entry?.approvalStatus).toBe('APPROVED');
  });

  it('respects DRAFT status option', async () => {
    const rows = [
      {
        id: `${BARCODE_PREFIX}005`,
        name: `${TEST_PREFIX}Draft Entry`,
        publisher: 'Panini',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows, options: { defaultApprovalStatus: 'DRAFT' } })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}005` },
    });
    expect(entry?.approvalStatus).toBe('DRAFT');
  });

  it('non-admin cannot use import endpoint', async () => {
    const { accessToken: userToken } = await loginAs(TEST_USER.email, TEST_USER.password);

    await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rows: [] })
      .expect(403);
  });

  it('rejects non-array body', async () => {
    await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: 'not-an-array' })
      .expect(400);
  });

  it('handles entries without optional fields', async () => {
    const rows = [
      {
        id: `${BARCODE_PREFIX}006`,
        name: `${TEST_PREFIX}Minimal Entry`,
        // No publisher, universe, series, price, pubDate, pages, coverFile
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${BARCODE_PREFIX}006` },
    });
    expect(entry?.publisher).toBeNull();
    expect(entry?.seriesId).toBeNull();
    expect(entry?.coverPrice).toBeNull();
    expect(entry?.publishYear).toBeNull();
    expect(entry?.pageCount).toBeNull();
  });
});
