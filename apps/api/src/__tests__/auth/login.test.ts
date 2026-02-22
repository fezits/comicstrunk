import { describe, it, expect } from 'vitest';
import { request, TEST_USER, TEST_ADMIN } from '../setup';

describe('POST /api/v1/auth/login', () => {
  it('happy path: correct credentials return 200 + accessToken + user', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user).toMatchObject({
      email: TEST_USER.email,
      name: 'Test User',
      role: 'USER',
    });
    expect(res.body.data.user).toHaveProperty('id');
  });

  it('wrong password returns 401', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPassword1' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/invalid credentials/i);
  });

  it('non-existent email returns 401', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'SomePass123' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/invalid credentials/i);
  });

  it('missing fields returns validation error', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/validation/i);
  });

  it('sets refresh token cookie (httpOnly)', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const rawCookies = res.headers['set-cookie'];
    const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c: string) =>
      c.startsWith('refreshToken='),
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('admin login returns role=ADMIN', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(200);

    expect(res.body.data.user.role).toBe('ADMIN');
  });
});
