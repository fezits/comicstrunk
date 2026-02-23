/**
 * E2E CSV Import Flow Test
 *
 * Tests the complete CSV import → approval → public visibility flow:
 * 1. Generate CSV with 5 valid entries and 2 invalid entries
 * 2. Import via API
 * 3. Verify created count vs error count
 * 4. Verify all created entries are in DRAFT status
 * 5. Approve all entries
 * 6. Verify they appear in public catalog
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

let adminToken: string;
const createdEntryIds: string[] = [];

// Unique suffix to avoid collisions with other test runs
const SUFFIX = Date.now();

beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = accessToken;
});

afterAll(async () => {
  // Clean up entries created by CSV import
  const csvEntries = await prisma.catalogEntry.findMany({
    where: {
      title: { contains: `CSV-E2E-${SUFFIX}` },
    },
    select: { id: true },
  });
  const ids = [...createdEntryIds, ...csvEntries.map((e) => e.id)];
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length > 0) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: { in: uniqueIds } } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: { in: uniqueIds } } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: { in: uniqueIds } } });
    await prisma.catalogEntry.deleteMany({ where: { id: { in: uniqueIds } } });
  }
  await prisma.$disconnect();
});

describe('E2E: CSV Import → Approval → Public Catalog', () => {
  // === Step 1: Import CSV with mixed valid/invalid rows ===

  it('imports CSV with 5 valid and 2 invalid rows', async () => {
    const csvContent = [
      'title,author,publisher,imprint,barcode,isbn,description',
      `CSV-E2E-${SUFFIX} Dragon Ball Vol 1,Akira Toriyama,Panini,Manga,7891111111111,978-1111111111,Primeiro volume`,
      `CSV-E2E-${SUFFIX} One Piece Vol 1,Eiichiro Oda,Panini,Manga,7891111111112,978-1111111112,Comeco da aventura`,
      `CSV-E2E-${SUFFIX} Naruto Vol 1,Masashi Kishimoto,Panini,Manga,7891111111113,978-1111111113,O ninja cabeça de vento`,
      `,Author Without Title,Publisher,,,, `, // Invalid: empty title
      `CSV-E2E-${SUFFIX} Batman Ano Um,Frank Miller,DC Comics,Vertigo,7891111111114,978-1111111114,Classico do Batman`,
      `,,,,,, `, // Invalid: empty title
      `CSV-E2E-${SUFFIX} Sandman Vol 1,Neil Gaiman,Vertigo,,7891111111115,978-1111111115,O Mestre dos Sonhos`,
    ].join('\n');

    const tmpFile = path.join(__dirname, `test-e2e-csv-${SUFFIX}.csv`);
    fs.writeFileSync(tmpFile, csvContent);

    try {
      const res = await request
        .post('/api/v1/catalog/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', tmpFile)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toBe(5);
      expect(res.body.data.errors.length).toBe(2);
      expect(res.body.data.total).toBe(7);

      // Verify errors reference the correct rows
      for (const err of res.body.data.errors) {
        expect(err).toHaveProperty('row');
        expect(err).toHaveProperty('message');
      }
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  // === Step 2: Verify all created entries are DRAFT ===

  it('all imported entries exist as DRAFT', async () => {
    const res = await request
      .get('/api/v1/catalog/admin/list?approvalStatus=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const importedEntries = res.body.data.filter((e: { title: string }) =>
      e.title.includes(`CSV-E2E-${SUFFIX}`),
    );

    expect(importedEntries.length).toBe(5);

    for (const entry of importedEntries) {
      expect(entry.approvalStatus).toBe('DRAFT');
      createdEntryIds.push(entry.id);
    }
  });

  it('imported entries do NOT appear in public catalog', async () => {
    const res = await request.get(`/api/v1/catalog?title=CSV-E2E-${SUFFIX}`).expect(200);
    expect(res.body.data.length).toBe(0);
  });

  // === Step 3: Submit and approve all entries ===

  it('submits all imported entries for review', async () => {
    for (const id of createdEntryIds) {
      const res = await request
        .patch(`/api/v1/catalog/${id}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('PENDING');
    }
  });

  it('approves all imported entries', async () => {
    for (const id of createdEntryIds) {
      const res = await request
        .patch(`/api/v1/catalog/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('APPROVED');
    }
  });

  // === Step 4: Verify in public catalog ===

  it('all 5 approved entries appear in public catalog', async () => {
    const res = await request.get(`/api/v1/catalog?title=CSV-E2E-${SUFFIX}`).expect(200);

    expect(res.body.data.length).toBe(5);

    const titles = res.body.data.map((e: { title: string }) => e.title);
    expect(titles).toContain(`CSV-E2E-${SUFFIX} Dragon Ball Vol 1`);
    expect(titles).toContain(`CSV-E2E-${SUFFIX} One Piece Vol 1`);
    expect(titles).toContain(`CSV-E2E-${SUFFIX} Naruto Vol 1`);
    expect(titles).toContain(`CSV-E2E-${SUFFIX} Batman Ano Um`);
    expect(titles).toContain(`CSV-E2E-${SUFFIX} Sandman Vol 1`);
  });

  it('each approved entry has correct fields from CSV', async () => {
    const res = await request
      .get(`/api/v1/catalog?title=CSV-E2E-${SUFFIX} Dragon Ball`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const entry = res.body.data[0];
    expect(entry.author).toBe('Akira Toriyama');
    expect(entry.publisher).toBe('Panini');
    expect(entry.approvalStatus).toBe('APPROVED');
  });

  // === Step 5: Export and verify CSV export ===

  it('exported CSV includes the approved entries', async () => {
    const res = await request
      .get('/api/v1/catalog/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
    const csvBody = res.text;
    expect(csvBody).toContain(`CSV-E2E-${SUFFIX} Dragon Ball Vol 1`);
    expect(csvBody).toContain('Akira Toriyama');
  });
});
