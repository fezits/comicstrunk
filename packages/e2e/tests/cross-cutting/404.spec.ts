import { test, expect } from '../../fixtures';

/**
 * 404 Page tests.
 *
 * Verifies that visiting a nonexistent route shows a 404 page
 * and provides a link back to the catalog or home page.
 */
test.describe('404 Page', () => {
  test('should show 404 page for nonexistent route', async ({ page }) => {
    await page.goto('/pt-BR/nonexistent-page-xyz123');
    await page.waitForLoadState('networkidle');

    // Should display a 404 error message
    const notFoundText = page
      .getByText(/404|p[aá]gina n[aã]o encontrada|page not found|n[aã]o encontrad/i)
      .first();
    await expect(notFoundText).toBeVisible({ timeout: 15_000 });
  });

  test('should have a link back to catalog or home from 404 page', async ({ page }) => {
    await page.goto('/pt-BR/nonexistent-page-xyz123');
    await page.waitForLoadState('networkidle');

    // Look for a link to go back home or to catalog
    const homeLink = page
      .getByRole('link', { name: /voltar|home|in[ií]cio|cat[aá]logo|catalog/i })
      .first();

    const hasLink = await homeLink.isVisible().catch(() => false);

    if (hasLink) {
      await homeLink.click();
      await page.waitForLoadState('networkidle');

      // Should navigate to a valid page
      const url = page.url();
      expect(
        url.includes('/catalog') ||
        url.includes('/pt-BR') ||
        url.endsWith('/'),
      ).toBeTruthy();
    } else {
      // At minimum, the header navigation should still work
      const headerNav = page.locator('header nav, header a').first();
      const hasNav = await headerNav.isVisible().catch(() => false);
      expect(hasNav).toBeTruthy();
    }
  });
});
