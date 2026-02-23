import { describe, it, expect } from 'vitest';
import { request, TEST_USER } from '../setup';

/**
 * Helper to extract the refreshToken cookie string from a Set-Cookie header.
 * Returns the full Set-Cookie line for the refreshToken (for use with supertest .set('Cookie', ...)).
 */
function extractRefreshCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  const cookie = cookies?.find((c: string) => c.startsWith('refreshToken='));
  return cookie ?? '';
}

/**
 * Small delay to ensure JWT iat (seconds resolution) differs between tokens.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('POST /api/v1/auth/refresh', () => {
  it('happy path: valid refresh cookie returns new accessToken + user data', async () => {
    // Login first to get a refresh cookie
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const refreshCookie = extractRefreshCookie(loginRes);
    expect(refreshCookie).toBeTruthy();

    // Use the refresh cookie to get a new token
    const refreshRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data).toHaveProperty('accessToken');
    expect(typeof refreshRes.body.data.accessToken).toBe('string');
  });

  it('no cookie returns 401', async () => {
    const res = await request
      .post('/api/v1/auth/refresh')
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/no refresh token/i);
  });

  it('invalid cookie returns 401', async () => {
    const res = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=invalid-token-value')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('response includes user object with id, name, email, role', async () => {
    // Login to get refresh cookie
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const refreshCookie = extractRefreshCookie(loginRes);

    // Refresh
    const refreshRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    const user = refreshRes.body.data.user;
    expect(user).toBeDefined();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(user.email).toBe(TEST_USER.email);
    expect(user.role).toBe('USER');
  });

  it('token rotation: old token invalidated after refresh', async () => {
    // Login to get a refresh cookie
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    const oldRefreshCookie = extractRefreshCookie(loginRes);

    // Wait >1s so that JWT iat differs (JWTs signed with same payload in the same
    // second produce identical tokens, which would make the hash identical too)
    await delay(1100);

    // First refresh — should succeed and rotate the token
    const refreshRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(200);

    // Verify we got a new, different refresh cookie
    const newRefreshCookie = extractRefreshCookie(refreshRes);
    expect(newRefreshCookie).toBeTruthy();
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);

    // Second refresh with the OLD cookie — should fail (token reuse detection)
    const replayRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(401);

    expect(replayRes.body.success).toBe(false);
    expect(replayRes.body.error.message).toMatch(/reuse|invalid/i);

    // The NEW cookie from first refresh should also be invalidated (family revoked)
    const newReplayRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', newRefreshCookie)
      .expect(401);

    expect(newReplayRes.body.success).toBe(false);
  });
});
