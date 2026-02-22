import { describe, it, expect } from 'vitest';
import { request, loginAs, TEST_USER } from '../setup';

describe('User Profile', () => {
  describe('GET /api/v1/users/profile', () => {
    it('authenticated user gets 200 + user profile', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      const res = await request
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: TEST_USER.email,
        name: 'Test User',
        role: 'USER',
      });
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('avatarUrl');
      expect(res.body.data).toHaveProperty('bio');
      expect(res.body.data).toHaveProperty('websiteUrl');
      expect(res.body.data).toHaveProperty('twitterHandle');
      expect(res.body.data).toHaveProperty('instagramHandle');
      expect(res.body.data).toHaveProperty('createdAt');
    });

    it('no token returns 401', async () => {
      const res = await request
        .get('/api/v1/users/profile')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('invalid token returns 401', async () => {
      const res = await request
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('update name returns 200 + updated data', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      const res = await request
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.email).toBe(TEST_USER.email);

      // Restore original name
      await request
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test User' })
        .expect(200);
    });

    it('update bio and social handles', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      const res = await request
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bio: 'Comic book enthusiast',
          twitterHandle: '@comicfan',
          instagramHandle: '@comicfan_ig',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.bio).toBe('Comic book enthusiast');
      expect(res.body.data.twitterHandle).toBe('comicfan'); // @ stripped
      expect(res.body.data.instagramHandle).toBe('comicfan_ig'); // @ stripped

      // Clean up
      await request
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bio: '',
          twitterHandle: '',
          instagramHandle: '',
        })
        .expect(200);
    });

    it('validation errors for invalid name', async () => {
      const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

      const res = await request
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'X' }) // too short (min 2)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/validation/i);
    });

    it('no token returns 401', async () => {
      const res = await request
        .put('/api/v1/users/profile')
        .send({ name: 'No Auth' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
