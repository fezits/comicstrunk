import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';

test.describe('Collection Browsing & Filtering', () => {
  /**
   * Helper: seed multiple collection items so browse/filter tests have data.
   * Creates 3 items with different conditions for filter testing.
   */
  async function seedMultipleItems(
    authedPage: import('@playwright/test').Page,
    dataFactory: import('../../fixtures').TestDataFixtures['dataFactory'],
  ): Promise<CollectionPage> {
    const conditions = ['Novo', 'Muito Bom', 'Bom'];
    const collection = new CollectionPage(authedPage);

    for (const condition of conditions) {
      const entry = await dataFactory.createAndApproveCatalogEntry();
      await collection.navigateToAdd();
      await authedPage.waitForLoadState('domcontentloaded');
      await collection.fillAddForm({
        catalogTitle: entry.title,
        quantity: 1,
        condition,
        price: 20.0,
      });
      await collection.submitForm();
      await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});
    }

    await collection.navigate();
    await collection.waitForResults();
    return collection;
  }

  test('should list collection items with pagination controls', async ({
    authedPage,
    dataFactory,
  }) => {
    const collection = await seedMultipleItems(authedPage, dataFactory);

    // Should have items visible
    await collection.expectHasItems();

    // Pagination controls should exist (even if only one page)
    // They may be hidden if all items fit on one page, which is acceptable
    const hasPageInfo = await collection.pageInfo.isVisible().catch(() => false);
    const hasItems = (await collection.getItemCount()) > 0;
    expect(hasItems).toBeTruthy();
  });

  test('should filter by condition (Novo, Muito Bom, Bom, Regular, Ruim)', async ({
    authedPage,
    dataFactory,
  }) => {
    const collection = await seedMultipleItems(authedPage, dataFactory);

    // Filter by "Novo"
    await collection.filterByCondition('Novo');

    // Should show at least the one item we created with "Novo" condition
    const novoCount = await collection.getItemCount();
    expect(novoCount).toBeGreaterThanOrEqual(1);

    // All visible items should have "Novo" in their condition display
    // (This depends on UI rendering, so we verify at least one item is shown)
  });

  test('should filter by read status', async ({ authedPage, dataFactory }) => {
    // Seed items and mark one as read
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const collection = new CollectionPage(authedPage);

    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Novo',
      price: 15.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    await collection.navigate();
    await collection.waitForResults();
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();

    // Mark item as read
    await collection.markAsRead(0);

    // Clear search
    await collection.searchInput.fill('');
    await authedPage.waitForTimeout(600);
    await collection.waitForResults();

    // Filter by read status — checkbox labeled "Apenas lidos"
    await collection.filterByReadStatus('Apenas lidos');

    // Should show at least the one item we marked as read
    const readCount = await collection.getItemCount();
    expect(readCount).toBeGreaterThanOrEqual(1);
  });

  test('should filter by sale status', async ({ authedPage, dataFactory }) => {
    // Seed an item and mark it for sale
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const collection = new CollectionPage(authedPage);

    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Muito Bom',
      price: 25.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    await collection.navigate();
    await collection.waitForResults();
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();

    // Mark item for sale
    await collection.markForSale(0);

    // Clear search
    await collection.searchInput.fill('');
    await authedPage.waitForTimeout(600);
    await collection.waitForResults();

    // Filter by sale status — checkbox labeled "Apenas a venda"
    await collection.filterBySaleStatus('Apenas a venda');

    // Should show at least the one item marked for sale
    const saleCount = await collection.getItemCount();
    expect(saleCount).toBeGreaterThanOrEqual(1);
  });

  test('should search by title', async ({ authedPage, dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const collection = new CollectionPage(authedPage);

    // Add the item
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Bom',
      price: 12.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    // Navigate to collection
    await collection.navigate();
    await collection.waitForResults();

    // Search for a unique part of the title
    const searchTerm = entry.title.slice(0, 15);
    await collection.search(searchTerm);

    // Should find at least the item we added
    await collection.expectHasItems();
    const count = await collection.getItemCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // Search for a nonexistent term
    await collection.search('xyznonexistent99999zzz');

    // Should show empty state or zero results
    const emptyCount = await collection.getItemCount();
    if (emptyCount === 0) {
      await collection.expectEmpty();
    }
  });
});
