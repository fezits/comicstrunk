import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  // --- Locators ---

  /** Page heading "Entrar" (CardTitle renders as <div>, not <h>) */
  private get heading() {
    return this.page.locator('.gradient-text').filter({ hasText: 'Entrar' });
  }

  /** E-mail input field */
  private get emailInput() {
    return this.page.getByLabel('E-mail');
  }

  /** Senha (password) input field */
  private get passwordInput() {
    return this.page.getByLabel('Senha');
  }

  /** Submit button "Entrar" */
  private get submitButton() {
    return this.page.getByRole('button', { name: 'Entrar' });
  }

  /** Link to signup page "Criar conta" */
  private get signupLink() {
    return this.page.getByRole('link', { name: 'Criar conta' });
  }

  /** Link to forgot-password page "Esqueci minha senha" */
  private get forgotPasswordLink() {
    return this.page.getByRole('link', { name: 'Esqueci minha senha' });
  }

  // --- Actions ---

  constructor(page: Page) {
    super(page);
  }

  /** Navigate to /login */
  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  /** Fill email and password fields, then click submit */
  async fillAndSubmit(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Go to signup page via link */
  async goToSignup(): Promise<void> {
    await this.signupLink.click();
  }

  /** Go to forgot-password page via link */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  // --- Assertions ---

  /** Assert that the login page heading and form elements are visible */
  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /** Assert successful login — user is redirected away from /login (to / or /catalog) */
  async expectLoginSuccess(): Promise<void> {
    // After login, the app redirects to the home/catalog page
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/login'),
      { timeout: 10_000 },
    );
    const path = await this.currentPath();
    expect(path === '/' || path.startsWith('/catalog')).toBeTruthy();
  }

  /** Assert login error — toast with "Credenciais invalidas" (or custom message) is visible */
  async expectLoginError(message?: string | RegExp): Promise<void> {
    const text = message ?? /[Cc]redenciais inv[aá]lidas/;
    await this.expectToast(text);
  }
}
