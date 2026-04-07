import { test, expect } from '@playwright/test';
import { API_URL, loginUI } from './helpers';

test.describe('Health Check & Page Navigation', () => {
  test('API health check', async ({ request }) => {
    const res = await request.get('http://192.168.1.9:3005/health');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.database).toBe('ok');
  });

  test('UI homepage loads', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForTimeout(2000);
    const title = await page.title();
    expect(title).toBeTruthy();
    // Check no crash
    const errorOverlay = page.locator('[data-nextjs-dialog]');
    await expect(errorOverlay).not.toBeVisible();
  });

  test('UI login page loads', async ({ page }) => {
    await page.goto('/pt-BR/login');
    await page.waitForTimeout(2000);
    const emailInput = page.locator('input[type=email]').first();
    await expect(emailInput).toBeVisible();
  });

  test('UI signup page loads', async ({ page }) => {
    await page.goto('/pt-BR/signup');
    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  const publicPages = [
    '/pt-BR/catalog',
    '/pt-BR/series',
    '/pt-BR/deals',
    '/pt-BR/marketplace',
    '/pt-BR/contact',
    '/pt-BR/terms',
    '/pt-BR/privacy',
  ];

  for (const path of publicPages) {
    test(`UI ${path} loads without crash`, async ({ page }) => {
      await loginUI(page);
      await page.goto(path);
      await page.waitForTimeout(3000);
      
      const errorOverlay = page.locator('[data-nextjs-dialog]');
      await expect(errorOverlay).not.toBeVisible();
    });
  }

  const protectedPages = [
    '/pt-BR/collection',
    '/pt-BR/favorites',
    '/pt-BR/notifications',
  ];

  for (const path of protectedPages) {
    test(`UI ${path} (protected) loads after login`, async ({ page }) => {
      await loginUI(page);
      await page.goto(path);
      await page.waitForTimeout(3000);
      
      const errorOverlay = page.locator('[data-nextjs-dialog]');
      await expect(errorOverlay).not.toBeVisible();
    });
  }
});

