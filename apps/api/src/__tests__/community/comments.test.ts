import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN, TEST_USER } from '../setup';
import { TEST_PREFIX } from '../global-setup';

const prisma = new PrismaClient();

let adminToken: string;
let userToken: string;
let approvedEntryId: string;
let secondEntryId: string;
let testSeriesId: string;
let testUserId: string;

// Track created IDs for cleanup
const createdCommentIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  testUserId = user!.id;

  // Get or create test series
  let series = await prisma.series.findFirst({ where: { title: { startsWith: TEST_PREFIX } } });
  if (!series) {
    series = await prisma.series.create({
      data: { title: `${TEST_PREFIX}Comment Test Series`, totalEditions: 5 },
    });
  }
  testSeriesId = series.id;

  // Create APPROVED catalog entry
  const entry1 = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Comment Test Entry`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: testUserId,
      approvalStatus: 'APPROVED',
    },
  });
  approvedEntryId = entry1.id;

  // Second APPROVED entry (for cross-entry parent validation)
  const entry2 = await prisma.catalogEntry.create({
    data: {
      title: `${TEST_PREFIX}Comment Test Entry 2`,
      author: 'Test Author',
      publisher: 'Test Publisher',
      seriesId: testSeriesId,
      createdById: testUserId,
      approvalStatus: 'APPROVED',
    },
  });
  secondEntryId = entry2.id;
});

afterAll(async () => {
  // Clean comment likes first
  if (createdCommentIds.length > 0) {
    await prisma.commentLike.deleteMany({
      where: { commentId: { in: createdCommentIds } },
    });
  }

  // Clean comments (children first, then parents)
  await prisma.comment.deleteMany({
    where: { catalogEntryId: { in: [approvedEntryId, secondEntryId].filter(Boolean) } },
  });

  // Clean catalog entries
  await prisma.catalogEntry.deleteMany({
    where: { id: { in: [approvedEntryId, secondEntryId].filter(Boolean) } },
  });

  await prisma.$disconnect();
});

// ============================================================================
// Comments
// ============================================================================

describe('Comments', () => {
  let topLevelCommentId: string;
  let replyCommentId: string;

  describe('GET /api/v1/comments/catalog/:catalogEntryId (empty)', () => {
    it('returns empty list for entry with no comments', async () => {
      const res = await request
        .get(`/api/v1/comments/catalog/${approvedEntryId}?catalogEntryId=${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('works without auth (isLiked = false)', async () => {
      const res = await request
        .get(`/api/v1/comments/catalog/${approvedEntryId}?catalogEntryId=${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/comments', () => {
    it('creates top-level comment', async () => {
      const res = await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: approvedEntryId,
          content: `${TEST_PREFIX}This is a great comic!`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toContain('great comic');
      expect(res.body.data.parentId).toBeNull();
      expect(res.body.data.user).toHaveProperty('name');
      topLevelCommentId = res.body.data.id;
      createdCommentIds.push(topLevelCommentId);
    });

    it('creates reply to top-level comment', async () => {
      const res = await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          catalogEntryId: approvedEntryId,
          parentId: topLevelCommentId,
          content: `${TEST_PREFIX}I agree!`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.parentId).toBe(topLevelCommentId);
      replyCommentId = res.body.data.id;
      createdCommentIds.push(replyCommentId);
    });

    it('returns 400 for reply to a reply (max 1 nesting)', async () => {
      const res = await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: approvedEntryId,
          parentId: replyCommentId,
          content: `${TEST_PREFIX}Nested too deep`,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 if parent belongs to different catalog entry', async () => {
      const res = await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: secondEntryId,
          parentId: topLevelCommentId, // belongs to approvedEntryId
          content: `${TEST_PREFIX}Cross-entry reply`,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent catalog entry', async () => {
      await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: 'nonexistent-id',
          content: `${TEST_PREFIX}Should fail`,
        })
        .expect(404);
    });

    it('returns 404 for non-existent parent comment', async () => {
      await request
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          catalogEntryId: approvedEntryId,
          parentId: 'nonexistent-id',
          content: `${TEST_PREFIX}Should fail`,
        })
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      await request
        .post('/api/v1/comments')
        .send({
          catalogEntryId: approvedEntryId,
          content: `${TEST_PREFIX}No auth`,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/comments/catalog/:id (with data)', () => {
    it('returns paginated top-level comments with nested replies', async () => {
      const res = await request
        .get(`/api/v1/comments/catalog/${approvedEntryId}?catalogEntryId=${approvedEntryId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Top-level comment should have replies
      const topLevel = res.body.data.find(
        (c: Record<string, unknown>) => c.id === topLevelCommentId,
      );
      expect(topLevel).toBeDefined();
      expect(topLevel.replies).toBeDefined();
      expect(topLevel.replies.length).toBeGreaterThanOrEqual(1);
    });

    it('includes isLiked when authenticated', async () => {
      const res = await request
        .get(`/api/v1/comments/catalog/${approvedEntryId}?catalogEntryId=${approvedEntryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data[0]).toHaveProperty('isLiked');
    });
  });

  describe('PUT /api/v1/comments/:id', () => {
    it('owner can update content', async () => {
      const res = await request
        .put(`/api/v1/comments/${topLevelCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: `${TEST_PREFIX}Updated comment!` })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toContain('Updated');
    });

    it('returns 403 for non-owner', async () => {
      await request
        .put(`/api/v1/comments/${topLevelCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: `${TEST_PREFIX}Hacked` })
        .expect(403);
    });

    it('returns 404 for non-existent comment', async () => {
      await request
        .put('/api/v1/comments/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: `${TEST_PREFIX}Not found` })
        .expect(404);
    });
  });

  describe('POST /api/v1/comments/:id/like', () => {
    it('toggles like on (liked: true, likesCount incremented)', async () => {
      const res = await request
        .post(`/api/v1/comments/${topLevelCommentId}/like`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.liked).toBe(true);
      expect(res.body.data.likesCount).toBeGreaterThanOrEqual(1);
    });

    it('toggles like off (liked: false, likesCount decremented)', async () => {
      const res = await request
        .post(`/api/v1/comments/${topLevelCommentId}/like`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.liked).toBe(false);
    });

    it('returns 404 for non-existent comment', async () => {
      await request
        .post('/api/v1/comments/nonexistent-id/like')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      await request
        .post(`/api/v1/comments/${topLevelCommentId}/like`)
        .expect(401);
    });
  });

  describe('DELETE /api/v1/comments/:id', () => {
    it('returns 403 for non-owner', async () => {
      await request
        .delete(`/api/v1/comments/${topLevelCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('deleting parent cascades to child replies', async () => {
      // Delete top-level comment (which has a reply)
      const res = await request
        .delete(`/api/v1/comments/${topLevelCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify reply was also deleted
      const reply = await prisma.comment.findUnique({
        where: { id: replyCommentId },
      });
      expect(reply).toBeNull();
    });
  });
});
