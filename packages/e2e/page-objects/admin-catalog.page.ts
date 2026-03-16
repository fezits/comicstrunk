import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Catalog management page (/admin/catalog).
 *
 * Covers catalog entry CRUD, status filtering (Todos, Pendentes, Aprovados, Rejeitados),
 * entry approval/rejection, and CSV import/export.
 */
export class AdminCatalogPage extends BasePage {
  // --- Main layout locators ---

  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly entryList: Locator;
  readonly entryRows: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // --- Status filter tabs ---

  readonly tabAll: Locator;
  readonly tabPending: Locator;
  readonly tabApproved: Locator;
  readonly tabRejected: Locator;

  // --- Pagination ---

  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  // --- CSV ---

  readonly exportButton: Locator;
  readonly importButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /cat[aá]logo/i }).first();
    this.createButton = page.getByRole('link', { name: /novo|criar|adicionar/i }).or(
      page.getByRole('button', { name: /novo|criar|adicionar/i }),
    );
    this.searchInput = page.getByPlaceholder(/buscar/i);
    this.entryList = page.locator('table').first();
    this.entryRows = page.locator('table tbody tr');
    this.emptyState = page.getByText(/nenhum.*encontrad|lista vazia/i);
    this.loadingSpinner = page.locator('.animate-spin');

    // Status filter tabs
    this.tabAll = page.getByRole('tab', { name: /todos/i }).or(
      page.getByRole('button', { name: /todos/i }).first(),
    );
    this.tabPending = page.getByRole('tab', { name: /pendentes/i }).or(
      page.getByRole('button', { name: /pendentes/i }),
    );
    this.tabApproved = page.getByRole('tab', { name: /aprovados/i }).or(
      page.getByRole('button', { name: /aprovados/i }),
    );
    this.tabRejected = page.getByRole('tab', { name: /rejeitados/i }).or(
      page.getByRole('button', { name: /rejeitados/i }),
    );

    // Pagination
    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xima/i });
    this.pageInfo = page.getByText(/p[aá]gina\s+\d+\s+de\s+\d+/i);

    // CSV
    this.exportButton = page.getByRole('button', { name: /exportar/i });
    this.importButton = page.getByRole('button', { name: /importar/i });
  }

  // --- Navigation ---

  /** Navigate to /admin/catalog */
  async navigate(): Promise<void> {
    await this.goto('/admin/catalog');
  }

  /** Navigate to /admin/catalog/new to create a new entry */
  async navigateToCreate(): Promise<void> {
    await this.goto('/admin/catalog/new');
  }

  /** Navigate to /admin/content for taxonomy management */
  async navigateToContent(): Promise<void> {
    await this.goto('/admin/content');
  }

  /** Wait for the entry list to finish loading */
  async waitForResults(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('table, .grid, [class*="list"], [class*="empty"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  // --- Entry count ---

  /** Get the number of entry rows currently visible */
  async getEntryCount(): Promise<number> {
    return this.entryRows.count();
  }

  /** Assert the list has at least one entry */
  async expectHasEntries(): Promise<void> {
    const count = await this.getEntryCount();
    expect(count).toBeGreaterThan(0);
  }

  // --- Status tab filtering ---

  /** Click the "Todos" tab */
  async selectTabAll(): Promise<void> {
    await this.tabAll.click();
    await this.waitForResults();
  }

  /** Click the "Pendentes" tab */
  async selectTabPending(): Promise<void> {
    await this.tabPending.click();
    await this.waitForResults();
  }

  /** Click the "Aprovados" tab */
  async selectTabApproved(): Promise<void> {
    await this.tabApproved.click();
    await this.waitForResults();
  }

  /** Click the "Rejeitados" tab */
  async selectTabRejected(): Promise<void> {
    await this.tabRejected.click();
    await this.waitForResults();
  }

  // --- Create / Edit entry ---

  /**
   * Fill the catalog entry create/edit form.
   */
  async fillEntryForm(options: {
    title: string;
    publisher?: string;
    description?: string;
    coverImagePath?: string;
  }): Promise<void> {
    const titleInput = this.page.getByLabel(/t[ií]tulo/i);
    await titleInput.fill(options.title);

    if (options.publisher) {
      const publisherInput = this.page.getByLabel(/editora|publisher/i);
      await publisherInput.fill(options.publisher);
    }

    if (options.description) {
      const descriptionInput = this.page.getByLabel(/descri[cç][aã]o/i).or(
        this.page.locator('textarea').first(),
      );
      await descriptionInput.fill(options.description);
    }

    if (options.coverImagePath) {
      const fileInput = this.page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(options.coverImagePath);
    }
  }

  /** Submit the create/edit form */
  async submitEntryForm(): Promise<void> {
    const submitButton = this.page
      .getByRole('button', { name: /salvar|criar|publicar|confirmar/i })
      .first();
    await submitButton.click();
  }

  /**
   * Click the edit button on an entry row.
   * @param index - zero-based index of the entry row
   */
  async clickEditEntry(index: number): Promise<void> {
    const row = this.entryRows.nth(index);
    const editButton = row.getByRole('button', { name: /editar/i }).or(
      row.getByRole('link', { name: /editar/i }),
    ).or(
      row.locator('[aria-label*="editar" i]'),
    );
    await editButton.click();
  }

  // --- Approve / Reject ---

  /**
   * Approve an entry by clicking its approve button.
   * @param index - zero-based index of the entry row
   */
  async approveEntry(index: number): Promise<void> {
    const row = this.entryRows.nth(index);
    const approveButton = row.getByRole('button', { name: /aprovar/i });
    await approveButton.click();
  }

  /**
   * Reject an entry by clicking its reject button and optionally providing a reason.
   * @param index - zero-based index of the entry row
   * @param reason - optional rejection reason
   */
  async rejectEntry(index: number, reason?: string): Promise<void> {
    const row = this.entryRows.nth(index);
    const rejectButton = row.getByRole('button', { name: /rejeitar/i });
    await rejectButton.click();

    // If a rejection reason dialog/modal appears, fill it
    if (reason) {
      const reasonInput = this.page.getByLabel(/motivo|raz[aã]o/i).or(
        this.page.locator('textarea').last(),
      );
      if (await reasonInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await reasonInput.fill(reason);
        // Confirm the rejection
        const confirmButton = this.page
          .getByRole('button', { name: /confirmar|rejeitar/i })
          .last();
        await confirmButton.click();
      }
    }
  }

  // --- Search ---

  /** Type a search term */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  // --- Pagination ---

  async goToNextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForResults();
  }

  async goToPrevPage(): Promise<void> {
    await this.prevPageButton.click();
    await this.waitForResults();
  }

  // --- CSV ---

  /** Click the export button */
  async clickExport(): Promise<void> {
    await this.exportButton.click();
  }

  /** Click import button and upload a CSV file */
  async importCSV(filePath: string): Promise<void> {
    await this.importButton.click();
    const fileInput = this.page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(filePath);
  }

  /** Submit the import (if there is a separate confirm button after file selection) */
  async confirmImport(): Promise<void> {
    const confirmButton = this.page
      .getByRole('button', { name: /enviar|importar|confirmar/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }

  // --- Assertions ---

  /** Assert the admin catalog page heading is visible */
  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Assert an entry has a specific status badge */
  async expectEntryStatus(index: number, status: string): Promise<void> {
    const row = this.entryRows.nth(index);
    await expect(row.getByText(new RegExp(status, 'i'))).toBeVisible();
  }

  /** Assert a toast notification for successful approval */
  async expectApprovalSuccess(): Promise<void> {
    await this.expectToast(/aprovad[oa]/i);
  }

  /** Assert a toast notification for successful rejection */
  async expectRejectionSuccess(): Promise<void> {
    await this.expectToast(/rejeitad[oa]/i);
  }

  /** Assert a toast notification for successful creation */
  async expectCreationSuccess(): Promise<void> {
    await this.expectToast(/criad[oa]|cadastrad[oa]|salv[oa]/i);
  }

  /** Assert a toast notification for successful update */
  async expectUpdateSuccess(): Promise<void> {
    await this.expectToast(/atualizad[oa]|salv[oa]/i);
  }

  /** Assert validation errors are shown */
  async expectValidationErrors(): Promise<void> {
    const errors = this.page.locator('[class*="error"], [class*="destructive"], [role="alert"]');
    await expect(errors.first()).toBeVisible({ timeout: 5_000 });
  }

  /** Assert import success message */
  async expectImportSuccess(): Promise<void> {
    await this.expectToast(/importa[cç][aã]o.*sucesso|importad[oa]/i);
  }

  /** Assert import error report is shown */
  async expectImportErrors(): Promise<void> {
    await expect(
      this.page.getByText(/erro.*importa[cç][aã]o|falha|inv[aá]lid/i),
    ).toBeVisible({ timeout: 5_000 });
  }
}
