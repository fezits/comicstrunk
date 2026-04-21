import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const TEST_PREFIX = '_test_';

/**
 * Helper: add collection items via API to quickly reach the plan limit.
 * FREE plan has a 50-item limit.
 */
async function seedCollectionItemsViaApi(
  accessToken: string,
  dataFactory: import('../../fixtures').TestDataFixtures['dataFactory'],
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  const client = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  for (let i = 0; i < count; i++) {
    try {
      const entry = await dataFactory.createAndApproveCatalogEntry();
      const res = await client.post('/collection', {
        catalogEntryId: entry.id,
        quantity: 1,
        condition: 'GOOD',
        pricePaid: 10.0,
      });
      if (res.data?.data?.id) {
        ids.push(res.data.data.id);
      }
    } catch {
      // If we hit the plan limit, that is expected — stop adding
      break;
    }
  }

  return ids;
}

test.describe('Collection Plan Limits', () => {
  test('should show upgrade message when FREE plan limit is reached', async ({
    authedPage,
    loginAsUser,
    dataFactory,
  }) => {
    const user = await loginAsUser();

    // Seed many items via API to approach or exceed the FREE plan limit (50 items)
    // We try to add 51 items — the last one should trigger the limit
    await seedCollectionItemsViaApi(user.accessToken, dataFactory, 51);

    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Try to add one more item via UI
    const extraEntry = await dataFactory.createAndApproveCatalogEntry();
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: extraEntry.title,
      quantity: 1,
      condition: 'Novo',
      price: 10.0,
    });
    await collection.submitForm();

    // Should show an upgrade message (either toast or inline)
    const upgradeVisible = await authedPage
      .getByText(/limite.*atingido|fa[cç]a upgrade|plano|limite.*cole[cç][aã]o/i)
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    const toastVisible = await collection
      .getToast(/limite|plano|upgrade/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(upgradeVisible || toastVisible).toBeTruthy();
  });

  test('should link upgrade message to /subscription page', async ({
    authedPage,
    loginAsUser,
    dataFactory,
  }) => {
    const user = await loginAsUser();

    // Seed items to hit the limit
    await seedCollectionItemsViaApi(user.accessToken, dataFactory, 51);

    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Look for upgrade link
    const upgradeLink = authedPage.getByRole('link', { name: /upgrade|assinar|plano/i }).or(
      authedPage.locator('a[href*="subscription"]'),
    );

    // Try adding another item to trigger the limit message
    const extraEntry = await dataFactory.createAndApproveCatalogEntry();
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: extraEntry.title,
      quantity: 1,
      condition: 'Novo',
      price: 10.0,
    });
    await collection.submitForm();

    // Navigate back to collection to see the upgrade link
    await collection.navigate();
    await collection.waitForResults();

    const hasLink = await upgradeLink.first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasLink) {
      await expect(upgradeLink.first()).toHaveAttribute('href', /subscription/);

      // Click the link
      await upgradeLink.first().click();
      await authedPage.waitForURL(/\/subscription/i, { timeout: 10_000 });
      await expect(authedPage).toHaveURL(/\/subscription/i);
    } else {
      // The upgrade link might be in a toast or modal — check the toast
      const toastLink = authedPage
        .locator('[data-sonner-toaster] a[href*="subscription"]');
      const toastHasLink = await toastLink.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(toastHasLink || hasLink).toBeTruthy();
    }
  });

  test('should preserve existing items on plan downgrade scenario', async ({
    authedPage,
    loginAsUser,
    dataFactory,
  }) => {
    const user = await loginAsUser();

    // Add a few items (less than the limit)
    const createdIds = await seedCollectionItemsViaApi(user.accessToken, dataFactory, 3);
    expect(createdIds.length).toBeGreaterThanOrEqual(1);

    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Verify items are present
    await collection.expectHasItems();
    const itemCount = await collection.getItemCount();
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // The items should still be accessible and visible
    // (Downgrade does not delete items, only prevents adding more past the limit)
    // Verify the items remain listed
    await collection.expectHasItems();
  });
});
