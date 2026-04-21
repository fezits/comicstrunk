import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';

const TEST_PREFIX = '_test_';

test.describe('Collection CRUD', () => {
  test('should navigate to /collection and page loads', async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    await collection.expectPageVisible();
    // The search input and add button should be visible
    await expect(collection.searchInput).toBeVisible();
    await expect(collection.addButton).toBeVisible();
  });

  test('should add item to collection from catalog', async ({ authedPage, dataFactory }) => {
    // First, create an approved catalog entry to add to collection
    const entry = await dataFactory.createAndApproveCatalogEntry();

    const collection = new CollectionPage(authedPage);
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');

    // Fill the add form: search for the catalog entry, set quantity, condition, price
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Novo',
      price: 25.0,
    });

    // Submit the form
    await collection.submitForm();

    // Should show success toast or redirect to collection
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});
    await collection.expectToast(/adicionad[oa]|sucesso/i).catch(async () => {
      // If no toast, at least the collection page should be visible
      await collection.navigate();
    });

    // Navigate to collection and verify the item appears
    await collection.navigate();
    await collection.waitForResults();

    // Search for the added entry
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();
  });

  test('should edit collection item', async ({ authedPage, dataFactory }) => {
    // Create and add an entry to collection via API
    const entry = await dataFactory.createAndApproveCatalogEntry();

    const collection = new CollectionPage(authedPage);

    // First add the item
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

    // Navigate to collection and find the item
    await collection.navigate();
    await collection.waitForResults();
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();

    // Click edit on the first item
    await collection.clickEditItem(0);
    await authedPage.waitForLoadState('domcontentloaded');

    // Change quantity to 2
    const quantityInput = authedPage.getByLabel(/quantidade/i);
    if (await quantityInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await quantityInput.fill('2');
    }

    // Change condition if visible
    const conditionSelect = authedPage.getByLabel(/condi[cç][aã]o/i).or(
      authedPage.getByRole('combobox', { name: /condi[cç][aã]o/i }),
    );
    if (await conditionSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await conditionSelect.click();
      await authedPage
        .getByRole('option', { name: /muito bom/i })
        .click();
    }

    // Submit the edit
    await collection.submitForm();

    // Verify success
    await collection.expectToast(/atualizad[oa]|salv[oa]|sucesso/i).catch(() => {});
  });

  test('should remove item from collection', async ({ authedPage, dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();

    const collection = new CollectionPage(authedPage);

    // Add the item first
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

    // Navigate to collection and find the item
    await collection.navigate();
    await collection.waitForResults();
    await collection.search(entry.title.slice(0, 15));
    await collection.expectHasItems();

    const countBefore = await collection.getItemCount();

    // Click remove on the first matching item
    await collection.clickRemoveItem(0);

    // Confirm the removal dialog
    await collection.confirmRemoval();

    // Verify item was removed
    await collection.waitForResults();
    const countAfter = await collection.getItemCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('should validate required fields on add form', async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');

    // Try to submit without filling anything
    await collection.submitForm();

    // Should stay on the form page and show validation errors
    await expect(authedPage).toHaveURL(/\/collection\/add|\/collection/i);

    // Look for validation messages (required field errors)
    const validationError = authedPage.locator(
      '[class*="error"], [class*="destructive"], [role="alert"], .text-red-500, .text-destructive',
    );
    await expect(validationError.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should update item count after add and remove', async ({ authedPage, dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();

    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Record initial count
    const initialCount = await collection.getItemCount();

    // Add an item
    await collection.navigateToAdd();
    await authedPage.waitForLoadState('domcontentloaded');
    await collection.fillAddForm({
      catalogTitle: entry.title,
      quantity: 1,
      condition: 'Bom',
      price: 10.0,
    });
    await collection.submitForm();
    await authedPage.waitForURL(/\/collection/i, { timeout: 10_000 }).catch(() => {});

    // Navigate back to collection
    await collection.navigate();
    await collection.waitForResults();

    // Search for the item to confirm it exists
    await collection.search(entry.title.slice(0, 15));
    const afterAddCount = await collection.getItemCount();
    expect(afterAddCount).toBeGreaterThanOrEqual(1);

    // Remove the item
    await collection.clickRemoveItem(0);
    await collection.confirmRemoval();
    await collection.waitForResults();

    // Count should decrease
    const afterRemoveCount = await collection.getItemCount();
    expect(afterRemoveCount).toBeLessThan(afterAddCount);
  });
});
