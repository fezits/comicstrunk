import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Deals management page (/admin/deals).
 *
 * Covers three tabs: Lojas Parceiras (partner stores), Ofertas (deals),
 * and Analytics. Supports CRUD for stores and deals, and analytics viewing.
 */
export class AdminDealsPage extends BasePage {
  // --- Tabs ---

  readonly tabStores: Locator;
  readonly tabDeals: Locator;
  readonly tabAnalytics: Locator;

  // --- Stores tab ---

  readonly createStoreButton: Locator;
  readonly storeTable: Locator;
  readonly storeRows: Locator;

  // --- Deals tab ---

  readonly createDealButton: Locator;
  readonly dealsTable: Locator;
  readonly dealRows: Locator;

  // --- Analytics tab ---

  readonly analyticsTotalClicks: Locator;
  readonly analyticsUniqueUsers: Locator;
  readonly dateRangeFilter: Locator;
  readonly csvExportButton: Locator;

  // --- Dialogs ---

  readonly storeFormDialog: Locator;
  readonly dealFormDialog: Locator;

  readonly heading: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole('heading', { level: 1 });
    this.loadingSpinner = page.locator('.animate-spin');

    // Tabs
    this.tabStores = page.getByRole('tab', { name: /lojas? parceiras?/i }).or(
      page.getByRole('button', { name: /lojas? parceiras?/i }),
    );
    this.tabDeals = page.getByRole('tab', { name: /ofertas/i }).or(
      page.getByRole('button', { name: /ofertas/i }),
    );
    this.tabAnalytics = page.getByRole('tab', { name: /analytics|an[aá]lise/i }).or(
      page.getByRole('button', { name: /analytics|an[aá]lise/i }),
    );

    // Stores tab
    this.createStoreButton = page.getByRole('button', { name: /nov[oa]|criar|adicionar/i });
    this.storeTable = page.locator('table').first();
    this.storeRows = page.locator('table tbody tr');

    // Deals tab
    this.createDealButton = page.getByRole('button', { name: /nov[oa]|criar|adicionar/i });
    this.dealsTable = page.locator('table').first();
    this.dealRows = page.locator('table tbody tr');

    // Analytics tab
    this.analyticsTotalClicks = page.getByText(/total.*cliques?|cliques? totais?/i).first();
    this.analyticsUniqueUsers = page.getByText(/usu[aá]rios? [uú]nicos?/i).first();
    this.dateRangeFilter = page.getByRole('button', { name: /per[ií]odo|data|filtrar/i });
    this.csvExportButton = page.getByRole('button', { name: /exportar.*csv|csv/i });

