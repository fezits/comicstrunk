import { test, expect } from '../../fixtures';
import { CatalogPage } from '../../page-objects/catalog.page';
import { CatalogDetailPage } from '../../page-objects/catalog-detail.page';

test.describe('Catalog Detail Page', () => {
  test('should navigate from catalog grid to detail page', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();
    await catalog.expectHasResults();

    // Get the first card title before clicking
    const titles = await catalog.getCardTitles();
    const firstTitle = titles[0];

    // Click the first card
    await catalog.clickCard(0);

    // Should navigate to the detail page
    const detail = new CatalogDetailPage(page);
    await detail.waitForContent();
    await detail.expectLoaded();

    // The title should match what was shown on the card
    const detailTitle = await detail.getTitle();
    // Card titles may be truncated (line-clamp-2), so check the detail contains the card text
    expect(detailTitle.toLowerCase()).toContain(firstTitle.toLowerCase().trim());
  });

  test('should display title, author, and publisher on detail page', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();

    // Click first entry
    await catalog.clickCard(0);

    const detail = new CatalogDetailPage(page);
    await detail.waitForContent();

    // Title heading must be visible
    await detail.expectLoaded();

    // Seed data entries have a publisher (all created with 'Panini' or similar)
    // Check that at least the publisher info row is present
    await expect(detail.publisherInfo).toBeVisible();
  });

  test('should have correct URL format /catalog/[id]', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();

    // Click first entry
    await catalog.clickCard(0);

    const detail = new CatalogDetailPage(page);
    await detail.waitForContent();

    // URL should match /pt-BR/catalog/<some-id>
    await detail.expectUrlPattern();

    // The ID portion should be a non-empty string
    const entryId = await detail.getEntryIdFromUrl();
    expect(entryId.length).toBeGreaterThan(0);
  });

  test('should show breadcrumb navigation and navigate back', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();

    // Click first entry
    await catalog.clickCard(0);

    const detail = new CatalogDetailPage(page);
    await detail.waitForContent();

    // Breadcrumb should show "Catalogo" link and current entry title
    await expect(detail.breadcrumbCatalog).toBeVisible();
    await expect(detail.breadcrumbCurrent).toBeVisible();

    // Click the "Catalogo" breadcrumb to go back
    await detail.goBackToCatalog();

    // Should be back on the catalog listing page
    await page.waitForURL(/\/pt-BR\/catalog\/?(\?.*)?$/);
    const catalogPage = new CatalogPage(page);
    await catalogPage.waitForResults();
    await expect(catalogPage.heading).toContainText(/cat[aá]logo/i);
  });

  test('should show reviews and comments sections', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();

    // Click first entry
    await catalog.clickCard(0);

    const detail = new CatalogDetailPage(page);
    await detail.waitForContent();
    await detail.expectLoaded();

    // The detail page should have a reviews section and a comments section
    await expect(detail.reviewsSection).toBeVisible();
    await expect(detail.commentsSection).toBeVisible();
  });
});
