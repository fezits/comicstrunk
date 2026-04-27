import { test as base, type Page, type BrowserContext } from '@playwright/test';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const TEST_PREFIX = '_test_';

const TEST_CREDENTIALS = {
  admin: { email: 'admin@comicstrunk.com', password: 'Admin123!' },
  user: { email: 'user@test.com', password: 'Test1234' },
  subscriber: { email: 'subscriber@test.com', password: 'Test1234' },
  seller: { email: 'seller@test.com', password: 'Test1234' },
} as const;

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  accessToken: string;
  refreshCookie: string;
};

// Cache login results per email to avoid hitting the rate limiter (5 req / 15 min per IP).
// The cache lives for the entire Playwright worker process, so each role logs in at most once.
const loginCache = new Map<string, AuthUser>();

// Internal: login via API and extract refresh cookie (with caching + 429 retry)
async function doLogin(email: string, password: string): Promise<AuthUser> {
  const cached = loginCache.get(email);
  if (cached) return cached;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { email, password },
        { withCredentials: true }
      );
      const { accessToken, user } = response.data.data;

      // Extract refresh cookie from set-cookie header
      const setCookieHeaders = response.headers['set-cookie'] || [];
      const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      const refreshCookie = cookies.find((c: string) => c?.startsWith('refreshToken=')) || '';

      const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role, accessToken, refreshCookie };
      loginCache.set(email, authUser);
      return authUser;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && attempt < MAX_RETRIES) {
        const waitSec = attempt * 30;
        console.warn(`[auth] Rate limited (429) for ${email}, waiting ${waitSec}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('[auth] Login failed after max retries');
}

// Internal: set the refresh cookie on a browser context so AuthProvider restores session
async function setAuthCookies(context: BrowserContext, authUser: AuthUser): Promise<void> {
  const cookieValue = authUser.refreshCookie.split(';')[0].replace('refreshToken=', '');
  if (!cookieValue) return;

  await context.addCookies([{
    name: 'refreshToken',
    value: cookieValue,
    domain: 'localhost',
    path: '/api/v1/auth/refresh',
    httpOnly: true,
    secure: false,
    sameSite: 'Strict',
  }]);
}

export type AuthFixtures = {
  loginAsUser: () => Promise<AuthUser>;
  loginAsAdmin: () => Promise<AuthUser>;
  loginAsSubscriber: () => Promise<AuthUser>;
  loginAsSeller: () => Promise<AuthUser>;
  loginAsFreshUser: (nameSuffix?: string) => Promise<AuthUser>;
  authenticateContext: (context: BrowserContext, authUser: AuthUser) => Promise<void>;
  authedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  loginAsUser: async ({}, use) => {
    await use(() => doLogin(TEST_CREDENTIALS.user.email, TEST_CREDENTIALS.user.password));
  },

  loginAsAdmin: async ({}, use) => {
    await use(() => doLogin(TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password));
  },

  loginAsSubscriber: async ({}, use) => {
    await use(() => doLogin(TEST_CREDENTIALS.subscriber.email, TEST_CREDENTIALS.subscriber.password));
  },

  loginAsSeller: async ({}, use) => {
    await use(() => doLogin(TEST_CREDENTIALS.seller.email, TEST_CREDENTIALS.seller.password));
  },

  loginAsFreshUser: async ({}, use) => {
    await use(async (nameSuffix?: string) => {
      const timestamp = Date.now();
      const suffix = nameSuffix || `user${timestamp}`;
      const email = `${TEST_PREFIX}${suffix}@e2e-test.com`;
      const password = 'Test1234!Aa';
      const name = `${TEST_PREFIX}E2E ${suffix}`;

      await axios.post(`${API_URL}/auth/signup`, {
        name, email, password, acceptedTerms: true,
      });

      return doLogin(email, password);
    });
  },

  authenticateContext: async ({}, use) => {
    await use(setAuthCookies);
  },

  authedPage: async ({ browser, loginAsUser, authenticateContext }, use) => {
    const authUser = await loginAsUser();
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [{
          origin: process.env.BASE_URL || 'http://localhost:3000',
          localStorage: [{ name: 'cookieConsent', value: 'true' }],
        }],
      },
    });
    await authenticateContext(context, authUser);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser, loginAsAdmin, authenticateContext }, use) => {
    const authUser = await loginAsAdmin();
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [{
          origin: process.env.BASE_URL || 'http://localhost:3000',
          localStorage: [{ name: 'cookieConsent', value: 'true' }],
        }],
      },
    });
    await authenticateContext(context, authUser);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { type AuthUser };