    // Dialogs
    this.storeFormDialog = page.locator('[role="dialog"]').filter({
      hasText: /loja/i,
    });
    this.dealFormDialog = page.locator('[role="dialog"]').filter({
      hasText: /oferta/i,
    });
  }

  // --- Navigation ---

  /** Navigate to /admin/deals */
  async navigate(): Promise<void> {
    await this.goto('/admin/deals');
  }

  /** Switch to the Lojas Parceiras tab */
  async switchToStoresTab(): Promise<void> {
    await this.tabStores.click();
    await this.waitForLoaded();
  }

  /** Switch to the Ofertas tab */
  async switchToDealsTab(): Promise<void> {
    await this.tabDeals.click();
    await this.waitForLoaded();
  }

  /** Switch to the Analytics tab */
  async switchToAnalyticsTab(): Promise<void> {
    await this.tabAnalytics.click();
    await this.waitForLoaded();
  }

  // --- Store CRUD ---

  /**
   * Create a new partner store via the store form dialog.
   * @param data - Store form fields
   */
  async createStore(data: {
    name: string;
    url: string;
    logoUrl?: string;
    description?: string;
  }): Promise<void> {
    await this.createStoreButton.click();
    await expect(this.storeFormDialog).toBeVisible({ timeout: 5_000 });

    const nameInput = this.storeFormDialog.getByLabel(/nome/i);
    await nameInput.fill(data.name);

    const urlInput = this.storeFormDialog.getByLabel(/url|link|endere[cç]o/i);
    await urlInput.fill(data.url);

    if (data.logoUrl) {
      const logoInput = this.storeFormDialog.getByLabel(/logo/i);
      await logoInput.fill(data.logoUrl);
    }

    if (data.description) {
      const descInput = this.storeFormDialog.getByLabel(/descri[cç][aã]o/i).or(
        this.storeFormDialog.locator('textarea').first(),
      );
      await descInput.fill(data.description);
    }

    const submitButton = this.storeFormDialog.getByRole('button', { name: /salvar|criar|confirmar/i });
    await submitButton.click();
  }

  /**
   * Click the edit button on a store row.
   * @param index - zero-based index of the store row
   */
  async editStore(index: number): Promise<void> {
    const row = this.storeRows.nth(index);
    const editButton = row.getByRole('button', { name: /editar/i }).or(
      row.locator('[aria-label*="editar" i]'),
    );
    await editButton.click();
  }

  /**
   * Click the delete button on a store row and confirm.
   * @param index - zero-based index of the store row
   */
  async deleteStore(index: number): Promise<void> {
    const row = this.storeRows.nth(index);
    const deleteButton = row.getByRole('button', { name: /excluir|remover|deletar/i }).or(
      row.locator('[aria-label*="excluir" i], [aria-label*="remover" i]'),
    );
    await deleteButton.click();

    // Confirm deletion dialog
    const confirmButton = this.page
      .getByRole('button', { name: /confirmar|sim|excluir/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }

  /** Get the count of visible store rows */
  async getStoreRows(): Promise<number> {
    return this.storeRows.count();
  }

  // --- Deal CRUD ---

  /**
   * Create a new deal via the deal form dialog.
   * @param data - Deal form fields
   */
  async createDeal(data: {
    title: string;
    storeId?: string;
    type?: string;
    couponCode?: string;
    url: string;
    description?: string;
  }): Promise<void> {
    await this.createDealButton.click();
    await expect(this.dealFormDialog).toBeVisible({ timeout: 5_000 });

    const titleInput = this.dealFormDialog.getByLabel(/t[ií]tulo/i);
    await titleInput.fill(data.title);

    const urlInput = this.dealFormDialog.getByLabel(/url|link/i);
    await urlInput.fill(data.url);

    if (data.storeId) {
      const storeSelect = this.dealFormDialog.getByRole('combobox', { name: /loja/i }).or(
        this.dealFormDialog.getByLabel(/loja/i),
      );
      await storeSelect.click();
      await this.page.getByRole('option', { name: new RegExp(data.storeId, 'i') }).click();
    }

    if (data.type) {
      const typeSelect = this.dealFormDialog.getByRole('combobox', { name: /tipo/i }).or(
        this.dealFormDialog.getByLabel(/tipo/i),
      );
      await typeSelect.click();
      await this.page.getByRole('option', { name: new RegExp(data.type, 'i') }).click();
    }

    if (data.couponCode) {
      const couponInput = this.dealFormDialog.getByLabel(/cupom|c[oó]digo/i);
      await couponInput.fill(data.couponCode);
    }

    if (data.description) {
      const descInput = this.dealFormDialog.getByLabel(/descri[cç][aã]o/i).or(
        this.dealFormDialog.locator('textarea').first(),
      );
      await descInput.fill(data.description);
    }

    const submitButton = this.dealFormDialog.getByRole('button', { name: /salvar|criar|confirmar/i });
    await submitButton.click();
  }

  /**
   * Click the edit button on a deal row.
   * @param index - zero-based index of the deal row
   */
  async editDeal(index: number): Promise<void> {
    const row = this.dealRows.nth(index);
    const editButton = row.getByRole('button', { name: /editar/i }).or(
      row.locator('[aria-label*="editar" i]'),
    );
    await editButton.click();
  }

  /**
   * Click the delete button on a deal row and confirm.
   * @param index - zero-based index of the deal row
   */
  async deleteDeal(index: number): Promise<void> {
    const row = this.dealRows.nth(index);
    const deleteButton = row.getByRole('button', { name: /excluir|remover|deletar/i }).or(
      row.locator('[aria-label*="excluir" i], [aria-label*="remover" i]'),
    );
    await deleteButton.click();

    // Confirm deletion dialog
    const confirmButton = this.page
      .getByRole('button', { name: /confirmar|sim|excluir/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }

  /** Get the count of visible deal rows */
  async getDealRows(): Promise<number> {
    return this.dealRows.count();
  }

  // --- Analytics ---

  /** Get the total clicks metric value */
  async getAnalyticsTotalClicks(): Promise<string> {
    return (await this.analyticsTotalClicks.textContent()) ?? '';
  }

  /** Click the CSV export button */
  async exportCSV(): Promise<void> {
    await this.csvExportButton.click();
  }
}
