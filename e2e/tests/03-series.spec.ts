import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders, loginUI } from './helpers';

test.describe('Series — API & UI', () => {
  test('API returns series list', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/series?limit=20`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('API series have title and totalEditions', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/series?limit=5`, { headers: authHeaders(token) });
    const json = await res.json();
    const series = json.data[0];
    expect(series.title).toBeTruthy();
    expect(series).toHaveProperty('totalEditions');
  });

  test('API admin can create series', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.post(`${API_URL}/series`, {
      headers: authHeaders(token),
      data: { title: `E2E Test Series ${Date.now()}`, description: 'Test', totalEditions: 1 },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.title).toContain('E2E Test Series');

    // Cleanup
    await request.delete(`${API_URL}/series/${json.data.id}`, { headers: authHeaders(token) });
  });

  test('UI series page loads', async ({ page }) => {
    await loginUI(page);
    await page.goto('/pt-BR/series', { timeout: 60000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    // Should show series list (may take a while with 6k+ series)
    const errorOverlay = page.locator('[data-nextjs-dialog]');
    await expect(errorOverlay).not.toBeVisible();
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

