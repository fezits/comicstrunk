import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class SignupPage extends BasePage {
  // --- Locators ---

  /** Page heading "Criar conta" (CardTitle renders as <div>, not <h>) */
  private get heading() {
    return this.page.locator('.gradient-text').filter({ hasText: 'Criar conta' });
  }

  /** Nome completo input field */
  private get nameInput() {
    return this.page.getByLabel('Nome completo');
  }

  /** E-mail input field */
  private get emailInput() {
    return this.page.getByLabel('E-mail');
  }

  /** Senha (password) input field */
  private get passwordInput() {
    return this.page.getByLabel('Senha');
  }

  /** Terms acceptance checkbox (label: "Aceito os Termos de Uso e Politica de Privacidade") */
  private get termsCheckbox() {
    return this.page.getByRole('checkbox');
  }

  /** Submit button "Criar conta" */
  private get submitButton() {
    return this.page.getByRole('button', { name: 'Criar conta' });
  }

  /** Link to login page "Entrar" in the "Ja tem uma conta?" text */
  private get loginLink() {
    return this.page.getByRole('link', { name: 'Entrar' });
  }

  // --- Actions ---

  constructor(page: Page) {
    super(page);
  }

  /** Navigate to /signup */
  async navigate(): Promise<void> {
    await this.goto('/signup');
  }

  /**
   * Fill signup form fields and submit.
   * @param name       - User's full name
   * @param email      - User's email
   * @param password   - User's password
   * @param acceptTerms - Whether to check the terms checkbox (default: true)
   */
  async fillAndSubmit(
    name: string,
    email: string,
    password: string,
    acceptTerms = true,
  ): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    if (acceptTerms) {
      await this.termsCheckbox.check();
    }

    await this.submitButton.click();
  }

  /** Go to login page via link */
  async goToLogin(): Promise<void> {
    await this.loginLink.click();
  }

  // --- Assertions ---

  /** Assert that the signup page heading and form elements are visible */
  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.termsCheckbox).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /** Assert successful signup — user is redirected away from /signup (to / or /catalog) */
  async expectSignupSuccess(): Promise<void> {
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/signup'),
      { timeout: 10_000 },
    );
    const path = await this.currentPath();
    expect(path === '/' || path.startsWith('/catalog')).toBeTruthy();
  }

  /** Assert signup error — toast with error message is visible */
  async expectSignupError(message?: string | RegExp): Promise<void> {
    const text = message ?? /[Ee](-?)mail j[aá] est[aá] cadastrado|[Ee]rro/;
    await this.expectToast(text);
  }
}
