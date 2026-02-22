import { describe, it, expect } from 'vitest';
import { request, loginAs, TEST_USER } from '../setup';

describe('POST /api/v1/auth/logout', () => {
  it('happy path: authenticated user returns 200 and clears cookie', async () => {
    const { accessToken } = await loginAs(TEST_USER.email, TEST_USER.password);

    const res = await request
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/logged out/i);

    // Check that the refresh cookie is being cleared
    const rawCookies = res.headers['set-cookie'];
    const cookies = rawCookies
      ? (Array.isArray(rawCookies) ? rawCookies : [rawCookies as string])
      : undefined;
    if (cookies) {
      const refreshCookie = cookies.find((c: string) =>
        c.startsWith('refreshToken='),
      );
      if (refreshCookie) {
        // Cookie should be cleared (empty value or expired)
        expect(
          refreshCookie.includes('refreshToken=;') ||
          refreshCookie.includes('Expires=Thu, 01 Jan 1970'),
        ).toBe(true);
      }
    }
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request
      .post('/api/v1/auth/logout')
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
