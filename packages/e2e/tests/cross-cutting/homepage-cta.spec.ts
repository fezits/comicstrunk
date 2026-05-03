import { test, expect } from '../../fixtures';

const LOCALE = 'pt-BR';

test.describe.configure({ retries: 2 });

test.describe('Homepage CTAs', () => {
  test('"Ver Ofertas" disabled with "Em breve" badge for unauth', async ({ page }) => {
    await page.goto(`/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    const ofertas = page.getByRole('button', { name: /ver ofertas/i });
    await expect(ofertas).toBeVisible();
    await expect(ofertas).toBeDisabled();
    await expect(ofertas).toContainText(/em breve/i);
  });

  test('"Marketplace" disabled with "Em breve" badge for unauth', async ({ page }) => {
    await page.goto(`/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    const marketplace = page.getByRole('button', { name: /^marketplace/i });
    await expect(marketplace).toBeVisible();
    await expect(marketplace).toBeDisabled();
    await expect(marketplace).toContainText(/em breve/i);
  });

  test('"Ver Ofertas" + "Marketplace" are clickable LINKS for ADMIN', async ({ adminPage }) => {
    await adminPage.goto(`/${LOCALE}`);
    await adminPage.waitForLoadState('networkidle');

    // Scope to <main> to avoid sidebar nav links with same name
    const main = adminPage.locator('main').first();
    const ofertas = main.getByRole('link', { name: /ver ofertas/i });
    const marketplaceLink = main.getByRole('link', { name: /^marketplace$/i });

    await expect(ofertas).toBeVisible();
    await expect(ofertas).toHaveAttribute('href', new RegExp(`/${LOCALE}/deals$`));

    await expect(marketplaceLink).toBeVisible();
    await expect(marketplaceLink).toHaveAttribute(
      'href',
      new RegExp(`/${LOCALE}/marketplace$`),
    );
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
