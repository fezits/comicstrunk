import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();
const createdIds: string[] = [];

// Ensure we have at least some character data for read tests
beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

  const existing = await request.get('/api/v1/characters?limit=100');
  if (existing.body.data.length < 3) {
    for (const c of [
      { name: `${TEST_PREFIX}Seed Goku`, description: 'Test Goku' },
      { name: `${TEST_PREFIX}Seed Batman`, description: 'Test Batman' },
      { name: `${TEST_PREFIX}Seed Luffy`, description: 'Test Luffy' },
    ]) {
      const res = await request
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(c);
      if (res.status === 201) createdIds.push(res.body.data.id);
    }
  }
});

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.catalogCharacter.deleteMany({ where: { characterId: id } });
    await prisma.character.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Characters API', () => {
  // === PUBLIC ===

  describe('GET /api/v1/characters', () => {
    it('returns paginated characters', async () => {
      const res = await request.get('/api/v1/characters').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports pagination params', async () => {
      const res = await request.get('/api/v1/characters?page=1&limit=2').expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('characters have expected fields', async () => {
      const res = await request.get('/api/v1/characters?limit=100').expect(200);

      for (const c of res.body.data) {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('name');
        expect(c).toHaveProperty('slug');
      }
    });
  });

  describe('GET /api/v1/characters/:id', () => {
    it('returns a single character', async () => {
      const listRes = await request.get('/api/v1/characters').expect(200);
      const first = listRes.body.data[0];

      const res = await request.get(`/api/v1/characters/${first.id}`).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(first.id);
      expect(res.body.data).toHaveProperty('name');
    });

    it('returns 404 for non-existent id', async () => {
      await request.get('/api/v1/characters/nonexistent-xyz').expect(404);
    });
  });

  // === ADMIN CRUD ===

  describe('POST /api/v1/characters (admin)', () => {
    it('admin can create a character', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
      const uniqueName = `${TEST_PREFIX}CRUD Char ${Date.now()}`;

      const res = await request
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: uniqueName, description: 'A test character' })
        .expect(201);

      expect(res.body.data.name).toBe(uniqueName);
      expect(res.body.data).toHaveProperty('slug');
      createdIds.push(res.body.data.id);
    });

    it('non-admin cannot create a character', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      await request
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `${TEST_PREFIX}Should Fail` })
        .expect(403);
    });
  });

  describe('PUT /api/v1/characters/:id (admin)', () => {
    it('admin can update a character', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const uniqueName = `${TEST_PREFIX}Char Update ${Date.now()}`;
      const createRes = await request
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: uniqueName })
        .expect(201);
      createdIds.push(createRes.body.data.id);

      const res = await request
        .put(`/api/v1/characters/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `${uniqueName} Updated`, description: 'Now updated' })
        .expect(200);

      expect(res.body.data.name).toContain('Updated');
    });
  });

  describe('DELETE /api/v1/characters/:id (admin)', () => {
    it('admin can delete a character without entries', async () => {
      const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);

      const createRes = await request
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `${TEST_PREFIX}Char Del ${Date.now()}` })
        .expect(201);

      await request
        .delete(`/api/v1/characters/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
