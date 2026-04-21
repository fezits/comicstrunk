import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let testSeriesId: string;
let testCategoryId: string;
let testTagId: string;
let testCharacterId: string;

// Track created entries for cleanup
const createdEntryIds: string[] = [];
const createdTaxonomyIds: { series: string[]; categories: string[]; tags: string[]; characters: string[] } = {
  series: [],
  categories: [],
  tags: [],
  characters: [],
};

beforeAll(async () => {
  // Login as admin and user
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // Get existing taxonomy data, create if missing
  const [seriesRes, catRes, tagRes, charRes] = await Promise.all([
    request.get('/api/v1/series'),
    request.get('/api/v1/categories'),
    request.get('/api/v1/tags'),
    request.get('/api/v1/characters?limit=100'),
  ]);

  // Ensure series exists
  if (seriesRes.body.data?.length > 0) {
    testSeriesId = seriesRes.body.data[0].id;
  } else {
    const res = await request
      .post('/api/v1/series')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `${TEST_PREFIX}Catalog Test Series`, totalEditions: 10 });
    testSeriesId = res.body.data.id;
    createdTaxonomyIds.series.push(testSeriesId);
  }

  // Ensure category exists
  if (catRes.body.data?.length > 0) {
    testCategoryId = catRes.body.data[0].id;
  } else {
    const res = await request
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}Catalog Test Category` });
    testCategoryId = res.body.data.id;
    createdTaxonomyIds.categories.push(testCategoryId);
  }

  // Ensure tag exists
  if (tagRes.body.data?.length > 0) {
    testTagId = tagRes.body.data[0].id;
  } else {
    const res = await request
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}Catalog Test Tag` });
    testTagId = res.body.data.id;
    createdTaxonomyIds.tags.push(testTagId);
  }

  // Ensure character exists
  if (charRes.body.data?.length > 0) {
    testCharacterId = charRes.body.data[0].id;
  } else {
    const res = await request
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}Catalog Test Character` });
    testCharacterId = res.body.data.id;
    createdTaxonomyIds.characters.push(testCharacterId);
  }
});

afterAll(async () => {
  // Clean up catalog entries
  for (const id of createdEntryIds) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogEntry.deleteMany({ where: { id } });
  }
  // Clean up taxonomy created by this test
  for (const id of createdTaxonomyIds.series) {
    await prisma.series.deleteMany({ where: { id } });
  }
  for (const id of createdTaxonomyIds.categories) {
    await prisma.category.deleteMany({ where: { id } });
  }
  for (const id of createdTaxonomyIds.tags) {
    await prisma.tag.deleteMany({ where: { id } });
  }
  for (const id of createdTaxonomyIds.characters) {
    await prisma.character.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('Catalog CRUD API', () => {
  // === CREATE ===

  describe('POST /api/v1/catalog', () => {
    it('admin can create a catalog entry with all fields', async () => {
      const res = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `${TEST_PREFIX}Dragon Ball Vol. 1 ${Date.now()}`,
          author: 'Akira Toriyama',
          publisher: 'Panini',
          imprint: 'Manga',
          barcode: '7891234567890',
          isbn: '978-85-7657-001-0',
          description: 'Primeira edicao do classico manga',
          seriesId: testSeriesId,
          volumeNumber: 1,
          editionNumber: 1,
          categoryIds: [testCategoryId],
          tagIds: [testTagId],
          characterIds: [testCharacterId],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain(`${TEST_PREFIX}Dragon Ball Vol. 1`);
      expect(res.body.data.author).toBe('Akira Toriyama');
      expect(res.body.data.publisher).toBe('Panini');
      expect(res.body.data.approvalStatus).toBe('DRAFT');
      expect(res.body.data.volumeNumber).toBe(1);
      createdEntryIds.push(res.body.data.id);
    });

    it('admin can create a minimal entry (title only)', async () => {
      const res = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}Minimal ${Date.now()}` })
        .expect(201);

      expect(res.body.data.title).toContain(`${TEST_PREFIX}Minimal`);
      expect(res.body.data.approvalStatus).toBe('DRAFT');
      createdEntryIds.push(res.body.data.id);
    });

    it('non-admin cannot create a catalog entry', async () => {
      await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: `${TEST_PREFIX}Should Fail` })
        .expect(403);
    });

    it('unauthenticated cannot create', async () => {
      await request
        .post('/api/v1/catalog')
        .send({ title: `${TEST_PREFIX}No Auth` })
        .expect(401);
    });

    it('missing title returns validation error', async () => {
      const res = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ author: 'No Title' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // === ADMIN LIST ===

  describe('GET /api/v1/catalog/admin/list', () => {
    it('admin can list all entries (including drafts)', async () => {
      const res = await request
        .get('/api/v1/catalog/admin/list')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('admin can filter by approval status', async () => {
      const res = await request
        .get('/api/v1/catalog/admin/list?approvalStatus=DRAFT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      for (const entry of res.body.data) {
        expect(entry.approvalStatus).toBe('DRAFT');
      }
    });

    it('non-admin cannot access admin list', async () => {
      await request
        .get('/api/v1/catalog/admin/list')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('supports pagination', async () => {
      const res = await request
        .get('/api/v1/catalog/admin/list?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
    });
  });

  // === UPDATE ===

  describe('PUT /api/v1/catalog/:id', () => {
    it('admin can update a catalog entry', async () => {
      const res = await request
        .put(`/api/v1/catalog/${createdEntryIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}Updated Entry ${Date.now()}`, author: 'Toriyama' })
        .expect(200);

      expect(res.body.data.title).toContain(`${TEST_PREFIX}Updated Entry`);
      expect(res.body.data.author).toBe('Toriyama');
    });

    it('non-admin cannot update', async () => {
      await request
        .put(`/api/v1/catalog/${createdEntryIds[0]}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: `${TEST_PREFIX}Should Fail` })
        .expect(403);
    });

    it('returns 404 for non-existent entry', async () => {
      await request
        .put('/api/v1/catalog/nonexistent-id-xyz')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}No Entry` })
        .expect(404);
    });
  });

  // === APPROVAL WORKFLOW ===

  describe('Approval workflow (submit → approve)', () => {
    let workflowEntryId: string;

    it('create a draft entry for workflow testing', async () => {
      const res = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}Workflow ${Date.now()}`, author: 'Test Author' })
        .expect(201);

      workflowEntryId = res.body.data.id;
      createdEntryIds.push(workflowEntryId);
      expect(res.body.data.approvalStatus).toBe('DRAFT');
    });

    it('submit for review (DRAFT → PENDING)', async () => {
      const res = await request
        .patch(`/api/v1/catalog/${workflowEntryId}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('PENDING');
    });

    it('approve entry (PENDING → APPROVED)', async () => {
      const res = await request
        .patch(`/api/v1/catalog/${workflowEntryId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('APPROVED');
    });

    it('approved entry appears in public catalog', async () => {
      const res = await request.get('/api/v1/catalog').expect(200);

      const found = res.body.data.find(
        (e: { id: string }) => e.id === workflowEntryId,
      );
      expect(found).toBeDefined();
      expect(found.title).toContain(`${TEST_PREFIX}Workflow`);
    });
  });

  describe('Approval workflow (submit → reject)', () => {
    let rejectEntryId: string;

    it('create and submit entry', async () => {
      const createRes = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}Reject ${Date.now()}` })
        .expect(201);

      rejectEntryId = createRes.body.data.id;
      createdEntryIds.push(rejectEntryId);

      await request
        .patch(`/api/v1/catalog/${rejectEntryId}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('reject entry with reason (PENDING → REJECTED)', async () => {
      const res = await request
        .patch(`/api/v1/catalog/${rejectEntryId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Informacoes incompletas' })
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('Informacoes incompletas');
    });

    it('rejected entry does NOT appear in public catalog', async () => {
      const res = await request.get('/api/v1/catalog').expect(200);

      const found = res.body.data.find(
        (e: { id: string }) => e.id === rejectEntryId,
      );
      expect(found).toBeUndefined();
    });
  });

  // === PUBLIC BROWSE ===

  describe('GET /api/v1/catalog (public browse)', () => {
    it('returns only APPROVED entries', async () => {
      const res = await request.get('/api/v1/catalog').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');

      for (const entry of res.body.data) {
        expect(entry.approvalStatus).toBe('APPROVED');
      }
    });

    it('supports search by title', async () => {
      const res = await request.get(`/api/v1/catalog?search=${TEST_PREFIX}Workflow`).expect(200);

      if (res.body.data.length > 0) {
        expect(res.body.data[0].title).toContain(`${TEST_PREFIX}Workflow`);
      }
    });

    it('supports pagination', async () => {
      const res = await request.get('/api/v1/catalog?page=1&limit=1').expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/v1/catalog/:id (public detail)', () => {
    it('returns approved entry detail', async () => {
      const listRes = await request.get('/api/v1/catalog').expect(200);

      if (listRes.body.data.length > 0) {
        const entryId = listRes.body.data[0].id;
        const res = await request.get(`/api/v1/catalog/${entryId}`).expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(entryId);
        expect(res.body.data).toHaveProperty('title');
        expect(res.body.data.approvalStatus).toBe('APPROVED');
      }
    });

    it('returns 404 for non-existent entry', async () => {
      await request.get('/api/v1/catalog/nonexistent-xyz').expect(404);
    });
  });

  // === DELETE ===

  describe('DELETE /api/v1/catalog/:id', () => {
    it('admin can delete a catalog entry', async () => {
      const createRes = await request
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TEST_PREFIX}To Delete ${Date.now()}` })
        .expect(201);

      await request
        .delete(`/api/v1/catalog/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('non-admin cannot delete', async () => {
      await request
        .delete(`/api/v1/catalog/${createdEntryIds[0]}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
