import { test, expect } from '../../fixtures';
import { AdminCatalogPage } from '../../page-objects/admin-catalog.page';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TEST_PREFIX = '_test_';

/**
 * Helper: create a valid CSV file with catalog entries.
 */
function createValidCatalogCSV(): string {
  const csvContent = [
    'title,publisher,description',
    `${TEST_PREFIX}Batman Adventures #100_csv,Panini,E2E import test entry A`,
    `${TEST_PREFIX}Superman Origins #200_csv,DC Comics,E2E import test entry B`,
    `${TEST_PREFIX}Spider-Man Legacy #300_csv,Marvel Comics,E2E import test entry C`,
  ].join('\n');

  const tmpPath = path.join(os.tmpdir(), `e2e-catalog-import-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, csvContent, 'utf-8');
  return tmpPath;
}

/**
 * Helper: create a CSV file with invalid/bad data.
 */
function createBadCatalogCSV(): string {
  const csvContent = [
    'title,publisher,description',
    ',,Missing all required fields',
    `${TEST_PREFIX}Valid Title_csv,,Missing publisher`,
    `,Panini,Missing title`,
    `${TEST_PREFIX}${'X'.repeat(500)}_csv,Panini,Title too long`,
  ].join('\n');

  const tmpPath = path.join(os.tmpdir(), `e2e-catalog-import-bad-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, csvContent, 'utf-8');
  return tmpPath;
}

test.describe('Admin Catalog CSV Import/Export', () => {
  test('should import CSV and create entries as PENDING', async ({ adminPage }) => {
    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Create a valid CSV file
    const csvPath = createValidCatalogCSV();

    // Import the CSV
    await adminCatalog.importCSV(csvPath);
    await adminCatalog.confirmImport();

    // Verify import success
    await adminCatalog.expectImportSuccess();

    // Switch to Pendentes tab and search for one of the imported entries
    await adminCatalog.selectTabPending();
    await adminCatalog.search(`${TEST_PREFIX}Batman Adventures #100_csv`);

    // The imported entry should appear as PENDING
    const entryCount = await adminCatalog.getEntryCount();
    expect(entryCount).toBeGreaterThanOrEqual(1);

    // Cleanup temp file
    fs.unlinkSync(csvPath);
  });

  test('should export catalog as CSV and start download', async ({ adminPage }) => {
    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Start waiting for the download before clicking export
    const downloadPromise = adminPage.waitForEvent('download', { timeout: 15_000 });
    await adminCatalog.clickExport();

    const download = await downloadPromise;

    // Verify the download started
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/\.(csv|xlsx)$/i);

    // Save to temp and verify it has content
    const downloadPath = path.join(os.tmpdir(), suggestedFilename);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    expect(stat.size).toBeGreaterThan(0);

    // Verify it looks like a CSV (starts with header row)
    if (suggestedFilename.endsWith('.csv')) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
      expect(lines[0].toLowerCase()).toContain('title');
    }

    // Cleanup
    fs.unlinkSync(downloadPath);
  });

  test('should show validation errors when importing CSV with bad data', async ({
    adminPage,
  }) => {
    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Create a CSV with bad data
    const csvPath = createBadCatalogCSV();

    // Import the CSV
    await adminCatalog.importCSV(csvPath);
    await adminCatalog.confirmImport();

    // Verify error report is shown
    await adminCatalog.expectImportErrors();

    // Cleanup temp file
    fs.unlinkSync(csvPath);
  });
});
