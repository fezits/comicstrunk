import request from 'supertest';
import { createApp } from '../../create-app';
import { prisma } from '../../shared/lib/prisma';
import { TEST_PREFIX } from '../global-setup';

describe('GET /api/v1/users/:id/public', () => {
  const app = createApp();
  let testUserId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      email: `${TEST_PREFIX}public-profile@test.com`,
      name: `${TEST_PREFIX} Public User`,
      password: 'Test1234!',
      acceptedTerms: true,
    });
    testUserId = res.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: `${TEST_PREFIX}public-profile@test.com` } } });
    await prisma.user.deleteMany({ where: { email: `${TEST_PREFIX}public-profile@test.com` } });
  });

  it('returns public profile without authentication', async () => {
    const res = await request(app).get(`/api/v1/users/${testUserId}/public`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: testUserId,
      name: `${TEST_PREFIX} Public User`,
    });
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data).toHaveProperty('avatarUrl');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('returns 404 for unknown user ID', async () => {
    const res = await request(app).get('/api/v1/users/nonexistent-id-xyz/public');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
