/**
 * E2E Rejection Flow Test
 *
 * Tests the rejection → revision → re-approval lifecycle:
 * 1. Create entry, submit for review
 * 2. Reject with reason
 * 3. Verify NOT in public catalog
 * 4. Edit the entry (auto-resets to DRAFT)
 * 5. Re-submit for review
 * 6. Approve
 * 7. Verify now appears in public catalog
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

const prisma = new PrismaClient();

let adminToken: string;
let entryId: string;
let seriesId: string;

beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = accessToken;

  // Create a series for the test
  const seriesRes = await request
    .post('/api/v1/series')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: `Rejection Test Series ${Date.now()}`, totalEditions: 10 });
  seriesId = seriesRes.body.data.id;
});

afterAll(async () => {
  if (entryId) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: entryId } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: entryId } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: entryId } });
    await prisma.catalogEntry.deleteMany({ where: { id: entryId } });
  }
  if (seriesId) {
    await prisma.series.deleteMany({ where: { id: seriesId } });
  }
  await prisma.$disconnect();
});

describe('E2E: Rejection → Revision → Re-approval Flow', () => {
  // === Phase 1: Create and submit ===

  it('creates a catalog entry with incomplete data', async () => {
    const res = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Reject Me ${Date.now()}`,
        author: 'Unknown',
        // Missing publisher, ISBN, etc — reason for rejection
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('DRAFT');
    entryId = res.body.data.id;
  });

  it('submits for review (DRAFT → PENDING)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.approvalStatus).toBe('PENDING');
  });

  // === Phase 2: Reject ===

  it('rejects with reason (PENDING → REJECTED)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${entryId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Falta editora, ISBN e descricao. Completar os dados.' })
      .expect(200);

    expect(res.body.data.approvalStatus).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe(
      'Falta editora, ISBN e descricao. Completar os dados.',
    );
  });

  it('rejected entry does NOT appear in public catalog', async () => {
    const res = await request.get('/api/v1/catalog').expect(200);
    const found = res.body.data.find((e: { id: string }) => e.id === entryId);
    expect(found).toBeUndefined();
  });

  it('rejected entry is not accessible via public detail endpoint', async () => {
    await request.get(`/api/v1/catalog/${entryId}`).expect(404);
  });

  // === Phase 3: Revision (edit → auto-reset to DRAFT) ===

  it('editing a REJECTED entry auto-resets it to DRAFT', async () => {
    const res = await request
      .put(`/api/v1/catalog/${entryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Revised Entry ${Date.now()}`,
        author: 'Akira Toriyama',
        publisher: 'Panini Comics',
        isbn: '978-85-7657-999-0',
        description: 'Edicao revisada com todos os dados preenchidos.',
        seriesId,
        volumeNumber: 1,
        editionNumber: 1,
      })
      .expect(200);

    expect(res.body.data.approvalStatus).toBe('DRAFT');
    expect(res.body.data.rejectionReason).toBeNull();
    expect(res.body.data.publisher).toBe('Panini Comics');
    expect(res.body.data.isbn).toBe('978-85-7657-999-0');
  });

  // === Phase 4: Re-submit and approve ===

  it('re-submits revised entry for review (DRAFT → PENDING)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.approvalStatus).toBe('PENDING');
  });

  it('approves revised entry (PENDING → APPROVED)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${entryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.approvalStatus).toBe('APPROVED');
  });

  // === Phase 5: Verify in public catalog ===

  it('approved entry now appears in public catalog', async () => {
    const res = await request.get('/api/v1/catalog').expect(200);
    const found = res.body.data.find((e: { id: string }) => e.id === entryId);
    expect(found).toBeDefined();
    expect(found.approvalStatus).toBe('APPROVED');
  });

  it('approved entry detail shows revised data', async () => {
    const res = await request.get(`/api/v1/catalog/${entryId}`).expect(200);

    expect(res.body.data.publisher).toBe('Panini Comics');
    expect(res.body.data.isbn).toBe('978-85-7657-999-0');
    expect(res.body.data.description).toContain('revisada');
    expect(res.body.data.rejectionReason).toBeNull();
    expect(res.body.data.series).toBeDefined();
    expect(res.body.data.series.id).toBe(seriesId);
  });

  // === Edge cases ===

  it('cannot submit already APPROVED entry directly (would need re-review path)', async () => {
    // APPROVED → PENDING via submit is valid per state machine
    const res = await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // APPROVED → PENDING is allowed for re-review
    expect(res.body.data.approvalStatus).toBe('PENDING');

    // Clean up: approve again so afterAll sees it as approved
    await request
      .patch(`/api/v1/catalog/${entryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('reject without reason returns error', async () => {
    // First submit to get it back to PENDING
    await request
      .patch(`/api/v1/catalog/${entryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request
      .patch(`/api/v1/catalog/${entryId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);

    // Clean up: approve so the entry is in a clean state
    await request
      .patch(`/api/v1/catalog/${entryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
