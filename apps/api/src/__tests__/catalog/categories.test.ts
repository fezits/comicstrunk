import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';

const prisma = new PrismaClient();
const createdIds: string[] = [];

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.catalogCategory.deleteMany({ where: { categoryId: id } });
    await prisma.category.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Categories API', () => {
  // === PUBLIC ===

  describe('GET /api/v1/categories', () => {
    it('returns all seeded categories', async () => {
      const res = await request.get('/api/v1/categories').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const names = res.body.data.map((c: { name: string }) => c.name);
      expect(names).toContain('Manga');
      expect(names).toContain('Superhero');
      expect(names).toContain('Indie');
    });

    it('each category has id, name, slug', async () => {
      const res = await request.get('/api/v1/categories').expect(200);

      for (const cat of res.body.data) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('slug');
      }
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('returns a single category by id', async () => {
      const listRes = await request.get('/api/v1/categories').expect(200);
      const firstCat = listRes.body.data[0];

      const res = await request.get(`/api/v1/categories/${firstCat.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(firstCat.id);
      expect(res.body.data.name).toBe(firstCat.name);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await request.get('/api/v1/categories/nonexistent-id-xyz').expect(404);
      expect(res.body.success).toBe(false);
    });
  });

  // === ADMIN CRUD ===

  describe('POST /api/v1/categories (admin)', () => {
    it('admin can create a category', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const res = await request
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Test Cat ${Date.now()}`, description: 'For testing' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('slug');
      createdIds.push(res.body.data.id);
    });

    it('non-admin cannot create a category', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      await request
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Should Fail' })
        .expect(403);
    });

    it('unauthenticated cannot create a category', async () => {
      await request
        .post('/api/v1/categories')
        .send({ name: 'No Auth' })
        .expect(401);
    });

    it('duplicate name returns error status', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const res = await request
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Manga' });

      // Prisma unique constraint → should not return 201
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PUT /api/v1/categories/:id (admin)', () => {
    it('admin can update a category', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Cat Upd ${Date.now()}` })
        .expect(201);
      createdIds.push(createRes.body.data.id);

      const updatedName = `Cat Upd2 ${Date.now()}`;
      const res = await request
        .put(`/api/v1/categories/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: updatedName, description: 'Updated desc' })
        .expect(200);

      expect(res.body.data.name).toBe(updatedName);
    });
  });

  describe('DELETE /api/v1/categories/:id (admin)', () => {
    it('admin can delete a category without entries', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Cat Del ${Date.now()}` })
        .expect(201);

      await request
        .delete(`/api/v1/categories/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
