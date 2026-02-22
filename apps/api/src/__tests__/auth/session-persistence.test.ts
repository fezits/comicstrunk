import { describe, it, expect } from 'vitest';
import { request, TEST_USER } from '../setup';

/**
 * Helper to extract the refreshToken cookie value from a response
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

describe('Session Persistence', () => {
  it('login -> refresh -> access profile = session persists', async () => {
    // Step 1: Login
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    const refreshCookie = extractRefreshCookie(loginRes);
    expect(refreshCookie).toBeTruthy();

    // Step 2: Refresh to get a new token
    const refreshRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    const newToken = refreshRes.body.data.accessToken;
    expect(typeof newToken).toBe('string');

    // Step 3: Use the token from refresh to access a protected route
    const profileRes = await request
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.data.email).toBe(TEST_USER.email);
  });

  it('multiple refresh rotations work correctly', async () => {
    // Login
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    let currentCookie = extractRefreshCookie(loginRes);
    expect(currentCookie).toBeTruthy();

    // Perform 3 consecutive refresh rotations with delay between each
    // (JWTs signed in the same second with the same payload produce identical tokens)
    for (let i = 0; i < 3; i++) {
      await delay(1100);

      const refreshRes = await request
        .post('/api/v1/auth/refresh')
        .set('Cookie', currentCookie)
        .expect(200);

      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data.user).toMatchObject({
        email: TEST_USER.email,
        role: 'USER',
      });

      // Update cookie for next rotation
      const newCookie = extractRefreshCookie(refreshRes);
      expect(newCookie).toBeTruthy();
      currentCookie = newCookie;
    }

    // Verify the last token works to access a protected route
    const lastRefreshRes = await request
      .post('/api/v1/auth/refresh')
      .set('Cookie', currentCookie)
      .expect(200);

    const finalToken = lastRefreshRes.body.data.accessToken;

    const profileRes = await request
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${finalToken}`)
      .expect(200);

    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.data.email).toBe(TEST_USER.email);
  });
});
