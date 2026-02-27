/**
 * E2E Catalog Flow Test
 *
 * Tests the COMPLETE lifecycle of a catalog entry from scratch:
 * 1. Login as admin
 * 2. Create category, tag, character, series
 * 3. Create catalog entry with ALL fields linked
 * 4. Verify DRAFT status
 * 5. Submit for review → PENDING
 * 6. Approve → APPROVED
 * 7. Verify entry appears in public catalog
 * 8. Verify entry detail has all fields correctly
 * 9. Clean up everything in afterAll
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;

// IDs created during the test — cleaned up in afterAll
let categoryId: string;
let tagId: string;
let characterId: string;
let seriesId: string;
let catalogEntryId: string;

beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = accessToken;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  if (catalogEntryId) {
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId } });
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId } });
    await prisma.catalogEntry.deleteMany({ where: { id: catalogEntryId } });
  }
  if (seriesId) {
    await prisma.series.deleteMany({ where: { id: seriesId } });
  }
  if (categoryId) {
    await prisma.catalogCategory.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
  }
  if (tagId) {
    await prisma.catalogTag.deleteMany({ where: { tagId } });
    await prisma.tag.deleteMany({ where: { id: tagId } });
  }
  if (characterId) {
    await prisma.catalogCharacter.deleteMany({ where: { characterId } });
    await prisma.character.deleteMany({ where: { id: characterId } });
  }
  await prisma.$disconnect();
});

describe('E2E: Complete Catalog Entry Lifecycle', () => {
  // === Step 1: Create taxonomy ===

  it('creates a category "Manga"', async () => {
    const res = await request
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}E2E Manga ${Date.now()}`, description: 'Quadrinhos japoneses' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('slug');
    categoryId = res.body.data.id;
  });

  it('creates a tag "Shonen"', async () => {
    const res = await request
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}E2E Shonen ${Date.now()}` })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('slug');
    tagId = res.body.data.id;
  });

  it('creates a character "Goku"', async () => {
    const res = await request
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX}E2E Goku ${Date.now()}`, description: 'Protagonista de Dragon Ball' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('slug');
    characterId = res.body.data.id;
  });

  it('creates a series "Dragon Ball" with 42 editions', async () => {
    const res = await request
      .post('/api/v1/series')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${TEST_PREFIX}E2E Dragon Ball ${Date.now()}`,
        description: 'Serie classica de Akira Toriyama',
        totalEditions: 42,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.totalEditions).toBe(42);
    seriesId = res.body.data.id;
  });

  // === Step 2: Create catalog entry with ALL fields ===

  it('creates a catalog entry with all fields linked', async () => {
    const res = await request
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${TEST_PREFIX}E2E Dragon Ball Vol. 1 ${Date.now()}`,
        author: 'Akira Toriyama',
        publisher: 'Panini Comics',
        imprint: 'Panini Manga',
        barcode: '7891234567890',
        isbn: '978-85-7657-001-0',
        description: 'A primeira edicao do classico manga Dragon Ball. Goku encontra Bulma.',
        seriesId,
        volumeNumber: 1,
        editionNumber: 1,
        categoryIds: [categoryId],
        tagIds: [tagId],
        characterIds: [characterId],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const entry = res.body.data;
    catalogEntryId = entry.id;

    // Verify all scalar fields
    expect(entry.title).toContain(`${TEST_PREFIX}E2E Dragon Ball Vol. 1`);
    expect(entry.author).toBe('Akira Toriyama');
    expect(entry.publisher).toBe('Panini Comics');
    expect(entry.imprint).toBe('Panini Manga');
    expect(entry.barcode).toBe('7891234567890');
    expect(entry.isbn).toBe('978-85-7657-001-0');
    expect(entry.description).toContain('classico manga Dragon Ball');
    expect(entry.volumeNumber).toBe(1);
    expect(entry.editionNumber).toBe(1);

    // Verify relationships
    expect(entry.seriesId).toBe(seriesId);
    expect(entry.categories).toHaveLength(1);
    expect(entry.tags).toHaveLength(1);
    expect(entry.characters).toHaveLength(1);
  });

  // === Step 3: Verify initial DRAFT status ===

  it('entry starts in DRAFT status', async () => {
    const res = await request
      .get('/api/v1/catalog/admin/list?approvalStatus=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
    expect(found.approvalStatus).toBe('DRAFT');
  });

  it('DRAFT entry does NOT appear in public catalog', async () => {
    const res = await request.get('/api/v1/catalog').expect(200);
    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeUndefined();
  });

  // === Step 4: Submit for review (DRAFT → PENDING) ===

  it('submits entry for review (DRAFT → PENDING)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${catalogEntryId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('PENDING');
  });

  it('PENDING entry still does NOT appear in public catalog', async () => {
    const res = await request.get('/api/v1/catalog').expect(200);
    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeUndefined();
  });

  // === Step 5: Approve entry (PENDING → APPROVED) ===

  it('approves entry (PENDING → APPROVED)', async () => {
    const res = await request
      .patch(`/api/v1/catalog/${catalogEntryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('APPROVED');
  });

  // === Step 6: Verify entry appears in public catalog ===

  it('APPROVED entry appears in public catalog browse', async () => {
    const res = await request.get('/api/v1/catalog').expect(200);

    expect(res.body.success).toBe(true);
    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
    expect(found.approvalStatus).toBe('APPROVED');
    expect(found.title).toContain(`${TEST_PREFIX}E2E Dragon Ball Vol. 1`);
  });

  it('APPROVED entry can be found by title search', async () => {
    const res = await request.get(`/api/v1/catalog?title=${TEST_PREFIX}E2E Dragon Ball`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
  });

  // === Step 7: Verify entry detail with all fields ===

  it('public detail endpoint returns all fields correctly', async () => {
    const res = await request.get(`/api/v1/catalog/${catalogEntryId}`).expect(200);

    expect(res.body.success).toBe(true);
    const entry = res.body.data;

    // Scalar fields
    expect(entry.id).toBe(catalogEntryId);
    expect(entry.title).toContain(`${TEST_PREFIX}E2E Dragon Ball Vol. 1`);
    expect(entry.author).toBe('Akira Toriyama');
    expect(entry.publisher).toBe('Panini Comics');
    expect(entry.imprint).toBe('Panini Manga');
    expect(entry.barcode).toBe('7891234567890');
    expect(entry.isbn).toBe('978-85-7657-001-0');
    expect(entry.description).toContain('classico manga Dragon Ball');
    expect(entry.volumeNumber).toBe(1);
    expect(entry.editionNumber).toBe(1);
    expect(entry.approvalStatus).toBe('APPROVED');

    // Series relationship
    expect(entry.series).toBeDefined();
    expect(entry.series.id).toBe(seriesId);
    expect(entry.series.totalEditions).toBe(42);

    // Categories (junction table)
    expect(entry.categories).toHaveLength(1);
    expect(entry.categories[0].category.id).toBe(categoryId);

    // Tags (junction table)
    expect(entry.tags).toHaveLength(1);
    expect(entry.tags[0].tag.id).toBe(tagId);

    // Characters (junction table)
    expect(entry.characters).toHaveLength(1);
    expect(entry.characters[0].character.id).toBe(characterId);

    // Created by admin
    expect(entry.createdBy).toBeDefined();
    expect(entry.createdBy.email).toBe(TEST_ADMIN.email);
  });

  // === Step 8: Verify search filters work ===

  it('can filter by categoryIds', async () => {
    const res = await request
      .get(`/api/v1/catalog?categoryIds=${categoryId}`)
      .expect(200);

    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
  });

  it('can filter by tagIds', async () => {
    const res = await request
      .get(`/api/v1/catalog?tagIds=${tagId}`)
      .expect(200);

    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
  });

  it('can filter by characterIds', async () => {
    const res = await request
      .get(`/api/v1/catalog?characterIds=${characterId}`)
      .expect(200);

    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
  });

  it('can filter by seriesId', async () => {
    const res = await request
      .get(`/api/v1/catalog?seriesId=${seriesId}`)
      .expect(200);

    const found = res.body.data.find((e: { id: string }) => e.id === catalogEntryId);
    expect(found).toBeDefined();
  });

  it('can sort by title ascending', async () => {
    const res = await request
      .get('/api/v1/catalog?sortBy=title&sortOrder=asc')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
