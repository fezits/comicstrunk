import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the public Deals browse page (/deals).
 *
 * Covers browsing affiliate deals, filtering by store/type/category,
 * searching, copying coupon codes, and verifying affiliate disclosure.
 */
export class DealsPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly storeFilter: Locator;
  readonly categoryFilter: Locator;
  readonly typeFilter: Locator;
  readonly sortDropdown: Locator;
  readonly dealCardsGrid: Locator;
  readonly emptyState: Locator;
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly affiliateDisclosure: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.searchInput = page.getByPlaceholder(/buscar.*oferta|buscar.*deal/i);
    this.storeFilter = page.getByRole('combobox', { name: /loja/i }).or(
      page.locator('[data-testid="store-filter"]'),
    );
    this.categoryFilter = page.getByRole('combobox', { name: /categoria/i }).or(
      page.locator('[data-testid="category-filter"]'),
    );
    this.typeFilter = page.getByRole('combobox', { name: /tipo/i }).or(
      page.locator('[data-testid="type-filter"]'),
    );
    this.sortDropdown = page.getByRole('combobox', { name: /ordenar/i }).or(
      page.getByRole('button', { name: /ordenar/i }),
    );
    this.dealCardsGrid = page.locator('.grid').filter({
      has: page.locator('[data-testid="deal-card"], article, [class*="card"]'),
    });
    this.emptyState = page.getByText(/nenhuma oferta|nenhum resultado|sem ofertas/i);
    this.pagination = page.locator('nav[aria-label*="pagina" i], [data-testid="pagination"]');
    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xim/i });
    this.affiliateDisclosure = page.getByText(
      /links? de afiliado|comiss[aã]o|parceiro|divulga[cç][aã]o/i,
    );
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate to the public deals page */
  async navigate(): Promise<void> {
    await this.goto('/deals');
  }

  /** Wait for deal results to finish loading */
  async waitForResults(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('.grid, [class*="empty"], [class*="text-center"]')
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

  /** Filter deals by store using the store dropdown */
  async filterByStore(store: string): Promise<void> {
    await this.storeFilter.click();
    await this.page.getByRole('option', { name: new RegExp(store, 'i') }).click();
    await this.waitForResults();
  }

  /** Filter deals by type (COUPON or PROMOTION) */
  async filterByType(type: string): Promise<void> {
    await this.typeFilter.click();
    await this.page.getByRole('option', { name: new RegExp(type, 'i') }).click();
    await this.waitForResults();
  }

  /** Filter deals by category */
  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.getByRole('option', { name: new RegExp(category, 'i') }).click();
    await this.waitForResults();
  }

  /** Get all visible deal card locators */
  getDealCards(): Locator {
    return this.page.locator(
      '[data-testid="deal-card"], .grid article, .grid [class*="card"]',
    );
  }

  /** Get the count of visible deal cards */
  async getCardCount(): Promise<number> {
    return this.getDealCards().count();
  }

  /** Get all visible deal card titles */
  async getCardTitles(): Promise<string[]> {
    const titles = this.page.locator(
      '[data-testid="deal-card"] h3, .grid article h3, .grid [class*="card"] h3',
    );
    return titles.allTextContents();
  }

  /** Click on a deal card by its index (0-based) */
  async clickDeal(index: number): Promise<void> {
    const cards = this.getDealCards();
    await cards.nth(index).click();
  }

  /** Copy the coupon code from a deal card at the given index */
  async copyCouponCode(index: number): Promise<void> {
    const card = this.getDealCards().nth(index);
    const copyButton = card.getByRole('button', { name: /copiar|c[oó]digo/i }).or(
      card.locator('[data-testid="copy-coupon"]'),
    );
    await copyButton.click();
  }

  /** Assert that the deals page has at least one result */
  async expectHasResults(): Promise<void> {
    const count = await this.getCardCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert no results are shown */
  async expectNoResults(): Promise<void> {
    await expect(this.emptyState).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the affiliate disclosure banner is visible */
  async expectAffiliateDisclosure(): Promise<void> {
    await expect(this.affiliateDisclosure).toBeVisible();
  }
}
