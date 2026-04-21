import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';
import { pickRandomImage } from '../../helpers/image-picker';

test.describe('Collection Features', () => {
  /**
   * Helper: seed a collection item via UI so the feature tests have data to work with.
   */
  async function seedCollectionItem(
    authedPage: import('@playwright/test').Page,
    dataFactory: import('../../fixtures').TestDataFixtures['dataFactory'],
  ): Promise<{ collection: CollectionPage; entryTitle: string }> {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const collection = new CollectionPage(authedPage);

    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Novo',
      price: 30.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    // Navigate to collection and find the item
    await collection.navigate();
    await collection.waitForResults();
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();

    return { collection, entryTitle: entry.title };
  }

  test('should mark item as read and show reading date', async ({ authedPage, dataFactory }) => {
    const { collection } = await seedCollectionItem(authedPage, dataFactory);

    // Mark the first item as read
    await collection.markAsRead(0);

    // Verify the reading date appears
    await collection.expectReadingDate(0);
  });

  test('should mark item for sale and show commission preview', async ({
    authedPage,
    dataFactory,
  }) => {
    const { collection } = await seedCollectionItem(authedPage, dataFactory);

    // Mark the first item for sale
    await collection.markForSale(0);

    // Commission preview should appear ("Voce recebera: R$ X,XX")
    await collection.expectCommissionPreview();
  });

  test('should upload photo for collection item', async ({ authedPage, dataFactory }) => {
    const { collection } = await seedCollectionItem(authedPage, dataFactory);

    // Pick a random test image (or fallback 1x1 PNG)
    const imagePath = pickRandomImage();

    // Upload the photo for the first item
    await collection.uploadPhoto(0, imagePath);

    // Verify upload success — either a toast or the image preview appears
    const hasToast = await collection
      .getToast(/foto|imagem|upload.*sucesso/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasPreview = await authedPage
      .locator('img[src*="upload"], img[src*="collection"]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(hasToast || hasPreview).toBeTruthy();
  });

  test('should unmark item as for sale', async ({ authedPage, dataFactory }) => {
    const { collection } = await seedCollectionItem(authedPage, dataFactory);

    // First, mark for sale
    await collection.markForSale(0);
    await collection.expectCommissionPreview();

    // Now unmark from sale
    await collection.unmarkForSale(0);

    // The commission preview should no longer be visible
    await expect(
      authedPage.getByText(/voc[eê] receber[aá]/i),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('should unmark item as read', async ({ authedPage, dataFactory }) => {
    const { collection } = await seedCollectionItem(authedPage, dataFactory);

    // First, mark as read
    await collection.markAsRead(0);
    await collection.expectReadingDate(0);

    // Now unmark as read
    await collection.unmarkAsRead(0);

    // The reading date should no longer be visible on the card
    const card = collection.itemCards.nth(0);
    await expect(card.getByText(/lido em|data.*leitura/i)).not.toBeVisible({ timeout: 5_000 });
  });
});
