import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';

const prisma = new PrismaClient();
const createdIds: string[] = [];

// Ensure we have at least some series data for read tests
beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

  // Create series if none exist
  const existing = await request.get('/api/v1/series');
  if (existing.body.data.length < 3) {
    for (const s of [
      { title: 'Test Dragon Ball', totalEditions: 42 },
      { title: 'Test One Piece', totalEditions: 105 },
      { title: 'Test Batman', totalEditions: 4 },
    ]) {
      const res = await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...s, description: 'Test series' });
      if (res.status === 201) createdIds.push(res.body.data.id);
    }
  }
});

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.catalogEntry.deleteMany({ where: { seriesId: id } });
    await prisma.series.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Series API', () => {
  // === PUBLIC ===

  describe('GET /api/v1/series', () => {
    it('returns paginated series list', async () => {
      const res = await request.get('/api/v1/series').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('series have expected fields', async () => {
      const res = await request.get('/api/v1/series').expect(200);

      for (const s of res.body.data) {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('title');
        expect(s).toHaveProperty('totalEditions');
      }
    });

    it('supports search by title', async () => {
      const res = await request.get('/api/v1/series?title=Dragon').expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const s of res.body.data) {
        expect(s.title.toLowerCase()).toContain('dragon');
      }
    });

    it('supports pagination', async () => {
      const res = await request.get('/api/v1/series?page=1&limit=2').expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  describe('GET /api/v1/series/:id', () => {
    it('returns series detail with editions info', async () => {
      const listRes = await request.get('/api/v1/series').expect(200);
      const first = listRes.body.data[0];

      const res = await request.get(`/api/v1/series/${first.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(first.id);
      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data).toHaveProperty('totalEditions');
    });

    it('returns 404 for non-existent id', async () => {
      await request.get('/api/v1/series/nonexistent-xyz').expect(404);
    });
  });

  // === ADMIN CRUD ===

  describe('POST /api/v1/series (admin)', () => {
    it('admin can create a series', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const res = await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: `CRUD Series ${Date.now()}`, description: 'A test series', totalEditions: 10 })
        .expect(201);

      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data.totalEditions).toBe(10);
      createdIds.push(res.body.data.id);
    });

    it('non-admin cannot create a series', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Should Fail', totalEditions: 5 })
        .expect(403);
    });

    it('unauthenticated cannot create', async () => {
      await request
        .post('/api/v1/series')
        .send({ title: 'No Auth', totalEditions: 1 })
        .expect(401);
    });
  });

  describe('PUT /api/v1/series/:id (admin)', () => {
    it('admin can update a series', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: `Ser Upd ${Date.now()}`, totalEditions: 5 })
        .expect(201);
      createdIds.push(createRes.body.data.id);

      const res = await request
        .put(`/api/v1/series/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Series Updated', totalEditions: 20 })
        .expect(200);

      expect(res.body.data.title).toBe('Series Updated');
      expect(res.body.data.totalEditions).toBe(20);
    });
  });

  describe('DELETE /api/v1/series/:id (admin)', () => {
    it('admin can delete a series without entries', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: `Ser Del ${Date.now()}`, totalEditions: 1 })
        .expect(201);

      await request
        .delete(`/api/v1/series/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
