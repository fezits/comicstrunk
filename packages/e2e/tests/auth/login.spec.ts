import { test, expect } from '../../fixtures';
import { LoginPage } from '../../page-objects/login.page';
import { HeaderComponent } from '../../page-objects/header.component';

test.describe('Login Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should display login page correctly', async ({ page }) => {
    await loginPage.expectPageVisible();

    // Verify placeholders
    await expect(page.getByPlaceholder('email@exemplo.com')).toBeVisible();
    await expect(page.getByPlaceholder('********')).toBeVisible();

    // Verify auxiliary links
    await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await loginPage.fillAndSubmit('user@test.com', 'Test1234');

    // Should show success toast
    await loginPage.expectToast(/Login realizado com sucesso/i);

    // Should redirect away from login
    await loginPage.expectLoginSuccess();

    // Header should show authenticated state
    const header = new HeaderComponent(page);
    await header.expectAuthenticated();
  });

  test('should login successfully as admin', async ({ page }) => {
    await loginPage.fillAndSubmit('admin@comicstrunk.com', 'Admin123!');

    // Should redirect away from login
    await loginPage.expectLoginSuccess();

    // Header should show authenticated state
    const header = new HeaderComponent(page);
    await header.expectAuthenticated();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.fillAndSubmit('user@test.com', 'WrongPassword1');

    // Should show error toast
    await loginPage.expectLoginError();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for nonexistent email', async ({ page }) => {
    await loginPage.fillAndSubmit('nonexistent@nobody.com', 'SomePassword1');

    // Should show credentials error (API returns same error for security)
    await loginPage.expectLoginError();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation for empty fields', async ({ page }) => {
    // Click submit without filling any fields
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Should stay on login page (form should not submit)
    await expect(page).toHaveURL(/\/login/);

    // Try submitting with only email
    await page.getByLabel('E-mail').fill('user@test.com');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Try submitting with only password
    await page.getByLabel('E-mail').clear();
    await page.getByLabel('Senha').fill('Test1234');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to signup page', async ({ page }) => {
    await loginPage.goToSignup();
    await page.waitForURL('**/pt-BR/signup');
    await expect(page.locator('.gradient-text').filter({ hasText: 'Criar conta' })).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await loginPage.goToForgotPassword();
    await page.waitForURL('**/pt-BR/forgot-password');
    await expect(
      page.getByRole('button', { name: /enviar link de redefini/i }),
    ).toBeVisible();
  });

  test.skip('should show rate limit error after too many attempts', async ({ page }) => {
    // SKIPPED: This test would trigger the real rate limiter (5 per 15 min),
    // which would break subsequent tests that need to log in.
    // To test rate limiting safely, use a dedicated email that is not used elsewhere,
    // or run this test in isolation with the rate limit window reset.

    const fakeEmail = '_test_ratelimit@e2e-test.com';
    for (let i = 0; i < 6; i++) {
      await page.getByLabel('E-mail').fill(fakeEmail);
      await page.getByLabel('Senha').fill('WrongPassword1');
      await page.getByRole('button', { name: 'Entrar' }).click();
      // Wait briefly for the response before next attempt
      await page.waitForTimeout(500);
    }

    // After exceeding the limit, should show rate limit error
    await expect(
      page.locator('[data-sonner-toaster]').getByText(/Muitas tentativas/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
