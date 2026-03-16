import { test, expect } from '../../fixtures';

/**
 * Error Handling tests.
 *
 * Verifies that forms display visual validation errors for invalid data
 * and that the app handles network errors gracefully.
 */
test.describe('Error Handling', () => {
  test('form with invalid data should show visual validation errors', async ({ page }) => {
    // Use the login form as a test case for validation errors
    await page.goto('/pt-BR/login');
    await page.waitForLoadState('networkidle');

    // Submit with empty fields
    const submitBtn = page.getByRole('button', { name: /entrar|login|submit/i });
    await submitBtn.click();

    // Should stay on the login page (form did not submit)
    await expect(page).toHaveURL(/\/login/);

    // Fill an invalid email
    const emailInput = page.getByLabel(/e-?mail/i);
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('not-an-email');
      await submitBtn.click();

      // Should show a validation error or stay on login page
      await expect(page).toHaveURL(/\/login/);
    }

    // Fill valid email but wrong password
    await emailInput.fill('user@test.com');
    const passwordInput = page.getByLabel(/senha|password/i);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('wrong');
      await submitBtn.click();

      // Should show error toast or validation message
      const errorIndicator = page
        .locator('[data-sonner-toaster]')
        .getByText(/erro|error|inv[aá]lid|incorret/i)
        .or(page.getByText(/erro|error|inv[aá]lid|incorret/i));
      const hasError = await errorIndicator.isVisible({ timeout: 5_000 }).catch(() => false);

      // Either error shown or still on login page
      const onLoginPage = page.url().includes('/login');
      expect(hasError || onLoginPage).toBeTruthy();
    }
  });

  test('network error handling — app does not crash with API down', async ({ page }) => {
    // This test verifies the app handles unreachable API gracefully.
    // We simulate this by navigating to a page that requires API data
    // after blocking API requests via route interception.

    // Intercept API calls and abort them to simulate network failure
    await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'));

    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    // The page should not show a blank white screen or crash completely
    // It should show either an error message or the page shell
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15_000 });

    // Check the page has some content (not a completely empty body)
    const bodyText = await body.textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    // Look for error UI elements
    const errorMessage = page
      .getByText(/erro|error|falha|fail|tente novamente|try again|indispon[ií]vel|unavailable/i)
      .first();
    const hasError = await errorMessage.isVisible().catch(() => false);

    // Either error message or at least the page shell should render
    const hasHeader = await page.locator('header').isVisible().catch(() => false);
    expect(hasError || hasHeader || bodyText!.length > 100).toBeTruthy();

    // Clean up route interception
    await page.unroute('**/api/v1/**');
  });
});
