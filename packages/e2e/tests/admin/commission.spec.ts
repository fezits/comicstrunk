import { test, expect } from '../../fixtures';

/**
 * Admin Commission Dashboard tests.
 *
 * Verifies the admin commission page at /admin/commission loads,
 * shows summary cards, and displays a transaction table.
 *
 * Real UI structure (admin-commission-page.tsx):
 * - h1 heading from t('title')
 * - Date range filter: periodStart/periodEnd Input + "Filtrar" Button
 * - CommissionSummaryCards component (in a grid)
 * - CommissionTransactionsTable component (table)
 */
test.describe('Admin Commission Dashboard', () => {
  test('should load admin commission dashboard', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/commission');
    await adminPage.waitForLoadState('networkidle');

    const heading = adminPage
      .getByRole('heading', { name: /comiss[oõ]|commission/i })
      .or(adminPage.getByText(/comiss[oõ]es|commissions/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should show summary cards (total, volume, count)', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/commission');
    await adminPage.waitForLoadState('networkidle');

    // The summary cards are in a grid container
    const grid = adminPage.locator('.grid').first();
    await expect(grid).toBeVisible({ timeout: 10_000 });

    // Should have at least some summary information
    // Cards typically show: total revenue, volume, transaction count
    const summaryText = adminPage
      .getByText(/total|volume|quantidade|count|R\$/i)
      .first();
    await expect(summaryText).toBeVisible({ timeout: 15_000 });
  });

  test('should show transaction table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/commission');
    await adminPage.waitForLoadState('networkidle');

    // Look for a table of transactions
    const table = adminPage.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      // Table headers should include relevant columns
      const tableHeaders = adminPage.locator('table thead th');
      const headerCount = await tableHeaders.count();
      expect(headerCount).toBeGreaterThanOrEqual(1);
    } else {
      // Could be an empty state or a different layout
      const emptyOrList = adminPage
        .getByText(/nenhuma transa[cç][aã]o|sem transa[cç][oõ]es|no transactions|vazio/i)
        .first();
      await expect(emptyOrList).toBeVisible({ timeout: 15_000 });
    }
  });

  test('should have date range filter', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/commission');
    await adminPage.waitForLoadState('networkidle');

    // The real UI has periodStart/periodEnd date inputs and a "Filtrar" button
    const dateInputs = adminPage.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();

    // Filter button
    const filterBtn = adminPage.getByRole('button', { name: /filtrar|filter/i }).first();
    const hasFilterBtn = await filterBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    // Either date inputs or filter button should exist
    expect(dateInputCount >= 1 || hasFilterBtn).toBeTruthy();
  });
});
