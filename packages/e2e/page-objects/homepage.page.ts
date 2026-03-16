import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the public Homepage (/ root).
 *
 * Covers the hero section, dynamic sections container,
 * banner carousel, catalog highlights, deals of the day,
 * and featured coupons sections.
 */
export class HomepagePage extends BasePage {
  // --- Hero section ---

  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly exploreCatalogButton: Locator;
  readonly viewDealsButton: Locator;

  // --- Dynamic sections ---

  readonly sectionsContainer: Locator;
  readonly bannerCarousel: Locator;
  readonly carouselPrevArrow: Locator;
  readonly carouselNextArrow: Locator;
  readonly carouselItems: Locator;
  readonly catalogHighlightsSection: Locator;
  readonly dealsOfDaySection: Locator;
  readonly featuredCouponsSection: Locator;

  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    // Hero section
    this.heroSection = page.locator('[data-testid="hero-section"], section').filter({
      hasText: /Comics Trunk/i,
    }).first();
    this.heroTitle = page.getByRole('heading', { name: /Comics Trunk/i }).first();
    this.heroSubtitle = this.heroSection.locator('p').first();
    this.exploreCatalogButton = page.getByRole('link', { name: /explorar cat[aá]logo/i }).or(
      page.getByRole('button', { name: /explorar cat[aá]logo/i }),
    );
    this.viewDealsButton = page.getByRole('link', { name: /ver ofertas/i }).or(
      page.getByRole('button', { name: /ver ofertas/i }),
    );

    // Dynamic sections
    this.sectionsContainer = page.locator(
      '[data-testid="homepage-sections"], main',
    );
    this.bannerCarousel = page.locator(
      '[data-testid="banner-carousel"], [class*="carousel"], [role="region"][aria-roledescription="carousel"]',
    );
    this.carouselPrevArrow = this.bannerCarousel.getByRole('button', { name: /anterior|prev/i }).or(
      this.bannerCarousel.locator('button').first(),
    );
    this.carouselNextArrow = this.bannerCarousel.getByRole('button', { name: /pr[oó]xim|next/i }).or(
      this.bannerCarousel.locator('button').last(),
    );
    this.carouselItems = this.bannerCarousel.locator(
      '[data-testid="carousel-item"], [role="group"], [class*="slide"]',
    );
    this.catalogHighlightsSection = page.locator(
      '[data-testid="catalog-highlights"]',
    ).or(
      page.locator('section').filter({ hasText: /destaques|highlights/i }),
    );
    this.dealsOfDaySection = page.locator(
      '[data-testid="deals-of-day"]',
    ).or(
      page.locator('section').filter({ hasText: /ofertas do dia/i }),
    );
    this.featuredCouponsSection = page.locator(
      '[data-testid="featured-coupons"]',
    ).or(
      page.locator('section').filter({ hasText: /cupons? em destaque|cupons? destaque/i }),
    );

    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate to the homepage */
  async navigate(): Promise<void> {
    await this.goto('/');
  }

  /** Assert the hero section is fully visible */
  async expectHeroVisible(): Promise<void> {
    await expect(this.heroTitle).toBeVisible({ timeout: 10_000 });
    await expect(this.exploreCatalogButton).toBeVisible();
    await expect(this.viewDealsButton).toBeVisible();
  }

  /** Click the "Explorar Catalogo" button */
  async clickExploreCatalog(): Promise<void> {
    await this.exploreCatalogButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Click the "Ver Ofertas" button */
  async clickViewDeals(): Promise<void> {
    await this.viewDealsButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Get all section elements within the dynamic sections container */
  getSections(): Locator {
    return this.sectionsContainer.locator(
      'section, [data-testid*="section"]',
    );
  }

  /** Get a specific section by its data-testid type attribute */
  getSectionByType(type: string): Locator {
    return this.page.locator(`[data-testid="section-${type}"]`).or(
      this.page.locator(`[data-section-type="${type}"]`),
    ).or(
      this.page.locator('section').filter({ hasText: new RegExp(type, 'i') }),
    );
  }

  /** Assert the banner carousel is visible */
  async expectBannerCarouselVisible(): Promise<void> {
    await expect(this.bannerCarousel).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the catalog highlights section is visible */
  async expectCatalogHighlightsVisible(): Promise<void> {
    await expect(this.catalogHighlightsSection).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the deals of day section is visible */
  async expectDealsOfDayVisible(): Promise<void> {
    await expect(this.dealsOfDaySection).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the featured coupons section is visible */
  async expectFeaturedCouponsVisible(): Promise<void> {
    await expect(this.featuredCouponsSection).toBeVisible({ timeout: 10_000 });
  }
}
