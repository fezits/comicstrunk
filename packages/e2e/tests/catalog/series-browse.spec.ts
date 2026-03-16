import { test, expect } from '../../fixtures';
import { BasePage } from '../../page-objects/base.page';

/**
 * Lightweight helpers for the series pages.
 * The series UI is simpler than the catalog, so we use inline locators
 * rather than a full page object.
 */
class SeriesListHelper extends BasePage {
  constructor(page: import('@playwright/test').Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.goto('/series');
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get subtitle() {
    return this.page.getByText(/explore as s[eé]ries/i);
  }

  get searchInput() {
    return this.page.getByPlaceholder(/buscar s[eé]ries/i);
  }

  get noResults() {
    return this.page.getByText(/nenhuma s[eé]rie encontrada/i);
  }

  /** Get all series cards on the page */
  getSeriesCards() {
    return this.page.locator('.block.group');
  }

  /** Get all visible series card titles */
  async getSeriesTitles(): Promise<string[]> {
    // Series card titles are rendered within CardTitle component
    const titles = this.page.locator('.block.group h3, .block.group [class*="CardTitle"]');
    return titles.allTextContents();
  }

  /** Click on a series card by index */
  async clickSeriesCard(index: number): Promise<void> {
    await this.getSeriesCards().nth(index).click();
  }

  /** Search for a series by title */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // Debounce is 300ms in series page
    await this.page.waitForTimeout(500);
    await this.waitForLoaded();
  }
}

test.describe('Series Browsing', () => {
  let seriesPage: SeriesListHelper;

  test.beforeEach(async ({ page }) => {
    seriesPage = new SeriesListHelper(page);
    await seriesPage.navigate();
    await seriesPage.waitForLoaded();
  });

  test('should display series page with heading and seed data', async () => {
    // Heading should show "Series"
    await expect(seriesPage.heading).toContainText(/s[eé]ries/i);
    await expect(seriesPage.subtitle).toBeVisible();

    // Seed data has 5 series
    const cards = seriesPage.getSeriesCards();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('should click on a series and see detail with editions', async ({ page }) => {
    // Click the first series card
    const titles = await seriesPage.getSeriesTitles();
    expect(titles.length).toBeGreaterThan(0);
    const clickedTitle = titles[0].trim();

    await seriesPage.clickSeriesCard(0);

    // Should navigate to series detail page
    await page.waitForURL(/\/pt-BR\/series\/[a-zA-Z0-9_-]+/);

    // Wait for content to load
    const spinner = page.locator('.animate-spin');
    await spinner.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});

    // Detail page should show the series title in h1
    const detailTitle = page.getByRole('heading', { level: 1 });
    await expect(detailTitle).toBeVisible();

    // Should show "Todas as Edicoes" heading
    await expect(
      page.getByRole('heading', { name: /todas as edi[cç][oõ]es/i }),
    ).toBeVisible();

    // Should show breadcrumb navigation with "Voltar" link
    const backLink = page.locator('nav').getByRole('link', { name: /voltar/i });
    await expect(backLink).toBeVisible();
  });

  test('should search series by title', async ({ page }) => {
    // Get the first series title
    const titles = await seriesPage.getSeriesTitles();
    expect(titles.length).toBeGreaterThan(0);

    // Search using a portion of the first title
    const searchTerm = titles[0].trim().substring(0, 4);
    await seriesPage.search(searchTerm);

    // Should show filtered results
    const filteredCards = seriesPage.getSeriesCards();
    const filteredCount = await filteredCards.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);

    // At least one result should contain the search term
    const filteredTitles = await seriesPage.getSeriesTitles();
    const hasMatch = filteredTitles.some((t) =>
      t.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    expect(hasMatch).toBeTruthy();
  });

  test('should show no results for non-matching search', async () => {
    await seriesPage.search('xyznonexistentseries99999');
    await expect(seriesPage.noResults).toBeVisible();
  });
});
