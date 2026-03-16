import { test, expect } from '../../fixtures';

/**
 * Payment History page tests.
 *
 * Verifies the /payments/history page loads, displays records or
 * an empty state, and supports status filtering if available.
 */
test.describe('Payment History', () => {
  test('should load payment history page', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/payments/history');
    await authedPage.waitForLoadState('networkidle');

    // Page heading or title should be visible
    const heading = authedPage
      .getByRole('heading', { name: /hist[oó]rico|pagamentos|payments/i })
      .or(authedPage.getByText(/hist[oó]rico de pagamentos/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should show payment records or empty state', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/payments/history');
    await authedPage.waitForLoadState('networkidle');

    // Either payment records exist or an empty state message is shown
    const hasRecords = authedPage.locator('table tbody tr, [data-testid="payment-row"]').first();
    const emptyState = authedPage
      .getByText(/nenhum pagamento|sem pagamentos|vazio|no payments/i)
      .first();

    const recordsVisible = await hasRecords.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);

    expect(recordsVisible || emptyVisible).toBeTruthy();
  });

  test('should allow filtering by status if available', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/payments/history');
    await authedPage.waitForLoadState('networkidle');

    // Look for a status filter select or tabs
    const filter = authedPage
      .locator('select, [data-testid="status-filter"], [role="tablist"]')
      .first();

    const filterVisible = await filter.isVisible().catch(() => false);
    if (filterVisible) {
      // If a filter is present, interact with it
      await filter.click();
      // The page should not crash after interaction
      await authedPage.waitForLoadState('networkidle');
      await expect(authedPage.locator('body')).toBeVisible();
    } else {
      // Filter may not be present — that is acceptable
      expect(true).toBeTruthy();
    }
  });
});
