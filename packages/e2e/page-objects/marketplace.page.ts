import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class MarketplacePage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly conditionFilter: Locator;
  readonly minPriceInput: Locator;
  readonly maxPriceInput: Locator;
  readonly sortButton: Locator;
  readonly noResults: Locator;
  readonly clearFiltersButton: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly loadingSpinner: Locator;
  readonly itemCount: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    // Search input placeholder: "Buscar itens a venda..."
    this.searchInput = page.getByPlaceholder(/buscar itens|buscar no marketplace/i).or(
      page.getByPlaceholder(/buscar/i),
    );
    // Condition filter is inside the filter panel (a Select combobox)
    this.conditionFilter = page.locator('button[role="combobox"]').first();
    // Price inputs use number type with placeholders "R$ 0,00" and "R$ 999,99"
    this.minPriceInput = page.locator('input[type="number"]').first();
    this.maxPriceInput = page.locator('input[type="number"]').nth(1);
    // Sort dropdown trigger: "Ordenar por: ..." button
    this.sortButton = page.getByRole('button', { name: /ordenar/i });
    // No results: "Nenhum item a venda encontrado"
    this.noResults = page.getByText(/nenhum item.*venda|nenhum.*encontrado/i);
    this.clearFiltersButton = page.getByRole('button', { name: /limpar/i }).first();
    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xim/i });
    this.loadingSpinner = page.locator('.animate-spin');
    this.itemCount = page.getByText(/\d+\s*(an[uú]ncios?|itens?|resultados?)/i);
  }

  /** Navigate to the public marketplace page */
  async navigate(): Promise<void> {
    await this.goto('/marketplace');
  }

  /** Wait for marketplace data to finish loading */
  async waitForResults(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('.grid, [class*="text-center"], [data-testid="marketplace-list"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Type a search term into the search input */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  /** Get all visible listing cards (each card is a div with h3 inside) */
  getListingCards(): Locator {
    return this.page.locator(
      '.grid > div.group, .grid > div:has(h3), [data-testid="listing-card"]',
    );
  }

  /** Get the count of visible listing cards */
  async getCardCount(): Promise<number> {
    return this.getListingCards().count();
  }

  /** Get all visible card titles */
  async getCardTitles(): Promise<string[]> {
    const titles = this.page.locator('.grid h3');
    return titles.allTextContents();
  }

  /** Click on a listing card by its index (0-based) */
  async clickCard(index: number): Promise<void> {
    // Click the Link inside the card to navigate to the detail page
    const cards = this.getListingCards();
    const card = cards.nth(index);
    const link = card.locator('a').first();
    await link.click();
  }

  /** Assert that the marketplace has at least one listing displayed */
  async expectHasResults(): Promise<void> {
    const count = await this.getCardCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert no results are shown */
  async expectNoResults(): Promise<void> {
    await expect(this.noResults).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Open the filter panel if not already open.
   * The filter panel is a collapsible section toggled by a "Filtros" button.
   */
  async openFilters(): Promise<void> {
    const filterButton = this.page.getByRole('button', { name: /filtros/i }).first();
    // Check if filters panel is already visible by looking for condition Select
    const conditionVisible = await this.conditionFilter.isVisible().catch(() => false);
    if (!conditionVisible) {
      await filterButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  /** Select a condition from the filter Select dropdown */
  async filterByCondition(condition: string): Promise<void> {
    await this.openFilters();
    await this.conditionFilter.click();
    await this.page.getByRole('option', { name: new RegExp(condition, 'i') }).click();
    await this.waitForResults();
  }

  /** Set price range filters (requires filter panel to be open) */
  async filterByPriceRange(min?: number, max?: number): Promise<void> {
    await this.openFilters();
    if (min !== undefined) {
      await this.minPriceInput.fill(String(min));
    }
    if (max !== undefined) {
      await this.maxPriceInput.fill(String(max));
    }
    // Wait for debounced filter to trigger
    await this.page.waitForTimeout(600);
    await this.waitForResults();
  }

  /** Navigate to the next page of results */
  async goToNextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForResults();
  }

  /** Get the page info text */
  async getPageInfo(): Promise<string | null> {
    const pageInfo = this.page.getByText(/p[aá]gina\s+\d+\s+de\s+\d+/i);
    if (await pageInfo.isVisible()) {
      return pageInfo.textContent();
    }
    return null;
  }

  /** Get the total count from the listing count text */
  async getTotalCount(): Promise<number> {
    const text = await this.itemCount.first().textContent().catch(() => null);
    if (!text) return 0;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
