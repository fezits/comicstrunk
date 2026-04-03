import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders, loginUI } from './helpers';

test.describe('Admin — Catalog Management', () => {
  test('API admin list catalog (all statuses)', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/catalog/admin/list?page=1&limit=10`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.pagination.total).toBeGreaterThan(0);
  });

  test('API admin create + approve catalog entry', async ({ request }) => {
    const { token } = await apiLogin(request);
    
    // Create
    const createRes = await request.post(`${API_URL}/catalog`, {
      headers: authHeaders(token),
      data: {
        title: `E2E Admin Test ${Date.now()}`,
        publisher: 'E2E Publisher',
        barcode: `e2e-${Date.now()}`,
      },
    });
    expect(createRes.status()).toBe(201);
    const entry = (await createRes.json()).data;
    expect(entry.approvalStatus).toBe('DRAFT');

    // Submit for approval (PATCH)
    const submitRes = await request.patch(`${API_URL}/catalog/${entry.id}/submit`, {
      headers: authHeaders(token),
    });
    expect(submitRes.status()).toBe(200);
    const submitted = (await submitRes.json()).data;
    expect(submitted.approvalStatus).toBe('PENDING');

    // Approve (PATCH)
    const approveRes = await request.patch(`${API_URL}/catalog/${entry.id}/approve`, {
      headers: authHeaders(token),
    });
    expect(approveRes.status()).toBe(200);
    const approved = (await approveRes.json()).data;
    expect(approved.approvalStatus).toBe('APPROVED');

    // Cleanup
    await request.delete(`${API_URL}/catalog/${entry.id}`, { headers: authHeaders(token) });
  });

  test('API non-admin cannot access admin list', async ({ request }) => {
    // Signup a regular user
    const email = `nonadmin-${Date.now()}@test.com`;
    const signupRes = await request.post(`${API_URL}/auth/signup`, {
      data: { name: 'Regular User', email, password: 'Test1234!', acceptedTerms: true },
    });
    const json = await signupRes.json();
    const userToken = json.data.accessToken;
    
    const res = await request.get(`${API_URL}/catalog/admin/list?page=1&limit=10`, {
      headers: authHeaders(userToken),
    });
    expect(res.status()).toBe(403);
  });

  test('UI admin page loads', async ({ page }) => {
    await loginUI(page);
    await page.goto('/pt-BR/admin');
    await page.waitForTimeout(3000);
    
    // Should not show error
    const errorOverlay = page.locator('[data-nextjs-dialog]');
    await expect(errorOverlay).not.toBeVisible();
  });
});

