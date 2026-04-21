import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the User LGPD (data protection) rights page (/lgpd).
 *
 * Covers rights cards (access, correction, portability, deletion),
 * data export, correction requests, account deletion, and request history.
 */
export class LgpdPage extends BasePage {
  readonly heading: Locator;
  readonly loadingSpinner: Locator;

  // --- Rights cards ---

  readonly accessRightCard: Locator;
  readonly correctionRightCard: Locator;
  readonly portabilityRightCard: Locator;
  readonly deletionRightCard: Locator;

  // --- Actions ---

  readonly exportDataButton: Locator;
  readonly correctionForm: Locator;
  readonly correctionDetailsTextarea: Locator;
  readonly correctionSubmitButton: Locator;
  readonly deletionButton: Locator;
  readonly confirmationDialog: Locator;
  readonly confirmDeletionButton: Locator;

  // --- Request history ---

  readonly requestHistory: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.loadingSpinner = page.locator('.animate-spin');

    // Rights cards
    this.accessRightCard = page.locator('[class*="card"]').filter({
      hasText: /acesso|acessar.*dados/i,
    });
    this.correctionRightCard = page.locator('[class*="card"]').filter({
      hasText: /corre[cç][aã]o|corrigir.*dados/i,
    });
    this.portabilityRightCard = page.locator('[class*="card"]').filter({
      hasText: /portabilidade|exportar.*dados/i,
    });
    this.deletionRightCard = page.locator('[class*="card"]').filter({
      hasText: /exclus[aã]o|elimina[cç][aã]o|apagar.*dados|excluir.*conta/i,
    });

    // Actions
    this.exportDataButton = page.getByRole('button', { name: /exportar.*dados|baixar.*dados|download/i });
    this.correctionForm = page.locator('[data-testid="correction-form"]').or(
      page.locator('form').filter({ hasText: /corre[cç][aã]o/i }),
    );
    this.correctionDetailsTextarea = page.getByLabel(/detalhes|descri[cç][aã]o|detalhe da corre[cç][aã]o/i).or(
      page.locator('textarea').first(),
    );
    this.correctionSubmitButton = page.getByRole('button', { name: /enviar.*solicita[cç][aã]o|solicitar.*corre[cç][aã]o/i });
    this.deletionButton = page.getByRole('button', { name: /excluir.*conta|solicitar.*exclus[aã]o|apagar.*conta/i });
    this.confirmationDialog = page.locator('[role="dialog"]').filter({
      hasText: /confirmar|certeza|exclus[aã]o/i,
    });
    this.confirmDeletionButton = this.confirmationDialog.getByRole('button', {
      name: /confirmar|sim.*excluir|excluir/i,
    });

    // Request history
    this.requestHistory = page.locator(
      '[data-testid="request-history"], [class*="history"]',
    ).or(
      page.locator('section').filter({ hasText: /hist[oó]rico.*solicita[cç][oõ]es|solicita[cç][oõ]es? anteriores/i }),
    );
  }

  /** Navigate to /lgpd */
  async navigate(): Promise<void> {
    await this.goto('/lgpd');
  }

  /** Assert the LGPD page is loaded */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Click the export data button */
  async clickExportData(): Promise<void> {
    await this.exportDataButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Submit a data correction request.
   * @param details - Description of the correction needed
   */
  async submitCorrectionRequest(details: string): Promise<void> {
    await this.correctionDetailsTextarea.fill(details);
    await this.correctionSubmitButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Initiate account deletion by clicking the deletion button */
  async initiateAccountDeletion(): Promise<void> {
    await this.deletionButton.click();
    await expect(this.confirmationDialog).toBeVisible({ timeout: 5_000 });
  }

  /** Confirm the account deletion in the confirmation dialog */
  async confirmDeletion(): Promise<void> {
    await this.confirmDeletionButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Get the request history list locator */
  getRequestHistory(): Locator {
    return this.requestHistory.locator(
      '[data-testid="request-item"], tr, [class*="item"], li',
    );
  }

  /** Assert all four rights cards are visible */
  async expectRightsCardsVisible(): Promise<void> {
    await expect(this.accessRightCard).toBeVisible({ timeout: 10_000 });
    await expect(this.correctionRightCard).toBeVisible();
    await expect(this.portabilityRightCard).toBeVisible();
    await expect(this.deletionRightCard).toBeVisible();
  }
}
