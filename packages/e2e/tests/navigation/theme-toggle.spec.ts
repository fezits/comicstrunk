import { test, expect } from '../../fixtures';

test.describe('Theme Toggle', () => {
  test('default theme is dark mode', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // The <html> element should have the "dark" class by default
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('toggle to light mode removes dark class', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const html = page.locator('html');

    // Verify starting in dark mode
    await expect(html).toHaveClass(/dark/);

    // Click the theme toggle button (has sr-only text "Alternar tema")
    const themeToggle = page.getByRole('button', { name: /alternar tema/i });
    await themeToggle.click();

    // Select "Claro" (light) from the dropdown
    const lightOption = page.getByRole('menuitem', { name: /claro/i });
    await lightOption.click();

    // The <html> element should no longer have "dark" class
    await expect(html).not.toHaveClass(/dark/, { timeout: 5_000 });
  });

  test('theme preference persists across page reload', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const html = page.locator('html');

    // Start in dark mode
    await expect(html).toHaveClass(/dark/);

    // Switch to light mode
    const themeToggle = page.getByRole('button', { name: /alternar tema/i });
    await themeToggle.click();
    await page.getByRole('menuitem', { name: /claro/i }).click();

    // Confirm light mode is active
    await expect(html).not.toHaveClass(/dark/, { timeout: 5_000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Theme should persist as light after reload (stored in localStorage by next-themes)
    await expect(html).not.toHaveClass(/dark/, { timeout: 5_000 });
  });
});
