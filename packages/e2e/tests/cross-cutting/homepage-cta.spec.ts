import { test, expect } from '../../fixtures';

const LOCALE = 'pt-BR';

test.describe('Homepage CTAs (overnight UX patches)', () => {
  test('"Ver Ofertas" hero button is disabled with "Em breve" badge', async ({ page }) => {
    await page.goto(`/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    const ofertas = page.getByRole('button', { name: /ver ofertas/i });
    await expect(ofertas).toBeVisible();
    await expect(ofertas).toBeDisabled();
    await expect(ofertas).toContainText(/em breve/i);
  });

  test('"Criar minha conta" CTA is HIDDEN for authenticated user', async ({ authedPage }) => {
    await authedPage.goto(`/${LOCALE}`);
    await authedPage.waitForLoadState('networkidle');

    const cta = authedPage.getByRole('link', { name: /criar minha conta/i });
    await expect(cta).toBeHidden();
  });

  test('"Criar minha conta" CTA is VISIBLE for unauthenticated user', async ({ page }) => {
    await page.goto(`/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    const cta = page.getByRole('link', { name: /criar minha conta/i });
    await expect(cta).toBeVisible();
  });
});
