import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';

const prisma = new PrismaClient();
const createdIds: string[] = [];

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.catalogTag.deleteMany({ where: { tagId: id } });
    await prisma.tag.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Tags API', () => {
  // === PUBLIC ===

  describe('GET /api/v1/tags', () => {
    it('returns all tags', async () => {
      const res = await request.get('/api/v1/tags').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Seeded tags should exist
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('each tag has id, name, slug', async () => {
      const res = await request.get('/api/v1/tags').expect(200);

      if (res.body.data.length > 0) {
        for (const tag of res.body.data) {
          expect(tag).toHaveProperty('id');
          expect(tag).toHaveProperty('name');
          expect(tag).toHaveProperty('slug');
        }
      }
    });
  });

  describe('GET /api/v1/tags/:id', () => {
    it('returns a single tag', async () => {
      const listRes = await request.get('/api/v1/tags').expect(200);
      if (listRes.body.data.length === 0) return; // skip if no tags

      const first = listRes.body.data[0];
      const res = await request.get(`/api/v1/tags/${first.id}`).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(first.id);
    });

    it('returns 404 for non-existent id', async () => {
      await request.get('/api/v1/tags/nonexistent-xyz').expect(404);
    });
  });

  // === ADMIN CRUD ===

  describe('POST /api/v1/tags (admin)', () => {
    it('admin can create a tag', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const res = await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Test Tag ${Date.now()}` })
        .expect(201);

      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('slug');
      createdIds.push(res.body.data.id);
    });

    it('non-admin cannot create a tag', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Should Fail Tag' })
        .expect(403);
    });

    it('duplicate name returns error status', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const dupName = `Dup Tag ${Date.now()}`;
      // Create first
      const first = await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: dupName })
        .expect(201);
      createdIds.push(first.body.data.id);

      // Create duplicate — should not return 201
      const res = await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: dupName });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PUT /api/v1/tags/:id (admin)', () => {
    it('admin can update a tag', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Tag Upd ${Date.now()}` })
        .expect(201);
      createdIds.push(createRes.body.data.id);

      const res = await request
        .put(`/api/v1/tags/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Tag Updated' })
        .expect(200);

      expect(res.body.data.name).toBe('Tag Updated');
    });
  });

  describe('DELETE /api/v1/tags/:id (admin)', () => {
    it('admin can delete a tag without entries', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Tag Del ${Date.now()}` })
        .expect(201);

      await request
        .delete(`/api/v1/tags/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
