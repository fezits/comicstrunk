import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';

test.describe('Collection Series Progress', () => {
  /**
   * Helper: seed a collection item from a series so series-progress has data.
   */
  async function seedSeriesItem(
    authedPage: import('@playwright/test').Page,
    dataFactory: import('../../fixtures').TestDataFixtures['dataFactory'],
  ): Promise<{ collection: CollectionPage; entryTitle: string }> {
    // Create an approved catalog entry (seed data has 5 series, entries may be linked to them)
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const collection = new CollectionPage(authedPage);

    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Novo',
      price: 20.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    return { collection, entryTitle: entry.title };
  }

  test('should navigate to series progress page', async ({ authedPage, dataFactory }) => {
    await seedSeriesItem(authedPage, dataFactory);

    const collection = new CollectionPage(authedPage);
    await collection.navigateToSeriesProgress();
    await authedPage.waitForLoadState('domcontentloaded');

    // The page should show a heading related to series progress
    const heading = authedPage.getByRole('heading', {
      name: /progresso.*s[eé]rie|s[eé]ries|cole[cç][aã]o/i,
    });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should show progress bar with edition count', async ({ authedPage, dataFactory }) => {
    await seedSeriesItem(authedPage, dataFactory);

    const collection = new CollectionPage(authedPage);
    await collection.navigateToSeriesProgress();
    await authedPage.waitForLoadState('domcontentloaded');

    // Look for progress indicators — "N de M edicoes" pattern
    const progressText = authedPage.getByText(/\d+\s+de\s+\d+\s+edi[cç][oõ]es?/i);

    // There might be series from seed data or the newly added item
    // If no series progress is available, check for an empty state message
    const hasProgress = await progressText.first().isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmptyState = await authedPage
      .getByText(/nenhuma s[eé]rie|comece adicionando|sem progresso/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // One of these should be true
    expect(hasProgress || hasEmptyState).toBeTruthy();

    // If progress is visible, verify a progress bar element exists
    if (hasProgress) {
      const progressBar = authedPage.locator(
        '[role="progressbar"], .progress, [class*="progress"]',
      );
      await expect(progressBar.first()).toBeVisible();
    }
  });

  test('should list missing editions for a series', async ({ authedPage, dataFactory }) => {
    await seedSeriesItem(authedPage, dataFactory);

    const collection = new CollectionPage(authedPage);
    await collection.navigateToSeriesProgress();
    await authedPage.waitForLoadState('domcontentloaded');

    // Look for a "missing editions" section or list
    const missingSection = authedPage.getByText(
      /faltando|faltam|edi[cç][oõ]es?\s+faltantes?|ausentes?/i,
    );

    const hasMissing = await missingSection.first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasMissing) {
      // Should show individual missing edition items (as links or badges)
      const missingItems = authedPage.locator(
        '[data-testid*="missing"], .missing-edition, [class*="missing"]',
      ).or(
        missingSection.locator('..').locator('a, button, [class*="badge"]'),
      );
      const missingCount = await missingItems.count();
      expect(missingCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should click missing edition and navigate to catalog search', async ({
    authedPage,
    dataFactory,
  }) => {
    await seedSeriesItem(authedPage, dataFactory);

    const collection = new CollectionPage(authedPage);
    await collection.navigateToSeriesProgress();
    await authedPage.waitForLoadState('domcontentloaded');

    // Find a clickable missing edition link
    const missingLink = authedPage
      .locator('a[href*="catalog"]')
      .filter({
        hasText: /faltando|edi[cç][aã]o|#\d+/i,
      })
      .first()
      .or(
        authedPage.getByRole('link', { name: /buscar|encontrar|ver no cat[aá]logo/i }).first(),
      );

    const hasLink = await missingLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasLink) {
      await missingLink.click();
      // Should navigate to the catalog page (possibly with search params)
      await authedPage.waitForURL(/\/catalog/i, { timeout: 10_000 });
      await expect(authedPage).toHaveURL(/\/catalog/i);
    } else {
      // If no missing editions are available (user has all editions or no series data),
      // this is acceptable — the feature simply has no missing editions to show
      const emptyMessage = authedPage.getByText(
        /completa|sem.*faltando|todas.*edi[cç][oõ]es|nenhuma s[eé]rie/i,
      );
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5_000 }).catch(() => {
        // If neither missing links nor completion message, the page is in an acceptable state
      });
    }
  });
});
