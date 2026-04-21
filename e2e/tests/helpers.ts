import { type Page, type APIRequestContext } from '@playwright/test';

export const API_URL = 'http://192.168.1.9:3005/api/v1';
export const WEB_URL = 'http://localhost:3006';
export const ADMIN_EMAIL = 'admin@comicstrunk.com';
export const ADMIN_PASS = 'Admin123!';

export async function apiLogin(request: APIRequestContext, email = ADMIN_EMAIL, password = ADMIN_PASS) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  const json = await res.json();
  return { token: json.data.accessToken, user: json.data.user };
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function loginUI(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASS) {
  await page.goto('/pt-BR/login');
  await page.waitForTimeout(1500);
  await page.locator('input[type=email]').first().fill(email);
  await page.locator('input[type=password]').first().fill(password);
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(3000);
}

export async function apiSignup(request: APIRequestContext, name: string, email: string, password: string) {
  const res = await request.post(`${API_URL}/auth/signup`, {
    data: { name, email, password, acceptedTerms: true },
  });
  return res;
}

