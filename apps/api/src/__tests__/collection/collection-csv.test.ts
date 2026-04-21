import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let testSeriesId: string;
let approvedEntryTitle1: string;
let approvedEntryTitle2: string;

const createdCatalogEntryIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Create series
  const seriesRes = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `${TEST_PREFIX}CSV Series ${Date.now()}`, totalEditions: 10 })
    .expect(201);
  testSeriesId = seriesRes.body.data.id;

  // Create and approve 2 catalog entries with known titles for CSV import matching
  const ts = Date.now();
  approvedEntryTitle1 = `${TEST_PREFIX}CSV Import Comic Alpha ${ts}`;
  approvedEntryTitle2 = `${TEST_PREFIX}CSV Import Comic Beta ${ts}`;

  for (const title of [approvedEntryTitle1, approvedEntryTitle2]) {
    const createRes = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title,
        author: 'CSV Author',
        publisher: 'CSV Publisher',
        seriesId: testSeriesId,
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
});

afterAll(async () => {
  // Clean up collection items linked to our catalog entries
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

describe('Collection CSV API', () => {
  // === CSV TEMPLATE ===

  describe('GET /api/v1/collection/csv-template', () => {
    it('downloads a CSV template with correct headers', async () => {
      const res = await request
        .get('/api/v1/collection/csv-template')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/collection-import-template\.csv/);

      const csv = res.text;
      // Should contain the expected column headers
      expect(csv).toContain('catalogEntryTitle');
      expect(csv).toContain('quantity');
      expect(csv).toContain('condition');
      expect(csv).toContain('isRead');
      // Should contain example row
      expect(csv).toContain('Example Comic Title');
    });

    it('unauthenticated request returns 401', async () => {
      await request.get('/api/v1/collection/csv-template').expect(401);
    });
  });

  // === EXPORT EMPTY COLLECTION ===

  describe('GET /api/v1/collection/export (empty)', () => {
    it('exports CSV for a user with no collection items', async () => {
      // Admin likely has no collection items from this test
      const res = await request
        .get('/api/v1/collection/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      // Empty collection export should still be valid (might be empty string or just headers)
      expect(typeof res.text).toBe('string');
    });

    it('unauthenticated request returns 401', async () => {
      await request.get('/api/v1/collection/export').expect(401);
    });
  });

  // === CSV IMPORT ===

  describe('POST /api/v1/collection/import', () => {
    it('imports valid CSV and creates collection items', async () => {
      const csvContent = [
        'catalogEntryTitle,quantity,pricePaid,condition,notes,isRead',
        `${approvedEntryTitle1},1,29.90,NEW,Imported via CSV,false`,
        `${approvedEntryTitle2},2,15.50,GOOD,Second import,true`,
      ].join('\n');

      const tmpFile = path.join(__dirname, 'test-collection-import.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', tmpFile)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.imported).toBe(2);
        expect(res.body.data.skipped).toBe(0);
        expect(res.body.data.errors).toHaveLength(0);
        expect(res.body.data.total).toBe(2);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('skips duplicate rows on re-import', async () => {
      // Import the same entries again — should be skipped (already in collection)
      const csvContent = [
        'catalogEntryTitle,quantity,pricePaid,condition,notes,isRead',
        `${approvedEntryTitle1},1,29.90,NEW,Duplicate,false`,
      ].join('\n');

      const tmpFile = path.join(__dirname, 'test-collection-reimport.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', tmpFile)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.imported).toBe(0);
        expect(res.body.data.skipped).toBe(1);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('reports errors for rows with non-existent catalog entries', async () => {
      const csvContent = [
        'catalogEntryTitle,quantity,pricePaid,condition,notes,isRead',
        'Nonexistent Comic That Does Not Exist,1,10,NEW,,false',
      ].join('\n');

      const tmpFile = path.join(__dirname, 'test-collection-notfound.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', tmpFile)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.imported).toBe(0);
        expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.errors[0].message).toMatch(/not found/i);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('reports errors for rows with invalid data', async () => {
      const csvContent = [
        'catalogEntryTitle,quantity,pricePaid,condition,notes,isRead',
        ',1,10,NEW,,false', // missing catalogEntryTitle
      ].join('\n');

      const tmpFile = path.join(__dirname, 'test-collection-invalid.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', tmpFile)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.imported).toBe(0);
        expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rejects empty CSV file', async () => {
      const csvContent = 'catalogEntryTitle,quantity,pricePaid,condition,notes,isRead\n';

      const tmpFile = path.join(__dirname, 'test-collection-empty.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', tmpFile)
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toMatch(/empty/i);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rejects request without file attachment', async () => {
      const res = await request
        .post('/api/v1/collection/import')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('unauthenticated import returns 401', async () => {
      const csvContent = 'catalogEntryTitle\nSomething\n';
      const tmpFile = path.join(__dirname, 'test-collection-noauth.csv');
      fs.writeFileSync(tmpFile, csvContent);

      try {
        const res = await request
          .post('/api/v1/collection/import')
          .attach('file', tmpFile);

        // Server may return 401 or reset connection (Windows multipart + early auth rejection)
        expect(res.status).toBe(401);
      } catch (err: unknown) {
        // ECONNRESET is acceptable — server closed connection before reading the upload
        const message = err instanceof Error ? err.message : String(err);
        expect(message).toMatch(/ECONNRESET/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  // === EXPORT AFTER IMPORT (ROUND-TRIP) ===

  describe('GET /api/v1/collection/export (after import)', () => {
    it('exports collection with imported items as CSV', async () => {
      const res = await request
        .get('/api/v1/collection/export')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/collection-export/);

      const csv = res.text;
      // Should contain the headers
      expect(csv).toContain('catalogEntryTitle');
      expect(csv).toContain('condition');
      expect(csv).toContain('isRead');

      // Should contain data from our imported items
      expect(csv).toContain(approvedEntryTitle1);
      expect(csv).toContain(approvedEntryTitle2);
    });

    it('exported CSV has expected column structure', async () => {
      const res = await request
        .get('/api/v1/collection/export')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const lines = res.text.split('\n');
      const headers = lines[0];
      expect(headers).toContain('catalogEntryTitle');
      expect(headers).toContain('author');
      expect(headers).toContain('publisher');
      expect(headers).toContain('seriesTitle');
      expect(headers).toContain('quantity');
      expect(headers).toContain('pricePaid');
      expect(headers).toContain('condition');
      expect(headers).toContain('notes');
      expect(headers).toContain('isRead');
      expect(headers).toContain('isForSale');
      expect(headers).toContain('salePrice');
    });
  });
});
