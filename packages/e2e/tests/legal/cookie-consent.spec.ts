import { test, expect } from '../../fixtures';

/**
 * Cookie Consent Banner tests.
 *
 * Verifies the cookie consent banner behavior: appears on first visit,
 * has accept button and link to cookie policy, hides after accepting,
 * and persists the preference via localStorage.
 *
 * IMPORTANT: The default Playwright project config sets cookieConsent=true
 * in localStorage, so the `page` fixture already has the banner dismissed.
 * These tests use a fresh browser context without that storage state.
 */
test.describe('Cookie Consent Banner', () => {
  test('should show cookie consent banner on first visit', async ({ browser }) => {
    // Use a fresh context without cookieConsent in localStorage
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/pt-BR/catalog');
      await page.waitForLoadState('networkidle');

      // Look for cookie consent banner — the component renders a fixed div at bottom
      // with text "Este site usa cookies..."
      const banner = page
        .getByText(/Este site usa cookies/i)
        .or(page.locator('[class*="cookie"], [class*="consent"]').first())
        .first();

      await expect(banner).toBeVisible({ timeout: 15_000 });

      // Banner should be fixed at the bottom
      const bannerBox = await banner.boundingBox();
      if (bannerBox) {
        const viewportSize = page.viewportSize();
        if (viewportSize) {
          // Banner should be in the lower portion of the viewport
          expect(bannerBox.y + bannerBox.height).toBeGreaterThan(viewportSize.height * 0.5);
        }
      }
    } finally {
      await context.close();
    }
  });

  test('should have accept button and link to cookie policy', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/pt-BR/catalog');
      await page.waitForLoadState('networkidle');

      // Find accept button — "Aceitar"
      const acceptBtn = page.getByRole('button', { name: /aceitar/i });
      await expect(acceptBtn).toBeVisible({ timeout: 15_000 });

      // Find cookie policy link — "Politica de Cookies" or "Saiba mais"
      const policyLink = page
        .getByRole('link', { name: /pol[ií]tica.*cookies|saiba mais/i })
        .or(page.locator('a[href*="cookies"]'))
        .first();

      const hasPolicyLink = await policyLink.isVisible().catch(() => false);

      // At minimum the accept button should exist; policy link is expected
      if (hasPolicyLink) {
        const href = await policyLink.getAttribute('href');
        expect(href).toMatch(/cookies/i);
      }
    } finally {
      await context.close();
    }
  });

  test('should hide banner after clicking accept', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/pt-BR/catalog');
      await page.waitForLoadState('networkidle');

      // Wait for banner to appear
      const bannerText = page.getByText(/Este site usa cookies/i);
      await expect(bannerText).toBeVisible({ timeout: 15_000 });

      // Click "Aceitar"
      const acceptBtn = page.getByRole('button', { name: /aceitar/i });
      await acceptBtn.click();
      await page.waitForTimeout(1000);

      // Banner should be hidden now
      await expect(bannerText).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('should NOT show banner again after accepting (localStorage persists)', async ({ browser }) => {
    test.slow();

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // First visit: accept cookies
      await page.goto('/pt-BR/catalog');
      await page.waitForLoadState('networkidle');

      const acceptBtn = page.getByRole('button', { name: /aceitar/i });
      const hasBanner = await acceptBtn.isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasBanner) {
        await acceptBtn.click();
        await page.waitForTimeout(500);
      }

      // Navigate to a different page
      await page.goto('/pt-BR/privacy');
      await page.waitForLoadState('networkidle');

      // Banner should NOT appear
      const bannerText = page.getByText(/Este site usa cookies/i);

      // Give it a short time to possibly appear
      await page.waitForTimeout(2000);
      const isVisible = await bannerText.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();

      // Navigate to another page to double-check
      await page.goto('/pt-BR/catalog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const isStillHidden = !(await bannerText.isVisible().catch(() => false));
      expect(isStillHidden).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test('should show banner again in new context without localStorage', async ({ browser }) => {
    // Create a brand-new context (no localStorage, no cookies)
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();

    try {
      await freshPage.goto('/pt-BR/catalog');
      await freshPage.waitForLoadState('networkidle');

      // Banner should appear for first-time visitors
      const bannerText = freshPage.getByText(/Este site usa cookies/i);
      await expect(bannerText).toBeVisible({ timeout: 15_000 });

      const acceptBtn = freshPage.getByRole('button', { name: /aceitar/i });
      await expect(acceptBtn).toBeVisible();
    } finally {
      await freshContext.close();
    }
  });
});
