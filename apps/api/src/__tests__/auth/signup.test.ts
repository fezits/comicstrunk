import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request } from '../setup';

const prisma = new PrismaClient();

// Track emails created during this test suite for cleanup
const createdEmails: string[] = [];

afterAll(async () => {
  // Clean up users created during signup tests
  for (const email of createdEmails) {
    await prisma.refreshToken.deleteMany({
      where: { user: { email } },
    });
    await prisma.user.deleteMany({ where: { email } });
  }
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/signup', () => {
  it('happy path: new user signs up and gets 201 + accessToken + user data', async () => {
    const email = `signup-happy-${Date.now()}@test-signup.com`;
    createdEmails.push(email);

    const res = await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'New User',
        email,
        password: 'StrongPass1',
        acceptedTerms: true,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user).toMatchObject({
      name: 'New User',
      email,
      role: 'USER',
    });
    expect(res.body.data.user).toHaveProperty('id');
    expect(typeof res.body.data.user.id).toBe('string');
  });

  it('duplicate email returns 409', async () => {
    const email = `signup-dup-${Date.now()}@test-signup.com`;
    createdEmails.push(email);

    // First signup — should succeed
    await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'First',
        email,
        password: 'StrongPass1',
        acceptedTerms: true,
      })
      .expect(201);

    // Second signup with same email — should fail
    const res = await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'Second',
        email,
        password: 'StrongPass1',
        acceptedTerms: true,
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/email/i);
  });

  it('missing required fields returns validation error', async () => {
    const res = await request
      .post('/api/v1/auth/signup')
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/validation/i);
    expect(res.body.error).toHaveProperty('details');
  });

  it('weak password returns validation error', async () => {
    const res = await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'Weak Pass',
        email: `weak-${Date.now()}@test-signup.com`,
        password: 'short',
        acceptedTerms: true,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/validation/i);
  });

  it('acceptedTerms false returns error', async () => {
    const res = await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'No Terms',
        email: `noterms-${Date.now()}@test-signup.com`,
        password: 'StrongPass1',
        acceptedTerms: false,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('response has correct user shape (id, name, email, role=USER)', async () => {
    const email = `signup-shape-${Date.now()}@test-signup.com`;
    createdEmails.push(email);

    const res = await request
      .post('/api/v1/auth/signup')
      .send({
        name: 'Shape Test',
        email,
        password: 'StrongPass1',
        acceptedTerms: true,
      })
      .expect(201);

    const user = res.body.data.user;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(user.role).toBe('USER');
    // Should NOT expose passwordHash
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('password_hash');
  });
});
