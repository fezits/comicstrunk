import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin LGPD Requests management page (/admin/lgpd).
 *
 * Real UI structure (admin-lgpd-requests.tsx):
 * - Status filter Select (Todos, Pendente, Processando, Concluida, Rejeitada)
 * - NO type filter
 * - Table columns: Usuario, Tipo, Status, Data, Acoes
 * - Action buttons per row:
 *   - "Processar" + "Rejeitar" for PENDING status
 *   - "Concluir" for PROCESSING status
 * - Reject Dialog with Textarea for reason
 * - Status badges: Pendente (yellow), Processando (blue), Concluida (green), Rejeitada (red)
 */
export class AdminLgpdPage extends BasePage {
  readonly heading: Locator;
  readonly statusFilter: Locator;
  readonly requestsTable: Locator;
  readonly requestRows: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  // --- Reject dialog ---

  readonly rejectDialog: Locator;
  readonly rejectReasonInput: Locator;
  readonly rejectConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    // Status filter is a Select combobox (only filter available)
    this.statusFilter = page.locator('button[role="combobox"]').first();
    this.requestsTable = page.locator('table').first();
    this.requestRows = page.locator('table tbody tr');
    this.loadingSpinner = page.locator('.animate-spin');
    this.emptyState = page.getByText(/nenhuma solicita[cç][aã]o|sem solicita[cç][oõ]es/i);

    // Reject dialog
    this.rejectDialog = page.locator('[role="dialog"]').filter({
      hasText: /rejeitar|motivo|recusar/i,
    });
    this.rejectReasonInput = this.rejectDialog.locator('textarea').first();
    this.rejectConfirmButton = this.rejectDialog.getByRole('button', {
      name: /confirmar|rejeitar|recusar/i,
    });
  }

  /** Navigate to /admin/lgpd */
  async navigate(): Promise<void> {
    await this.goto('/admin/lgpd');
  }

  /** Filter requests by status */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.waitForLoaded();
  }

  /** Get the request rows locator */
  getRequestRows(): Locator {
    return this.requestRows;
  }

  /**
   * Process a LGPD request by clicking the "Processar" button.
   * @param index - zero-based index of the request row
   */
  async processRequest(index: number): Promise<void> {
    const row = this.requestRows.nth(index);
    const processBtn = row.getByRole('button', { name: /Processar/i });
    await processBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Complete a LGPD request by clicking the "Concluir" button.
   * @param index - zero-based index of the request row
   */
  async completeRequest(index: number): Promise<void> {
    const row = this.requestRows.nth(index);
    const completeBtn = row.getByRole('button', { name: /Concluir/i });
    await completeBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Reject a LGPD request with a reason via the reject dialog.
   * @param index - zero-based index of the request row
   * @param reason - Rejection reason
   */
  async rejectRequest(index: number, reason: string): Promise<void> {
    const row = this.requestRows.nth(index);
    const rejectBtn = row.getByRole('button', { name: /Rejeitar/i });
    await rejectBtn.click();

    await expect(this.rejectDialog).toBeVisible({ timeout: 5_000 });
    await this.rejectReasonInput.fill(reason);
    await this.rejectConfirmButton.click();
    await this.page.waitForTimeout(500);
  }
}
