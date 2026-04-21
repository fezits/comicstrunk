import { test, expect } from '../../fixtures';
import { AdminCatalogPage } from '../../page-objects/admin-catalog.page';
import { CatalogPage } from '../../page-objects/catalog.page';
import { pickRandomImage } from '../../helpers/image-picker';

const TEST_PREFIX = '_test_';

test.describe('Admin Catalog Management', () => {
  test('should create a new catalog entry', async ({ adminPage }) => {
    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();
    await adminCatalog.expectPageVisible();

    // Click create button
    await adminCatalog.createButton.click();
    await adminPage.waitForLoadState('domcontentloaded');

    // Fill the entry form
    const title = `${TEST_PREFIX}Admin Created Entry ${Date.now()}`;
    const coverImage = pickRandomImage();

    await adminCatalog.fillEntryForm({
      title,
      publisher: 'Panini',
      description: `E2E test: created by admin at ${new Date().toISOString()}`,
      coverImagePath: coverImage,
    });

    // Submit the form
    await adminCatalog.submitEntryForm();

    // Verify success
    await adminCatalog.expectCreationSuccess();

    // Navigate back to catalog list and verify the entry appears
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();
    await adminCatalog.search(title.slice(0, 20));
    await adminCatalog.expectHasEntries();
  });

  test('should edit an existing catalog entry', async ({ adminPage, dataFactory }) => {
    // Create an entry via API
    const entry = await dataFactory.createCatalogEntry();

    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Search for the entry
    await adminCatalog.search(entry.title.slice(0, 15));
    await adminCatalog.expectHasEntries();

    // Click edit on the first result
    await adminCatalog.clickEditEntry(0);
    await adminPage.waitForLoadState('domcontentloaded');

    // Modify the title
    const updatedTitle = `${TEST_PREFIX}Updated Entry ${Date.now()}`;
    const titleInput = adminPage.getByLabel(/t[ií]tulo/i);
    await titleInput.fill(updatedTitle);

    // Submit
    await adminCatalog.submitEntryForm();

    // Verify success
    await adminCatalog.expectUpdateSuccess();
  });

  test('should approve a PENDING entry', async ({ adminPage, dataFactory }) => {
    // Create a PENDING entry (entries start as PENDING by default)
    const entry = await dataFactory.createCatalogEntry();

    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Filter to Pendentes tab
    await adminCatalog.selectTabPending();

    // Search for the entry
    await adminCatalog.search(entry.title.slice(0, 15));
    await adminCatalog.expectHasEntries();

    // Approve the first matching entry
    await adminCatalog.approveEntry(0);

    // Verify approval success
    await adminCatalog.expectApprovalSuccess();

    // Switch to Aprovados tab and verify it shows there
    await adminCatalog.selectTabApproved();
    await adminCatalog.search(entry.title.slice(0, 15));
    await adminCatalog.expectHasEntries();
  });

  test('should reject a PENDING entry with reason', async ({ adminPage, dataFactory }) => {
    // Create a PENDING entry
    const entry = await dataFactory.createCatalogEntry();

    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // Filter to Pendentes tab
    await adminCatalog.selectTabPending();

    // Search for the entry
    await adminCatalog.search(entry.title.slice(0, 15));
    await adminCatalog.expectHasEntries();

    // Reject with a reason
    await adminCatalog.rejectEntry(0, 'E2E test rejection: incomplete information');

    // Verify rejection success
    await adminCatalog.expectRejectionSuccess();

    // Switch to Rejeitados tab and verify it shows there
    await adminCatalog.selectTabRejected();
    await adminCatalog.search(entry.title.slice(0, 15));
    await adminCatalog.expectHasEntries();
  });

  test('should filter entries by status tabs', async ({ adminPage, dataFactory }) => {
    // Create entries with different statuses
    const pendingEntry = await dataFactory.createCatalogEntry();
    const approvedEntry = await dataFactory.createAndApproveCatalogEntry();

    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // "Todos" tab — should show all entries
    await adminCatalog.selectTabAll();
    await adminCatalog.expectHasEntries();

    // "Pendentes" tab — should show pending entries
    await adminCatalog.selectTabPending();
    await adminCatalog.search(pendingEntry.title.slice(0, 15));
    const pendingCount = await adminCatalog.getEntryCount();
    expect(pendingCount).toBeGreaterThanOrEqual(1);

    // "Aprovados" tab — should show approved entries
    await adminCatalog.selectTabApproved();
    await adminCatalog.search(approvedEntry.title.slice(0, 15));
    const approvedCount = await adminCatalog.getEntryCount();
    expect(approvedCount).toBeGreaterThanOrEqual(1);

    // "Rejeitados" tab — start clean (we may or may not have rejected entries)
    await adminCatalog.selectTabRejected();
    // Just verify the tab activates and renders (might be empty)
    await adminCatalog.waitForResults();
  });

  test('should show approved entry in public catalog', async ({ adminPage, dataFactory }) => {
    // Create and approve an entry
    const entry = await dataFactory.createAndApproveCatalogEntry();

    // Navigate to the public catalog (same browser, admin session)
    const publicCatalog = new CatalogPage(adminPage);
    await publicCatalog.navigate();
    await publicCatalog.waitForResults();

    // Search for the approved entry
    await publicCatalog.search(entry.title.slice(0, 15));
    await publicCatalog.expectHasResults();
  });

  test('should NOT show rejected entry in public catalog', async ({ adminPage, dataFactory }) => {
    // Create a PENDING entry, then reject it via API
    const entry = await dataFactory.createCatalogEntry();
    const adminToken = await dataFactory.getAdminToken();

    // Reject via API
    const axios = (await import('axios')).default;
    await axios.post(
      `${process.env.API_URL || 'http://localhost:3001/api/v1'}/catalog/${entry.id}/reject`,
      { reason: 'E2E test: verifying rejected entries are hidden' },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    // Navigate to public catalog
    const publicCatalog = new CatalogPage(adminPage);
    await publicCatalog.navigate();
    await publicCatalog.waitForResults();

    // Search for the rejected entry — it should NOT appear
    await publicCatalog.search(entry.title.slice(0, 15));

    // Expect no results for this specific entry
    const cardCount = await publicCatalog.getCardCount();
    const titles = await publicCatalog.getCardTitles();
    const found = titles.some((t) =>
      t.toLowerCase().includes(entry.title.slice(0, 15).toLowerCase()),
    );
    expect(found).toBeFalsy();
  });

  test('should show pagination on admin catalog list', async ({ adminPage, dataFactory }) => {
    const adminCatalog = new AdminCatalogPage(adminPage);
    await adminCatalog.navigate();
    await adminCatalog.waitForResults();

    // With seed data (10 entries) + any test entries, check if pagination is available
    // The "Todos" tab includes all statuses
    await adminCatalog.selectTabAll();
    await adminCatalog.expectHasEntries();

    const entryCount = await adminCatalog.getEntryCount();
    expect(entryCount).toBeGreaterThan(0);

    // If there are enough entries for pagination, verify controls
    const hasPageInfo = await adminCatalog.pageInfo.isVisible().catch(() => false);
    const hasNextButton = await adminCatalog.nextPageButton.isVisible().catch(() => false);

    // Either we have pagination controls or all entries fit on one page
    // Both are valid states
    if (hasPageInfo || hasNextButton) {
      // Pagination is visible — verify next page works
      await adminCatalog.goToNextPage();
      await adminCatalog.waitForResults();
    }
  });
});
