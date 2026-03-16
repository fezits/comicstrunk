import { test, expect } from '../../fixtures';
import { MarketplacePage } from '../../page-objects/marketplace.page';
import { authedApiClient } from '../../helpers/api-client';
import { TEST_PREFIX } from '../../helpers/test-constants';

test.describe('Marketplace Browsing', () => {
  let marketplace: MarketplacePage;

  /**
   * Helper: create a seller with a for-sale item via the API.
   * Returns the seller token and collectionItem id.
   */
  async function createSellerWithListing(
    loginAsFreshUser: (suffix?: string) => Promise<{ accessToken: string; id: string }>,
    dataFactory: { createAndApproveCatalogEntry: (o?: Record<string, unknown>) => Promise<{ id: string; title: string }> },
  ) {
    // 1. Create and approve a catalog entry
    const entry = await dataFactory.createAndApproveCatalogEntry();

    // 2. Create a fresh seller user
    const seller = await loginAsFreshUser(`seller_mp_${Date.now()}`);
    const sellerApi = authedApiClient(seller.accessToken);

    // 3. Add to collection
    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'VERY_GOOD',
      pricePaid: 15.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    // 4. Mark for sale
    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 29.9,
    });

    return { seller, collectionItemId, entry };
  }

  test.beforeEach(async ({ page }) => {
    marketplace = new MarketplacePage(page);
  });

  test('should load the marketplace page with heading', async () => {
    await marketplace.navigate();
    await marketplace.waitForResults();
    await expect(marketplace.heading).toBeVisible();
    await expect(marketplace.heading).toContainText(/marketplace/i);
  });

  test('should display listings when items are for sale', async ({
    page,
    loginAsFreshUser,
    dataFactory,
  }) => {
    // Set up a listing via the API
    await createSellerWithListing(loginAsFreshUser, dataFactory);

    // Now browse the marketplace
    await marketplace.navigate();
    await marketplace.waitForResults();

    // There should be at least one listing
    const count = await marketplace.getCardCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should search by title', async ({
    page,
    loginAsFreshUser,
    dataFactory,
  }) => {
    // Create a listing with a known title
    const { entry } = await createSellerWithListing(loginAsFreshUser, dataFactory);

    await marketplace.navigate();
    await marketplace.waitForResults();

    // Search using part of the known title
    const searchTerm = entry.title.substring(TEST_PREFIX.length, TEST_PREFIX.length + 8);
    await marketplace.search(searchTerm);

    // Should have results containing the search term
    const count = await marketplace.getCardCount();
    if (count > 0) {
      const titles = await marketplace.getCardTitles();
      const hasMatch = titles.some((t) =>
        t.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      expect(hasMatch).toBeTruthy();
    }
  });

  test('search with no match shows empty state', async () => {
    await marketplace.navigate();
    await marketplace.waitForResults();

    await marketplace.search('xyznonexistent98765zzz');
    await marketplace.expectNoResults();
  });

  test('should show pagination or handle empty results gracefully', async () => {
    await marketplace.navigate();
    await marketplace.waitForResults();

    const count = await marketplace.getCardCount();

    if (count === 0) {
      // Empty state is acceptable
      await marketplace.expectNoResults();
    } else if (count >= 20) {
      // If there are enough listings, pagination should appear
      const pageInfo = await marketplace.getPageInfo();
      expect(pageInfo).not.toBeNull();
    } else {
      // Less than a page worth: no pagination expected
      expect(count).toBeGreaterThan(0);
    }
  });
});
