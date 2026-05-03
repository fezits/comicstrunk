import { test, expect } from '@playwright/test';

const PROD = 'https://comicstrunk.com';
const LOCALE = 'pt-BR';

test.describe('Homepage CTAs prod smoke', () => {
  test('"Ver Ofertas" disabled with "Em breve" badge', async ({ page }) => {
    await page.goto(`${PROD}/${LOCALE}`);
    await page.waitForLoadState('domcontentloaded');
    const ofertas = page.getByRole('button', { name: /ver ofertas/i });
    await expect(ofertas).toBeVisible({ timeout: 15000 });
    await expect(ofertas).toBeDisabled();
    await expect(ofertas).toContainText(/em breve/i);
  });

  test('"Criar minha conta" CTA visible for unauth (default state)', async ({ page }) => {
    await page.goto(`${PROD}/${LOCALE}`);
    await page.waitForLoadState('networkidle');
    const cta = page.getByRole('link', { name: /criar minha conta/i });
    await expect(cta).toBeVisible({ timeout: 15000 });
  });
});
