import { test, expect } from '../../fixtures';
import { CollectionPage } from '../../page-objects/collection.page';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TEST_PREFIX = '_test_';

/**
 * Helper: create a temporary CSV file with valid collection data.
 */
function createValidCSV(): string {
  const csvContent = [
    'title,quantity,condition,price,notes',
    `${TEST_PREFIX}Batman #1_csv,1,Novo,29.90,Import test item`,
    `${TEST_PREFIX}Superman #2_csv,2,Bom,15.50,Another import item`,
  ].join('\n');

  const tmpPath = path.join(os.tmpdir(), `e2e-collection-import-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, csvContent, 'utf-8');
  return tmpPath;
}

/**
 * Helper: create a temporary CSV file with invalid data to test error reporting.
 */
function createInvalidCSV(): string {
  const csvContent = [
    'title,quantity,condition,price,notes',
    ',1,Novo,29.90,Missing title',
    `${TEST_PREFIX}Valid Entry_csv,abc,Bom,15.50,Invalid quantity`,
    `${TEST_PREFIX}Another Entry_csv,1,InvalidCondition,-5,Invalid condition and price`,
  ].join('\n');

  const tmpPath = path.join(os.tmpdir(), `e2e-collection-import-bad-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, csvContent, 'utf-8');
  return tmpPath;
}

test.describe('Collection CSV Import/Export', () => {
  test('should export collection as CSV', async ({ authedPage, dataFactory }) => {
    // Seed at least one item so the export has data
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

    // Navigate to collection
    await collection.navigate();
    await collection.waitForResults();

    // Start waiting for the download before clicking export
    const downloadPromise = authedPage.waitForEvent('download', { timeout: 15_000 });
    await collection.clickExport();

    const download = await downloadPromise;

    // Verify the download started and has a reasonable filename
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/\.(csv|xlsx)$/i);

    // Save to temp and verify it has content
    const downloadPath = path.join(os.tmpdir(), suggestedFilename);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    expect(stat.size).toBeGreaterThan(0);

    // Cleanup
    fs.unlinkSync(downloadPath);
  });

  test('should import collection from CSV successfully', async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Create a valid CSV file
    const csvPath = createValidCSV();

    // Import the CSV
    await collection.importCSV(csvPath);

    // If there is a confirm button after file selection, click it
    const confirmButton = authedPage
      .getByRole('button', { name: /enviar|importar|confirmar/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify success message
    await collection.expectToast(/import.*sucesso|importad[oa]|processad[oa]/i);

    // Cleanup temp file
    fs.unlinkSync(csvPath);
  });

  test('should show error report when importing CSV with errors', async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.waitForResults();

    // Create a CSV with invalid data
    const csvPath = createInvalidCSV();

    // Import the CSV
    await collection.importCSV(csvPath);

    // If there is a confirm button, click it
    const confirmButton = authedPage
      .getByRole('button', { name: /enviar|importar|confirmar/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify an error report is shown
    const errorReport = authedPage.getByText(
      /erro|falha|inv[aá]lid|problema/i,
    );
    await expect(errorReport.first()).toBeVisible({ timeout: 10_000 });

    // Cleanup temp file
    fs.unlinkSync(csvPath);
  });
});
