import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Legal Documents management page (/admin/legal).
 *
 * Real UI structure (admin-legal-documents.tsx):
 * - Table grouped by type (latest version per type)
 * - Columns: Tipo, Versao, Data de Vigencia, Obrigatorio, Atualizado em, Acoes
 * - "Novo Documento" button to open create Dialog
 * - "Historico" button per row to view version history Dialog
 * - Mandatory shown as "Sim"/"Nao" badges
 * - NO type filter dropdown (no filtering at all in list view)
 * - Create dialog: type Select, content Textarea, date Input, mandatory Switch
 * - Document types: TERMS_OF_SERVICE, PRIVACY_POLICY, COOKIE_POLICY,
 *   MARKETPLACE_TERMS, RETURN_POLICY, SELLER_AGREEMENT, SUBSCRIPTION_TERMS, DATA_PROCESSING
 */
export class AdminLegalPage extends BasePage {
  readonly heading: Locator;
  readonly documentsTable: Locator;
  readonly documentRows: Locator;
  readonly createButton: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  // --- Create dialog ---

  readonly createDialog: Locator;
  readonly typeSelect: Locator;
  readonly contentTextarea: Locator;
  readonly dateInput: Locator;
  readonly mandatorySwitch: Locator;
  readonly formSubmitButton: Locator;

  // --- History dialog ---

  readonly historyDialog: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.documentsTable = page.locator('table').first();
    this.documentRows = page.locator('table tbody tr');
    this.createButton = page.getByRole('button', { name: /Novo Documento|novo|criar|adicionar/i });
    this.loadingSpinner = page.locator('.animate-spin');
    this.emptyState = page.getByText(/nenhum documento|sem documentos/i);

    // Create dialog (title: "Novo Documento Legal")
    this.createDialog = page.locator('[role="dialog"]').filter({
      hasText: /Novo Documento Legal/i,
    });
    this.typeSelect = this.createDialog.locator('button[role="combobox"]').first();
    this.contentTextarea = this.createDialog.locator('textarea').first();
    this.dateInput = this.createDialog.locator('input[type="date"]').first();
    // Mandatory uses Switch component, not checkbox
    this.mandatorySwitch = this.createDialog.locator('button[role="switch"]').first();
    this.formSubmitButton = this.createDialog.getByRole('button', {
      name: /Criar Documento|criar|salvar|confirmar/i,
    });

    // History dialog
    this.historyDialog = page.locator('[role="dialog"]').filter({
      hasText: /hist[oó]rico|vers[oõ]es/i,
    });
  }

  /** Navigate to /admin/legal */
  async navigate(): Promise<void> {
    await this.goto('/admin/legal');
  }

  /** Get the document rows locator */
  getDocumentRows(): Locator {
    return this.documentRows;
  }

  /**
   * Create a new legal document via the form dialog.
   * @param data - Document form fields
   */
  async createDocument(data: {
    type: string;
    content: string;
    effectiveDate?: string;
    mandatory?: boolean;
  }): Promise<void> {
    await this.createButton.click();
    await expect(this.createDialog).toBeVisible({ timeout: 5_000 });

    // Select type via combobox
    await this.typeSelect.click();
    await this.page.getByRole('option', { name: new RegExp(data.type, 'i') }).click();

    // Fill content
    await this.contentTextarea.fill(data.content);

    // Fill effective date
    if (data.effectiveDate) {
      await this.dateInput.fill(data.effectiveDate);
    }

    // Toggle mandatory switch (default is ON/true)
    if (data.mandatory !== undefined) {
      const isChecked = await this.mandatorySwitch.getAttribute('data-state') === 'checked';
      if (data.mandatory !== isChecked) {
        await this.mandatorySwitch.click();
      }
    }

    await this.formSubmitButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click the "Historico" button on a document row to view version history.
   * @param index - zero-based index of the document row
   */
  async viewHistory(index: number): Promise<void> {
    const row = this.documentRows.nth(index);
    const historyButton = row.getByRole('button', { name: /Hist[oó]rico/i });
    await historyButton.click();
    await expect(this.historyDialog).toBeVisible({ timeout: 5_000 });
  }

  /** Assert the documents table has at least one document */
  async expectHasDocuments(): Promise<void> {
    const count = await this.documentRows.count();
    expect(count).toBeGreaterThan(0);
  }
}
