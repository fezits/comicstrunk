import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CatalogPage extends BasePage {
  readonly heading: Locator;
  readonly comicCount: Locator;
  readonly searchInput: Locator;
  readonly gridButton: Locator;
  readonly listButton: Locator;
  readonly filtersButton: Locator;
  readonly sortButton: Locator;
  readonly noResults: Locator;
  readonly clearFiltersButton: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly loadingSpinner: Locator;
  readonly filterPanel: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.comicCount = page.getByText(/\d+\s*quadrinhos/i);
    this.searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
    this.gridButton = page.getByTitle(/cards/i);
    this.listButton = page.getByTitle(/lista/i);
    // Desktop filter toggle button (hidden on mobile, uses sm:flex)
    this.filtersButton = page.getByRole('button', { name: /filtros/i }).first();
    this.sortButton = page.getByRole('button', { name: /ordenar por/i });
    this.noResults = page.getByText(/nenhum resultado encontrado/i);
    this.clearFiltersButton = page.getByRole('button', { name: /limpar filtros/i }).first();
    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xima/i });
    this.loadingSpinner = page.locator('.animate-spin');
    this.filterPanel = page.locator('.animate-in.slide-in-from-top-2');
  }

  /** Navigate to the public catalog page */
  async navigate(): Promise<void> {
    await this.goto('/catalog');
  }

  /** Wait for the catalog data to finish loading */
  async waitForResults(): Promise<void> {
    await this.waitForLoaded();
    // Also ensure either results or the no-results state is visible
    await this.page
      .locator('.grid, [class*="text-center"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Type a search term into the search input (triggers debounced search) */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // Wait for debounce (400ms in the catalog page)
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  /** Get the number of catalog cards currently visible in grid view */
  async getCardCount(): Promise<number> {
    // Cards are rendered as <a> link blocks containing the card component
    const cards = this.page.locator(
      '.grid .block.group',
    );
    return cards.count();
  }

  /** Get the number of list items currently visible in list view */
  async getListItemCount(): Promise<number> {
    const items = this.page.locator(
      '.grid .block.group',
    );
    return items.count();
  }

  /** Assert that the catalog has at least one result displayed */
  async expectHasResults(): Promise<void> {
    const count = await this.getCardCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert no results are shown */
  async expectNoResults(): Promise<void> {
    await expect(this.noResults).toBeVisible();
  }

  /** Click the filters toggle button to open/close the filter panel */
  async toggleFilters(): Promise<void> {
    await this.filtersButton.click();
  }

  /** Open the sort dropdown and select a sort option by its label text */
  async selectSort(label: string): Promise<void> {
    await this.sortButton.click();
    await this.page.getByRole('menuitem', { name: new RegExp(label, 'i') }).click();
    await this.waitForResults();
  }

  /** Switch to grid (cards) view */
  async switchToGrid(): Promise<void> {
    await this.gridButton.click();
  }

  /** Switch to list view */
  async switchToList(): Promise<void> {
    await this.listButton.click();
  }

  /** Navigate to the next page of results */
  async goToNextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForResults();
  }

  /** Navigate to the previous page of results */
  async goToPrevPage(): Promise<void> {
    await this.prevPageButton.click();
    await this.waitForResults();
  }

  /** Get the current page info text, e.g. "Pagina 1 de 2" */
  async getPageInfo(): Promise<string | null> {
    const pageInfo = this.page.getByText(/p[aá]gina\s+\d+\s+de\s+\d+/i);
    if (await pageInfo.isVisible()) {
      return pageInfo.textContent();
    }
    return null;
  }

  /** Clear all active filters using the "Limpar filtros" button */
  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
    await this.waitForResults();
  }

  /** Click on a catalog card by its index (0-based) to navigate to detail */
  async clickCard(index: number): Promise<void> {
    const cards = this.page.locator('.grid .block.group');
    await cards.nth(index).click();
  }

  /** Get all visible card titles */
  async getCardTitles(): Promise<string[]> {
    const titles = this.page.locator('.grid .block.group h3');
    return titles.allTextContents();
  }

  /** Get the total comic count from the "X quadrinhos" text */
  async getTotalCount(): Promise<number> {
    const text = await this.comicCount.first().textContent();
    if (!text) return 0;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
