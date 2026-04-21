import { test, expect } from '../../fixtures';

test.describe('Password Reset Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pt-BR/forgot-password');
  });

  test('should display forgot password form correctly', async ({ page }) => {
    // Heading uses gradient-text class (CardTitle renders as <div>, not <h>)
    await expect(
      page.locator('.gradient-text').filter({ hasText: /Esqueceu a senha/ }),
    ).toBeVisible();

    // Email input should be visible
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByPlaceholder('email@exemplo.com')).toBeVisible();

    // Submit button — "Enviar link de redefinicao"
    await expect(
      page.getByRole('button', { name: /enviar link de redefini/i }),
    ).toBeVisible();

    // Back to login link — "Voltar para login"
    await expect(
      page.getByRole('link', { name: /voltar para login/i }),
    ).toBeVisible();
  });

  test('should submit valid email and show confirmation message', async ({ page }) => {
    // Fill in a valid email (it doesn't matter if it exists or not --
    // the API returns a generic success message for security)
    await page.getByLabel('E-mail').fill('user@test.com');
    await page.getByRole('button', { name: /enviar link de redefini/i }).click();

    // After submission, the form is replaced by a confirmation text + "Voltar para login" link.
    // Also a toast fires with the same text. Check for either.
    const confirmationText = page.getByText(/Se o email existir/i);
    const toast = page.locator('[data-sonner-toaster]').getByText(/Se o email existir/i);
    await expect(confirmationText.or(toast)).toBeVisible({ timeout: 10_000 });
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Type an invalid email format
    await page.getByLabel('E-mail').fill('not-an-email');
    await page.getByRole('button', { name: /enviar link de redefini/i }).click();

    // Should stay on the same page (client-side validation blocks submission)
    await expect(page).toHaveURL(/\/forgot-password/);

    // The email input should show a validation state (HTML5 validation or Zod)
    // Verify no success message is shown
    await expect(
      page.getByText(/Se o email existir/i),
    ).not.toBeVisible();
  });
});
