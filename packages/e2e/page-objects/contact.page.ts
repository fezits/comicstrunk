import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the public Contact form page (/contact).
 *
 * Covers the contact form with fields for name, email, category,
 * subject, and message, along with validation and success states.
 */
export class ContactPage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly categorySelect: Locator;
  readonly subjectInput: Locator;
  readonly messageTextarea: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly formErrors: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.nameInput = page.getByLabel(/nome/i);
    this.emailInput = page.getByLabel(/e-?mail/i);
    this.categorySelect = page.getByRole('combobox', { name: /categoria|assunto|motivo/i }).or(
      page.getByLabel(/categoria|assunto|motivo/i),
    );
    this.subjectInput = page.getByLabel(/assunto|t[ií]tulo/i).or(
      page.getByPlaceholder(/assunto/i),
    );
    this.messageTextarea = page.getByLabel(/mensagem/i).or(
      page.locator('textarea').first(),
    );
    this.submitButton = page.getByRole('button', { name: /enviar/i });
    this.successMessage = page.getByText(
      /mensagem enviada|sucesso|recebemos sua mensagem|entraremos em contato/i,
    );
    this.formErrors = page.locator(
      '[class*="error"], [class*="destructive"], [role="alert"]',
    );
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate to /contact */
  async navigate(): Promise<void> {
    await this.goto('/contact');
  }

  /**
   * Fill the contact form with the provided data.
   * @param data - Form field values
   */
  async fillForm(data: {
    name: string;
    email: string;
    category: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);

    // Select category
    await this.categorySelect.click();
    await this.page.getByRole('option', { name: new RegExp(data.category, 'i') }).click();

    await this.subjectInput.fill(data.subject);
    await this.messageTextarea.fill(data.message);
  }

  /** Submit the contact form */
  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Assert the success message is visible */
  async expectSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Assert a validation error is shown for a specific field.
   * @param field - The field name or pattern to match in the error message
   */
  async expectValidationError(field: string): Promise<void> {
    const errorPattern = new RegExp(field, 'i');
    await expect(
      this.page.locator('[class*="error"], [class*="destructive"], [role="alert"]').filter({
        hasText: errorPattern,
      }).first().or(
        this.formErrors.first(),
      ),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Assert the contact form is visible with all fields */
  async expectFormVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.messageTextarea).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
