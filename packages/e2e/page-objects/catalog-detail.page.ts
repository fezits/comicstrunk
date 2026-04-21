import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CatalogDetailPage extends BasePage {
  readonly title: Locator;
  readonly authorInfo: Locator;
  readonly publisherInfo: Locator;
  readonly descriptionHeading: Locator;
  readonly descriptionText: Locator;
  readonly starRating: Locator;
  readonly seriesLink: Locator;
  readonly breadcrumbCatalog: Locator;
  readonly breadcrumbCurrent: Locator;
  readonly notFoundHeading: Locator;
  readonly backToCatalogLink: Locator;
  readonly categoriesBadges: Locator;
  readonly tagsBadges: Locator;
  readonly charactersBadges: Locator;
  readonly reviewsSection: Locator;
  readonly commentsSection: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    // The detail page renders the entry title in an h1 inside CatalogDetail
    this.title = page.getByRole('heading', { level: 1 });
    // Author and publisher are rendered as "Autor: ..." and "Editora: ..." text
    this.authorInfo = page.getByText(/autor:/i);
    this.publisherInfo = page.getByText(/editora:/i);
    // Description section
    this.descriptionHeading = page.getByRole('heading', { name: /descri[cç][aã]o/i });
    this.descriptionText = page.locator('.whitespace-pre-line');
    // Star rating component
    this.starRating = page.locator('[class*="star"], [data-testid="star-rating"]').first();
    // Series link in detail metadata
    this.seriesLink = page.getByText(/s[eé]rie:/i).locator('..').getByRole('link');
    // Breadcrumb navigation
    this.breadcrumbCatalog = page.locator('nav').getByRole('link', { name: /cat[aá]logo/i });
    this.breadcrumbCurrent = page.locator('nav .text-foreground.truncate');
    // Not-found state
    this.notFoundHeading = page.getByRole('heading', { name: /n[aã]o encontrad/i });
    this.backToCatalogLink = page.getByRole('link', { name: /voltar ao cat[aá]logo/i });
    // Badge sections
    this.categoriesBadges = page.locator('h3:has-text("Categorias") + div .inline-flex, h3:has-text("Categorias") ~ div [class*="badge"]');
    this.tagsBadges = page.locator('h3:has-text("Tags") + div .inline-flex, h3:has-text("Tags") ~ div [class*="badge"]');
    this.charactersBadges = page.locator('h3:has-text("Personagens") + div .inline-flex, h3:has-text("Personagens") ~ div [class*="badge"]');
    // Reviews and comments sections
    this.reviewsSection = page.locator('#reviews');
    this.commentsSection = page.locator('#comments');
    // Loading state
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate directly to a catalog detail page by ID */
  async navigate(id: string): Promise<void> {
    await this.goto(`/catalog/${id}`);
  }

  /** Wait for the detail page content to finish loading */
  async waitForContent(): Promise<void> {
    await this.waitForLoaded();
    // Wait for either the title or the not-found heading to appear
    await this.page
      .locator('h1, h2')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Assert the page loaded successfully with a title visible */
  async expectLoaded(): Promise<void> {
    await expect(this.title).toBeVisible();
  }

  /** Assert the entry was not found */
  async expectNotFound(): Promise<void> {
    await expect(this.notFoundHeading).toBeVisible();
    await expect(this.backToCatalogLink).toBeVisible();
  }

  /** Get the entry title text */
  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? '';
  }

  /** Assert author info is visible with expected text */
  async expectAuthor(name: string): Promise<void> {
    await expect(this.authorInfo).toContainText(name);
  }

  /** Assert publisher info is visible with expected text */
  async expectPublisher(name: string): Promise<void> {
    await expect(this.publisherInfo).toContainText(name);
  }

  /** Assert description section is visible */
  async expectDescriptionVisible(): Promise<void> {
    await expect(this.descriptionHeading).toBeVisible();
  }

  /** Navigate back to catalog using the breadcrumb link */
  async goBackToCatalog(): Promise<void> {
    await this.breadcrumbCatalog.click();
  }

  /** Get the current URL path segment after /catalog/ (the entry ID) */
  async getEntryIdFromUrl(): Promise<string> {
    const url = new URL(this.page.url());
    const match = url.pathname.match(/\/catalog\/([^/]+)/);
    return match?.[1] ?? '';
  }

  /** Assert the URL matches the expected catalog detail pattern */
  async expectUrlPattern(): Promise<void> {
    await expect(this.page).toHaveURL(/\/pt-BR\/catalog\/[a-zA-Z0-9_-]+/);
  }
}
