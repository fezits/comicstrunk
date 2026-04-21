import { test, expect } from '../../fixtures';
import { SignupPage } from '../../page-objects/signup.page';
import { HeaderComponent } from '../../page-objects/header.component';

const TEST_PREFIX = '_test_';

test.describe('Signup Flow', () => {
  let signupPage: SignupPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
    await signupPage.navigate();
  });

  test('should display signup page correctly', async ({ page }) => {
    await signupPage.expectPageVisible();

    // Verify placeholders
    await expect(page.getByPlaceholder('Seu nome completo')).toBeVisible();
    await expect(page.getByPlaceholder('email@exemplo.com')).toBeVisible();
    await expect(page.getByPlaceholder('********')).toBeVisible();

    // Verify terms checkbox label text
    await expect(
      page.getByText(/Aceito os Termos de Uso/i),
    ).toBeVisible();

    // Verify link to login page
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  });

  test('should signup with valid data and redirect', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueEmail = `${TEST_PREFIX}signup_${timestamp}@e2e-test.com`;
    const uniqueName = `${TEST_PREFIX}E2E Signup ${timestamp}`;

    await signupPage.fillAndSubmit(uniqueName, uniqueEmail, 'Test1234!Aa');

    // Should show success toast
    await signupPage.expectToast(/Conta criada com sucesso/i);

    // Should redirect away from signup
    await signupPage.expectSignupSuccess();

    // Header should show authenticated state (user is auto-logged-in after signup)
    const header = new HeaderComponent(page);
    await header.expectAuthenticated();
  });

  test('should show error for duplicate email', async ({ page }) => {
    // user@test.com already exists in seed data
    await signupPage.fillAndSubmit(
      `${TEST_PREFIX}Duplicate User`,
      'user@test.com',
      'Test1234!Aa',
    );

    // Should show "e-mail ja esta cadastrado" error
    await signupPage.expectSignupError(/e-mail j[aá] est[aá] cadastrado/i);

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should show password strength validation for weak password', async ({ page }) => {
    await page.getByLabel('Nome completo').fill(`${TEST_PREFIX}Weak Pass`);
    await page.getByLabel('E-mail').fill(`${TEST_PREFIX}weak_${Date.now()}@e2e-test.com`);

    // Type a weak password (too short, no special chars)
    await page.getByLabel('Senha').fill('abc');

    // Password requirements should be shown in real-time
    // The UI typically shows requirement indicators (red/green) below the password field
    // Try to submit - it should not go through
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // Should stay on signup page since password is too weak
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should not submit when terms are not accepted', async ({ page }) => {
    const timestamp = Date.now();

    await page.getByLabel('Nome completo').fill(`${TEST_PREFIX}No Terms ${timestamp}`);
    await page.getByLabel('E-mail').fill(`${TEST_PREFIX}noterms_${timestamp}@e2e-test.com`);
    await page.getByLabel('Senha').fill('Test1234!Aa');

    // Explicitly do NOT check the terms checkbox
    // Submit the form
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // Should stay on signup page (form validation prevents submission)
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should show validation for empty fields', async ({ page }) => {
    // Click submit without filling any fields
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // Should stay on signup page (client-side validation blocks submission)
    await expect(page).toHaveURL(/\/signup/);

    // Fill only the name and try again
    await page.getByLabel('Nome completo').fill(`${TEST_PREFIX}Partial`);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should navigate to login page', async ({ page }) => {
    await signupPage.goToLogin();
    await page.waitForURL('**/pt-BR/login');
    await expect(page.locator('.gradient-text').filter({ hasText: 'Entrar' })).toBeVisible();
  });
});
