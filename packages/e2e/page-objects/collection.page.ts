import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Collection page (/collection).
 *
 * Covers the authenticated user's comic book collection management,
 * including listing, filtering, adding, editing, removing items,
 * and marking items as read or for sale.
 */
export class CollectionPage extends BasePage {
  // --- Main layout locators ---

  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly addButton: Locator;
  readonly exportButton: Locator;
  readonly importButton: Locator;
  readonly itemCards: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // --- Pagination ---

  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /Minha Cole[cç][aã]o/i });
    this.searchInput = page.getByPlaceholder(/buscar/i);
    this.addButton = page.getByRole('link', { name: /adicionar/i }).or(
      page.getByRole('button', { name: /adicionar/i }),
    );
    this.exportButton = page.getByRole('button', { name: /exportar/i });
    // Import is a link navigating to /collection/add?mode=import
    this.importButton = page.getByRole('link', { name: /importar/i }).or(
      page.getByRole('button', { name: /importar/i }),
    );
    // Collection items are Card components containing h3 titles
    this.itemCards = page.locator('[data-testid="collection-item"]').or(
      page.locator('.grid > div').filter({
        has: page.locator('h3'),
      }),
    );
    this.emptyState = page.getByText(
      /cole[cç][aã]o.*vazia|comece adicionando/i,
    );
    this.loadingSpinner = page.locator('.animate-spin');

    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xima/i });
    this.pageInfo = page.getByText(/p[aá]gina\s+\d+\s+de\s+\d+/i);
  }

  // --- Navigation ---

  /** Navigate to /collection */
  async navigate(): Promise<void> {
    await this.goto('/collection');
  }

  /** Navigate to /collection/add */
  async navigateToAdd(): Promise<void> {
    await this.goto('/collection/add');
  }

  /** Navigate to /collection/series-progress */
  async navigateToSeriesProgress(): Promise<void> {
    await this.goto('/collection/series-progress');
  }

  /** Wait for collection data to finish loading */
  async waitForResults(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('.grid, [class*="card"], [class*="empty"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  // --- Item count ---

  /** Get the number of collection item cards currently visible */
  async getItemCount(): Promise<number> {
    return this.itemCards.count();
  }

  /** Assert the collection has at least one item */
  async expectHasItems(): Promise<void> {
    const count = await this.getItemCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert the collection is empty */
  async expectEmpty(): Promise<void> {
    await expect(this.emptyState).toBeVisible({ timeout: 10_000 });
  }

  // --- Search ---

  /** Type a search term into the search input */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  // --- Filter actions ---

  /**
   * Filter by condition using the sidebar Select dropdown.
   * The condition filter is inside a Collapsible section titled "Condicao"
   * with a shadcn Select (trigger + portal options).
   */
  async filterByCondition(condition: string): Promise<void> {
    // The sidebar Select trigger is inside the "Condicao" collapsible section
    const conditionTrigger = this.page.locator('button[role="combobox"]').first();
    await conditionTrigger.click();
    await this.page.getByRole('option', { name: new RegExp(condition, 'i') }).click();
    await this.waitForResults();
  }

  /**
   * Toggle the read-status filter using sidebar Checkboxes.
   * Options: "Apenas lidos" or "Apenas nao lidos" as checkbox labels.
   */
  async filterByReadStatus(status: string): Promise<void> {
    const checkbox = this.page.getByLabel(new RegExp(status, 'i'));
    await checkbox.click();
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  /**
   * Toggle the for-sale filter using sidebar Checkboxes.
   * Options: "Apenas a venda" or "Apenas nao a venda" as checkbox labels.
   */
  async filterBySaleStatus(status: string): Promise<void> {
    const checkbox = this.page.getByLabel(new RegExp(status, 'i'));
    await checkbox.click();
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  // --- CRUD Actions ---

  /** Click the "Adicionar" button to go to add item page */
  async clickAdd(): Promise<void> {
    await this.addButton.click();
  }

  /**
   * Add a new item to the collection via the add form.
   * Assumes user is on /collection/add page.
   *
   * The add form has two phases:
   * 1. Search for a catalog entry and click the card to select it
   * 2. Fill quantity, condition, price in the form that appears
   */
  async fillAddForm(options: {
    catalogTitle: string;
    quantity?: number;
    condition?: string;
    price?: number;
  }): Promise<void> {
    // Phase 1: Search for the catalog entry
    // The search input placeholder is the translation of "searchCatalogPlaceholder"
    // which is "Digite o titulo do quadrinho..."
    const catalogSearch = this.page.getByPlaceholder(/titulo.*quadrinho|buscar.*cat[aá]logo/i).or(
      this.page.locator('input[type="text"]').first(),
    );
    await catalogSearch.fill(options.catalogTitle);
    await this.page.waitForTimeout(800);

    // Select the first matching result card (cards contain h3 with the title)
    const resultCard = this.page
      .locator('.grid .cursor-pointer, .grid [class*="card"]')
      .filter({ hasText: new RegExp(options.catalogTitle.slice(0, 10), 'i') })
      .first();
    await resultCard.click();
    await this.page.waitForTimeout(300);

    // Phase 2: Fill the collection form fields
    // Set quantity (input type="number" with Label "Quantidade")
    if (options.quantity !== undefined) {
      const quantityInput = this.page.locator('input[type="number"]').first();
      await quantityInput.fill(String(options.quantity));
    }

    // Set condition using the shadcn Select (trigger button + portal options)
    if (options.condition) {
      const conditionSelect = this.page.locator('button[role="combobox"]').first();
      await conditionSelect.click();
      await this.page
        .getByRole('option', { name: new RegExp(options.condition, 'i') })
        .click();
    }

    // Set price paid (second number input)
    if (options.price !== undefined) {
      const priceInput = this.page.locator('input[type="number"]').nth(1);
      await priceInput.fill(String(options.price));
    }
  }

  /** Submit the add/edit collection item form */
  async submitForm(): Promise<void> {
    const submitButton = this.page
      .getByRole('button', { name: /adicionar item|salvar|confirmar/i })
      .first();
    await submitButton.click();
  }

  /**
   * Edit a collection item by clicking its edit button.
   * @param index - zero-based index of the item card
   */
  async clickEditItem(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const editButton = card.getByRole('button', { name: /editar/i }).or(
      card.locator('[aria-label*="editar" i], [title*="editar" i], button:has(svg)').first(),
    );
    await editButton.click();
  }

  /**
   * Remove a collection item by clicking its remove/delete button.
   * @param index - zero-based index of the item card
   */
  async clickRemoveItem(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const removeButton = card.getByRole('button', { name: /remover|excluir|deletar/i }).or(
      card.locator('[aria-label*="remover" i], [aria-label*="excluir" i]'),
    );
    await removeButton.click();
  }

  /** Confirm a removal dialog */
  async confirmRemoval(): Promise<void> {
    const confirmButton = this.page
      .getByRole('button', { name: /confirmar|sim|excluir|remover/i })
      .last();
    await confirmButton.click();
  }

  // --- Read / For-Sale toggles ---

  /**
   * Mark an item as read.
   * Button text: "Marcar lido" (when item is unread)
   * @param index - zero-based index of the item card
   */
  async markAsRead(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const readButton = card.getByRole('button', { name: /marcar lido/i });
    await readButton.click();
  }

  /**
   * Unmark an item as read.
   * Button text: "Marcar nao lido" (when item is read)
   * @param index - zero-based index of the item card
   */
  async unmarkAsRead(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const unreadButton = card.getByRole('button', { name: /marcar n[aã]o lido/i });
    await unreadButton.click();
  }

  /**
   * Mark an item for sale.
   * Button text: "Colocar a venda" (when item is not for sale)
   * @param index - zero-based index of the item card
   */
  async markForSale(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const saleButton = card.getByRole('button', { name: /colocar a venda/i });
    await saleButton.click();
  }

  /**
   * Unmark an item from sale.
   * Button text: "Remover venda" (when item is for sale)
   * @param index - zero-based index of the item card
   */
  async unmarkForSale(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    const unsaleButton = card.getByRole('button', { name: /remover venda/i });
    await unsaleButton.click();
  }

  /**
   * Upload a photo for a collection item.
   * @param index - zero-based index of the item card
   * @param imagePath - absolute path to the image file
   */
  async uploadPhoto(index: number, imagePath: string): Promise<void> {
    const card = this.itemCards.nth(index);
    const uploadButton = card.getByRole('button', { name: /foto|imagem|upload/i }).or(
      card.locator('input[type="file"]'),
    );

    // If there is a file input, set it directly
    const fileInput = card.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(imagePath);
    } else {
      // Click the upload button which should trigger a file input
      await uploadButton.click();
      const globalFileInput = this.page.locator('input[type="file"]').last();
      await globalFileInput.setInputFiles(imagePath);
    }
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

  async getPageInfoText(): Promise<string | null> {
    if (await this.pageInfo.isVisible()) {
      return this.pageInfo.textContent();
    }
    return null;
  }

  // --- CSV Import/Export ---

  /** Click the export button */
  async clickExport(): Promise<void> {
    await this.exportButton.click();
  }

  /**
   * Navigate to import page and upload a CSV file.
   * The import button is a link to /collection/add?mode=import.
   * The import page has a file input and an "Importar" button.
   */
  async importCSV(filePath: string): Promise<void> {
    await this.importButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  // --- Assertions ---

  /** Assert the collection page heading is visible */
  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Assert that the commission preview is visible when marking for sale */
  async expectCommissionPreview(): Promise<void> {
    await expect(
      this.page.getByText(/voc[eê] receber[aá]/i),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Assert reading date is shown on an item */
  async expectReadingDate(index: number): Promise<void> {
    const card = this.itemCards.nth(index);
    await expect(
      card.getByText(/lido em|data.*leitura/i),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Assert an upgrade message is visible (for plan limits) */
  async expectUpgradeMessage(): Promise<void> {
    await expect(
      this.page.getByText(/limite.*atingido|fa[cç]a upgrade|plano/i),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Assert the upgrade message links to /subscription */
  async expectUpgradeLinkToSubscription(): Promise<void> {
    const link = this.page.getByRole('link', { name: /upgrade|assinar|plano/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /subscription/);
  }
}
