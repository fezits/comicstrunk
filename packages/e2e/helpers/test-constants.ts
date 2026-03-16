export const TEST_PREFIX = '_test_';
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
export const LOCALE = 'pt-BR';

export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@comicstrunk.com',
    password: 'Admin123!',
  },
  user: {
    email: 'user@test.com',
    password: 'Test1234',
  },
  subscriber: {
    email: 'subscriber@test.com',
    password: 'Test1234',
  },
} as const;

/**
 * Storage state that includes cookieConsent in localStorage.
 * Use this when creating browser contexts manually via browser.newContext().
 * The authedPage/adminPage fixtures already set this, but manual contexts do not.
 */
export const STORAGE_STATE_WITH_CONSENT = {
  cookies: [] as Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>,
  origins: [{
    origin: BASE_URL,
    localStorage: [{ name: 'cookieConsent', value: 'true' }],
  }],
};
