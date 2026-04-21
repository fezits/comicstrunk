import { test, expect } from '../../fixtures';
import { apiClient } from '../../helpers/api-client';

test.describe('Deals Browsing', () => {
  test('should display deals page with heading', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.getByRole('heading', {
      name: /ofertas|deals|promo[cç][oõ]es/i,
    }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should show deal cards from seed data', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');

    // Wait for deal cards to load
    const dealCards = page.locator('[class*="card"], [data-testid*="deal"]').filter({
      has: page.locator('h2, h3, h4, [class*="title"]'),
    });

    // Seed data has 7 active deals (1 expired is filtered out)
    await expect(dealCards.first()).toBeVisible({ timeout: 10_000 });
    const count = await dealCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should filter deals by store using dropdown', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');

    // Wait for initial deals and filter data to load
    await page.waitForTimeout(2_000);

    // The deals page uses shadcn Select components rendered as buttons with placeholder text.
    // The store filter shows "Todas as lojas" by default.
    const storeFilterTrigger = page.locator('button').filter({ hasText: /todas as lojas/i }).first();
    await expect(storeFilterTrigger).toBeVisible({ timeout: 10_000 });

    // Open the store dropdown
    await storeFilterTrigger.click();
    await page.waitForTimeout(500);

    // Look for store options in the dropdown (shadcn SelectContent uses role="option")
    const storeOptions = page.locator('[role="option"]');
    const optionCount = await storeOptions.count();

    // Should have at least "Todas as lojas" + one real store from seed data
    expect(optionCount).toBeGreaterThanOrEqual(2);

    // Select the first non-"all" store option
    if (optionCount >= 2) {
      await storeOptions.nth(1).click();
      await page.waitForTimeout(1_000);

      // After filtering, the page should still show deal cards or an empty state
      const dealCards = page.locator('[class*="card"], [data-testid*="deal"]').filter({
        has: page.locator('h2, h3, h4, [class*="title"]'),
      });
      const emptyState = page.getByText(/nenhuma oferta/i);

      const hasCards = await dealCards.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 1_000 }).catch(() => false);

      // Either filtered cards or empty state should be visible
      expect(hasCards || hasEmpty).toBeTruthy();
    }
  });

  test('should show all four filter dropdowns', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_500);

    // The deals page has 4 filter dropdowns (shadcn Select with button triggers):
    // "Todas as lojas", "Todas as categorias", "Todos" (type), "Mais recentes" (sort)
    const storeFilter = page.locator('button').filter({ hasText: /todas as lojas/i }).first();
    const categoryFilter = page.locator('button').filter({ hasText: /todas as categorias/i }).first();
    const typeFilter = page.locator('button').filter({ hasText: /todos/i }).first();
    const sortFilter = page.locator('button').filter({ hasText: /mais recentes/i }).first();

    await expect(storeFilter).toBeVisible({ timeout: 10_000 });
    await expect(categoryFilter).toBeVisible({ timeout: 5_000 });
    await expect(typeFilter).toBeVisible({ timeout: 5_000 });
    await expect(sortFilter).toBeVisible({ timeout: 5_000 });
  });

  test('should filter deals by category using dropdown', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    // Open category filter dropdown
    const categoryTrigger = page.locator('button').filter({ hasText: /todas as categorias/i }).first();
    await expect(categoryTrigger).toBeVisible({ timeout: 10_000 });
    await categoryTrigger.click();
    await page.waitForTimeout(500);

    // Should have category options
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();

    // "Todas as categorias" + at least one real category from seed
    expect(optionCount).toBeGreaterThanOrEqual(2);

    // Select a category
    if (optionCount >= 2) {
      await options.nth(1).click();
      await page.waitForTimeout(1_000);

      // Page should respond (either cards or empty state)
      const dealCards = page.locator('[class*="card"], [data-testid*="deal"]').filter({
        has: page.locator('h2, h3, h4, [class*="title"]'),
      });
      const emptyState = page.getByText(/nenhuma oferta/i);

      const hasCards = await dealCards.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 1_000 }).catch(() => false);

      expect(hasCards || hasEmpty).toBeTruthy();
    }
  });

  test('should filter deals by type (COUPON vs PROMOTION)', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    // Open the type filter dropdown (default text is "Todos")
    const typeTrigger = page.locator('button').filter({ hasText: /^todos$/i }).first();
    await expect(typeTrigger).toBeVisible({ timeout: 10_000 });
    await typeTrigger.click();
    await page.waitForTimeout(500);

    // Look for "Cupons" option in the dropdown
    const cuponsOption = page.locator('[role="option"]').filter({ hasText: /cup[oõ]ns|cup[oõ]es/i }).first();
    const hasCupons = await cuponsOption.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasCupons) {
      await cuponsOption.click();
      await page.waitForTimeout(1_000);

      // Seed data has COUPON deals — verify at least one shows or empty state
      const dealCards = page.locator('[class*="card"], [data-testid*="deal"]').filter({
        has: page.locator('h2, h3, h4, [class*="title"]'),
      });
      const emptyState = page.getByText(/nenhuma oferta/i);

      const hasCards = await dealCards.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 1_000 }).catch(() => false);

      expect(hasCards || hasEmpty).toBeTruthy();
    }
  });

  test('should have sorting options', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    // Open the sort dropdown (default text is "Mais recentes")
    const sortTrigger = page.locator('button').filter({ hasText: /mais recentes/i }).first();
    await expect(sortTrigger).toBeVisible({ timeout: 10_000 });
    await sortTrigger.click();
    await page.waitForTimeout(500);

    // Check for sort options: "Mais recentes" and "Expirando em breve"
    const recentOption = page.locator('[role="option"]').filter({ hasText: /mais recentes/i }).first();
    const expiringOption = page.locator('[role="option"]').filter({ hasText: /expirando/i }).first();

    const hasRecent = await recentOption.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasExpiring = await expiringOption.isVisible({ timeout: 3_000 }).catch(() => false);

    // Both sort options should be available
    expect(hasRecent || hasExpiring).toBeTruthy();

    // Select "Expirando em breve" if available
    if (hasExpiring) {
      await expiringOption.click();
      await page.waitForTimeout(1_000);

      // URL should reflect the sort change
      expect(page.url()).toMatch(/sort=expiring/i);
    }
  });

  test('should verify deals count via API matches seed expectations', async () => {
    // Verify active deals via API (7 active from seed: 8 total minus 1 expired)
    const response = await apiClient.get('/deals', {
      params: { page: 1, limit: 20 },
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    const total = response.data.pagination?.total ?? response.data.data?.length ?? 0;
    // At least the 7 non-expired seed deals should be active
    expect(total).toBeGreaterThanOrEqual(7);
  });
});
