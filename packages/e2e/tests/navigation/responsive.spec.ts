import { test, expect } from '../../fixtures';

test.describe('Responsive Navigation', () => {
  test('desktop (1280x720): sidebar visible, hamburger hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar should be visible on desktop
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Hamburger/menu button should not be visible on desktop
    const hamburger = page.locator('header').getByRole('button', { name: /menu/i });
    await expect(hamburger).not.toBeVisible();
  });

  test('mobile (375x667): sidebar hidden, hamburger visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar should be hidden on mobile
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();

    // Hamburger/menu button should be visible
    const hamburger = page.locator('header').getByRole('button', { name: /menu/i });
    await expect(hamburger).toBeVisible();
  });

  test('mobile: clicking hamburger opens mobile nav sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // Click the hamburger menu button
    const hamburger = page.locator('header').getByRole('button', { name: /menu/i });
    await hamburger.click();

    // A sheet/drawer should open with navigation items
    // Look for the "Explorar" group label in the mobile sheet (outside of <aside>)
    const mobileNav = page.locator('[role="dialog"], [data-state="open"]');
    await expect(mobileNav).toBeVisible({ timeout: 5_000 });

    // The mobile nav should contain some navigation links
    await expect(mobileNav.getByRole('link', { name: /cat[aá]logo/i })).toBeVisible();
  });

  test('mobile nav: clicking a link navigates and closes menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // Open hamburger menu
    const hamburger = page.locator('header').getByRole('button', { name: /menu/i });
    await hamburger.click();

    // Wait for the mobile nav sheet to appear
    const mobileNav = page.locator('[role="dialog"], [data-state="open"]');
    await expect(mobileNav).toBeVisible({ timeout: 5_000 });

    // Click the "Marketplace" link in the mobile nav
    await mobileNav.getByRole('link', { name: /marketplace/i }).click();

    // Should navigate to marketplace page
    await expect(page).toHaveURL(/\/marketplace/, { timeout: 10_000 });

    // Mobile nav sheet should close after navigation
    await expect(mobileNav).not.toBeVisible({ timeout: 5_000 });
  });
});
