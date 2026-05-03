import { test, expect } from '@playwright/test';
import axios from 'axios';

const PROD = 'https://comicstrunk.com';
const PROD_API = 'https://api.comicstrunk.com/api/v1';
const LOCALE = 'pt-BR';

test.describe('Filtro duplicados — prod smoke', () => {
  test.beforeEach(async ({ context }) => {
    // Login as admin and seed cookie
    const res = await axios.post(`${PROD_API}/auth/login`, {
      email: 'admin@comicstrunk.com',
      password: 'Admin123!',
    });
    const setCookie = res.headers['set-cookie'] || [];
    const refreshLine = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .find((c: string) => c?.startsWith('refreshToken=')) || '';
    const cookieValue = refreshLine.split(';')[0].replace('refreshToken=', '');

    if (cookieValue) {
      await context.addCookies([
        {
          name: 'refreshToken',
          value: cookieValue,
          domain: 'api.comicstrunk.com',
          path: '/api/v1/auth/refresh',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ]);
    }
  });

  test('checkbox toggles, URL updates, request fired', async ({ page }) => {
    const collectionRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/collection?') && !url.includes('/stats')) {
        collectionRequests.push(url);
      }
    });

    await page.goto(`${PROD}/${LOCALE}/collection`);
    await page.waitForLoadState('networkidle');

    const dupCheckbox = page.getByLabel(/duplicados na cole[cç][aã]o/i);
    await expect(dupCheckbox).toBeVisible({ timeout: 20000 });
    await expect(dupCheckbox).not.toBeChecked();

    await dupCheckbox.click();
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('duplicates=true');
    await expect(dupCheckbox).toBeChecked();

    const matched = collectionRequests.find((u) => u.includes('duplicates=true'));
    expect(matched).toBeTruthy();
  });
});
