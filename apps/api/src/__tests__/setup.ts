// Set NODE_ENV before importing anything
process.env.NODE_ENV = 'test';

import supertest from 'supertest';
import { createApp } from '../create-app';

// Create the Express app once for all tests (no server.listen())
const app = createApp();
export const request = supertest(app);

/**
 * Login helper — returns an access token for the given credentials.
 */
export async function loginAs(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshCookie: string }> {
  const res = await request
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const accessToken = res.body.data.accessToken as string;

  // Extract refresh cookie from set-cookie header
  const rawCookies = res.headers['set-cookie'];
  const cookies = rawCookies
    ? (Array.isArray(rawCookies) ? rawCookies : [rawCookies])
    : undefined;
  const refreshCookie =
    cookies?.find((c: string) => c.startsWith('refreshToken=')) ?? '';

  return { accessToken, refreshCookie };
}

/**
 * Pre-defined test credentials
 */
export const TEST_ADMIN = {
  email: 'admin@comicstrunk.com',
  password: 'Admin123!',
};

export const TEST_USER = {
  email: 'user@test.com',
  password: 'Test1234',
};

export const TEST_SUBSCRIBER = {
  email: 'subscriber@test.com',
  password: 'Test1234',
};
