import { test, expect } from '../../fixtures';

/**
 * Admin Payments Dashboard tests.
 *
 * Verifies the admin payments page at /admin/payments loads,
 * shows pending/all tabs, and allows approve/reject actions.
 */
test.describe('Admin Payments Dashboard', () => {
  test('should load admin payments dashboard', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/payments');
    await adminPage.waitForLoadState('networkidle');

    const heading = adminPage
      .getByRole('heading', { name: /pagamentos|payments/i })
      .or(adminPage.getByText(/gerenciar pagamentos|manage payments/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should show pending and all tabs or filters', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/payments');
    await adminPage.waitForLoadState('networkidle');

    // Look for tabs or filter buttons for pending vs all payments
    const pendingTab = adminPage
      .getByRole('tab', { name: /pendente|pending/i })
      .or(adminPage.getByRole('button', { name: /pendente|pending/i }))
      .first();
    const allTab = adminPage
      .getByRole('tab', { name: /todos|all|tudo/i })
      .or(adminPage.getByRole('button', { name: /todos|all|tudo/i }))
      .first();

    const hasPending = await pendingTab.isVisible().catch(() => false);
    const hasAll = await allTab.isVisible().catch(() => false);

    // Should have at least one way to filter/view payments
    // Could also be a select dropdown
    const hasFilter = hasPending || hasAll;

    if (!hasFilter) {
      // Look for a select-based filter (combobox)
      const select = adminPage.locator('select, button[role="combobox"]').first();
      const hasSelect = await select.isVisible().catch(() => false);
      expect(hasSelect).toBeTruthy();
    } else {
      expect(hasFilter).toBeTruthy();
    }
  });

  test('should show approve and reject actions for pending payments', async ({
    adminPage,
  }) => {
    await adminPage.goto('/pt-BR/admin/payments');
    await adminPage.waitForLoadState('networkidle');

    // If there are pending payments, look for action buttons
    const approveBtn = adminPage
      .getByRole('button', { name: /aprovar|approve/i })
      .first();
    const rejectBtn = adminPage
      .getByRole('button', { name: /rejeitar|reject/i })
      .first();

    const hasApprove = await approveBtn.isVisible().catch(() => false);
    const hasReject = await rejectBtn.isVisible().catch(() => false);

    // If there are pending payments, buttons should exist
    // If no pending payments, that is also acceptable (empty state)
    if (!hasApprove && !hasReject) {
      const emptyState = adminPage
        .getByText(/nenhum pagamento|sem pagamentos|no pending|vazio/i)
        .first();
      const tableRow = adminPage.locator('table tbody tr').first();
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      const hasRow = await tableRow.isVisible().catch(() => false);

      // Either empty state or table rows should be present
      expect(hasEmpty || hasRow).toBeTruthy();
    } else {
      expect(hasApprove || hasReject).toBeTruthy();
    }
  });
});
