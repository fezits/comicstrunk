import { test, expect } from '@playwright/test';
import { API_URL, ADMIN_EMAIL, ADMIN_PASS, apiLogin, loginUI } from './helpers';

test.describe('Auth — Login/Signup/Logout', () => {
  test('API login returns token and user', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeTruthy();
    expect(json.data.user.email).toBe(ADMIN_EMAIL);
    expect(json.data.user.role).toBe('ADMIN');
  });

  test('API login with wrong password returns error', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: 'wrongpass' },
    });
    expect(res.status()).toBe(401);
  });

  test('API signup creates new user', async ({ request }) => {
    const email = `test-e2e-${Date.now()}@test.com`;
    const res = await request.post(`${API_URL}/auth/signup`, {
      data: { name: 'Test E2E User', email, password: 'Test1234!', acceptedTerms: true },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.user.email).toBe(email);
    expect(json.data.user.role).toBe('USER');
  });

  test('UI login redirects to home', async ({ page }) => {
    await loginUI(page);
    expect(page.url()).toContain('/pt-BR');
    expect(page.url()).not.toContain('/login');
  });

  test('UI shows login success toast', async ({ page }) => {
    await page.goto('/pt-BR/login');
    await page.waitForTimeout(1500);
    await page.locator('input[type=email]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type=password]').first().fill(ADMIN_PASS);
    await page.locator('button[type=submit]').first().click();
    await page.waitForTimeout(2000);
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('UI login with wrong password shows error', async ({ page }) => {
    await page.goto('/pt-BR/login');
    await page.waitForTimeout(1500);
    await page.locator('input[type=email]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type=password]').first().fill('wrongpass');
    await page.locator('button[type=submit]').first().click();
    await page.waitForTimeout(2000);
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });
});

