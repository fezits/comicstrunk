import { test, expect } from '@playwright/test';
import axios from 'axios';

const PROD_API = 'https://api.comicstrunk.com/api/v1';

test.describe.configure({ retries: 1 });

test.describe('Suspender — prod smoke', () => {
  test('admin suspends a fresh user; suspended user cannot login', async () => {
    // Login admin
    const adminRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'admin@comicstrunk.com',
      password: 'Admin123!',
    });
    const adminToken = adminRes.data.data.accessToken;

    // Create a fresh disposable user
    const ts = Date.now();
    const email = `_test_suspend_prod_${ts}@e2e-test.com`;
    const password = 'Test1234!Aa';
    await axios.post(`${PROD_API}/auth/signup`, {
      name: `_test_ Suspend Victim ${ts}`,
      email,
      password,
      acceptedTerms: true,
    });

    // Login the fresh user (should work)
    const v1 = await axios.post(`${PROD_API}/auth/login`, {
      email,
      password,
    }, { validateStatus: () => true });
    expect(v1.status).toBe(200);
    const victimId = v1.data.data.user.id;

    // Admin suspends the user
    const suspendRes = await axios.post(
      `${PROD_API}/admin/users/${victimId}/suspend`,
      { reason: 'Smoke test prod do suspender — pode remover (>=10 chars)' },
      { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true },
    );
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.data.data.suspended).toBe(true);

    // Suspended user cannot login (403)
    const v2 = await axios.post(`${PROD_API}/auth/login`, {
      email,
      password,
    }, { validateStatus: () => true });
    expect(v2.status).toBe(403);
    expect(v2.data?.error?.message).toMatch(/suspens/i);

    // Cleanup: unsuspend
    await axios.post(
      `${PROD_API}/admin/users/${victimId}/unsuspend`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    // Now login should work again
    const v3 = await axios.post(`${PROD_API}/auth/login`, {
      email,
      password,
    }, { validateStatus: () => true });
    expect(v3.status).toBe(200);
  });
});
