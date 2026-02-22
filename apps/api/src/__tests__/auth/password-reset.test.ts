import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { request, TEST_USER } from '../setup';

const prisma = new PrismaClient();

describe('Password Reset', () => {
  describe('POST /api/v1/auth/password-reset/request', () => {
    it('existing email returns 200 (always success)', async () => {
      const res = await request
        .post('/api/v1/auth/password-reset/request')
        .send({ email: TEST_USER.email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
    });

    it('non-existent email returns 200 (no info leak)', async () => {
      const res = await request
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'doesnotexist@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/password-reset/confirm', () => {
    it('valid token resets password and returns 200', async () => {
      // Directly create a password reset token in the database
      const user = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });

      expect(user).toBeDefined();

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.passwordReset.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        },
      });

      const res = await request
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: rawToken, password: 'NewStrongPass1' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/reset/i);

      // Verify the new password works
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ email: TEST_USER.email, password: 'NewStrongPass1' })
        .expect(200);

      expect(loginRes.body.success).toBe(true);

      // Restore original password for subsequent tests
      const restoreToken = crypto.randomBytes(32).toString('hex');
      const restoreHash = crypto.createHash('sha256').update(restoreToken).digest('hex');

      await prisma.passwordReset.create({
        data: {
          userId: user!.id,
          tokenHash: restoreHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await request
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: restoreToken, password: TEST_USER.password })
        .expect(200);
    });

    it('expired/invalid token returns 400', async () => {
      const res = await request
        .post('/api/v1/auth/password-reset/confirm')
        .send({
          token: 'totally-invalid-token-that-does-not-exist-in-db',
          password: 'NewStrongPass1',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid|expired/i);
    });

    it('already used token returns 400', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Create an already-used token
      await prisma.passwordReset.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(), // already used
        },
      });

      const res = await request
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: rawToken, password: 'NewStrongPass1' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid|expired/i);
    });
  });
});
