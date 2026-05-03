import { test, expect } from '@playwright/test';

const PROD = 'https://comicstrunk.com';
const PROD_API = 'https://api.comicstrunk.com/api/v1';
const LOCALE = 'pt-BR';

test.describe.configure({ retries: 1 });

test.describe('Homepage CTAs prod smoke', () => {
  test('Ver Ofertas + Marketplace disabled "Em breve" for unauth', async ({ page }) => {
    await page.goto(`${PROD}/${LOCALE}`);
    await page.waitForLoadState('domcontentloaded');

    const ofertas = page.getByRole('button', { name: /ver ofertas/i });
    await expect(ofertas).toBeVisible({ timeout: 15000 });
    await expect(ofertas).toBeDisabled();
    await expect(ofertas).toContainText(/em breve/i);

    const marketplace = page.getByRole('button', { name: /^marketplace/i });
    await expect(marketplace).toBeVisible();
    await expect(marketplace).toBeDisabled();
    await expect(marketplace).toContainText(/em breve/i);
  });

  test('"Criar minha conta" CTA visible for unauth (default state)', async ({ page }) => {
    await page.goto(`${PROD}/${LOCALE}`);
    await page.waitForLoadState('networkidle');
    const cta = page.getByRole('link', { name: /criar minha conta/i });
    await expect(cta).toBeVisible({ timeout: 15000 });
  });

  test('Ver Ofertas + Marketplace clickable links for ADMIN', async ({ context, page }) => {
    const axios = await import('axios');
    const res = await axios.default.post(`${PROD_API}/auth/login`, {
      email: 'admin@comicstrunk.com',
      password: 'Admin123!',
    });
    const setCookie = res.headers['set-cookie'] || [];
    const refreshLine =
      (Array.isArray(setCookie) ? setCookie : [setCookie]).find(
        (c: string) => c?.startsWith('refreshToken='),
      ) || '';
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

    await page.goto(`${PROD}/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    const main = page.locator('main').first();
    const ofertasLink = main.getByRole('link', { name: /ver ofertas/i });
    await expect(ofertasLink).toBeVisible({ timeout: 15000 });
    await expect(ofertasLink).toHaveAttribute('href', new RegExp(`/${LOCALE}/deals$`));

    const marketplaceLink = main.getByRole('link', { name: /^marketplace$/i });
    await expect(marketplaceLink).toBeVisible();
    await expect(marketplaceLink).toHaveAttribute(
      'href',
      new RegExp(`/${LOCALE}/marketplace$`),
    );
  });
});
