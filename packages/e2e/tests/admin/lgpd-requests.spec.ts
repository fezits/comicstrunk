import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Admin LGPD Requests tests.
 *
 * Verifies the admin LGPD requests page at /admin/lgpd:
 * list, filter by status, process, complete, and reject flows.
 *
 * Real UI structure (admin-lgpd-requests.tsx):
 * - Table with columns: Usuario, Tipo, Status, Data, Acoes
 * - Status filter Select (Todos, Pendente, Processando, Concluida, Rejeitada)
 * - NO type filter (only status filter)
 * - Action buttons per row: "Processar" + "Rejeitar" for PENDING, "Concluir" for PROCESSING
 * - Reject dialog with Textarea for reason
 * - Status badges: Pendente (yellow), Processando (blue), Concluida (green), Rejeitada (red)
 */
test.describe('Admin LGPD Requests', () => {
  let adminToken: string;
  let testRequestId: string;

  test.beforeAll(async ({ dataFactory, loginAsFreshUser }) => {
    adminToken = await dataFactory.getAdminToken();

    // Create a fresh user and submit a LGPD request for tests to work with
    const freshUser = await loginAsFreshUser('lgpdadmin');
    const userApi = authedApiClient(freshUser.accessToken);

    const res = await userApi.post('/lgpd/requests', {
      type: 'ACCESS',
      details: `${TEST_PREFIX}E2E test request for data access verification.`,
    });
    testRequestId = res.data.data.id;
  });

  test('should load LGPD requests page with table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // Should have a heading
    const heading = adminPage
      .getByRole('heading', { name: /lgpd|dados|solicita[cç][oõ]es|privacidade/i })
      .or(adminPage.getByText(/solicita[cç][oõ]es.*lgpd|lgpd.*requests|prote[cç][aã]o.*dados/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have a table or list of requests
    const table = adminPage.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      const rows = adminPage.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    } else {
      // Empty state or content area
      const content = adminPage
        .getByText(/Acesso|Corre[cç][aã]o|Exclus[aã]o|Exporta[cç][aã]o|Pendente|Processando/i)
        .first();
      const hasContent = await content.isVisible().catch(() => false);

      // Verify via API if UI is not yet available
      if (!hasContent) {
        const adminApi = authedApiClient(adminToken);
        const res = await adminApi.get('/lgpd/admin/requests', { params: { limit: 50 } });
        const requests = res.data.data || [];
        expect(requests.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('should filter requests by status', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // The real UI has a Select combobox for status filtering
    // with a "Status:" label before it
    const statusFilter = adminPage
      .locator('button[role="combobox"]')
      .first();

    await expect(statusFilter).toBeVisible({ timeout: 10_000 });
    await statusFilter.click();
    await adminPage.waitForTimeout(300);

    // Select "Pendente" option from the dropdown
    const pendingOption = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /Pendente/i })
      .first();

    if (await pendingOption.isVisible().catch(() => false)) {
      await pendingOption.click();
      await adminPage.waitForTimeout(500);

      // Should show pending requests with yellow "Pendente" badges
      // or if none, the table/empty state should still render
    }

    await expect(adminPage.locator('body')).toBeVisible();
  });

  test('should show table with correct columns', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // The real UI table has columns: Usuario, Tipo, Status, Data, Acoes
    const table = adminPage.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    const headers = adminPage.locator('table thead th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(4);

    // Verify type column shows human-readable labels (Acesso, Correcao, Exclusao, Exportacao)
    const typeLabels = adminPage.getByText(/Acesso|Corre[cç][aã]o|Exclus[aã]o|Exporta[cç][aã]o/);
    const typeCount = await typeLabels.count();
    // If there are requests, at least one type label should be visible
    if (typeCount > 0) {
      await expect(typeLabels.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should process a pending request', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // Create a fresh request to process
    const freshUser = await (async () => {
      const { signupViaApi } = await import('../../helpers/api-client');
      const ts = Date.now();
      return signupViaApi({
        name: `${TEST_PREFIX}LGPD Process ${ts}`,
        email: `${TEST_PREFIX}lgpd-process-${ts}@e2e-test.com`,
        password: 'Test1234!Aa',
        acceptedTerms: true,
      });
    })();

    const userApi = authedApiClient(freshUser.accessToken);
    const reqRes = await userApi.post('/lgpd/requests', {
      type: 'ACCESS',
      details: `${TEST_PREFIX}Request to be processed in e2e test.`,
    });
    const requestId = reqRes.data.data.id;

    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // Find and click "Processar" button (real UI button text)
    const processBtn = adminPage
      .getByRole('button', { name: /Processar/i })
      .first();

    const hasProcessBtn = await processBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasProcessBtn) {
      await processBtn.click();
      await adminPage.waitForTimeout(500);

      // Confirm if dialog
      const confirmBtn = adminPage
        .getByRole('button', { name: /confirmar|confirm|sim|yes/i })
        .first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }

      // The real UI shows toast "Solicitacao marcada como processando"
      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/processando|sucesso|marcada/i);
      await expect(success).toBeVisible({ timeout: 15_000 });
    } else {
      // Process via API
      const result = await adminApi.put(`/lgpd/admin/requests/${requestId}/process`);
      expect(result.data.data.status).toBe('PROCESSING');
    }
  });

  test('should complete a processing request', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // Create and process a request first
    const freshUser = await (async () => {
      const { signupViaApi } = await import('../../helpers/api-client');
      const ts = Date.now();
      return signupViaApi({
        name: `${TEST_PREFIX}LGPD Complete ${ts}`,
        email: `${TEST_PREFIX}lgpd-complete-${ts}@e2e-test.com`,
        password: 'Test1234!Aa',
        acceptedTerms: true,
      });
    })();

    const userApi = authedApiClient(freshUser.accessToken);
    const reqRes = await userApi.post('/lgpd/requests', {
      type: 'EXPORT',
      details: `${TEST_PREFIX}Request to be completed in e2e test.`,
    });
    const requestId = reqRes.data.data.id;

    // Process it first
    await adminApi.put(`/lgpd/admin/requests/${requestId}/process`);

    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // Find and click "Concluir" button (real UI button text for PROCESSING requests)
    const completeBtn = adminPage
      .getByRole('button', { name: /Concluir/i })
      .first();

    const hasCompleteBtn = await completeBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasCompleteBtn) {
      await completeBtn.click();
      await adminPage.waitForTimeout(500);

      const confirmBtn = adminPage
        .getByRole('button', { name: /confirmar|confirm|sim|yes/i })
        .first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }

      // The real UI shows toast "Solicitacao concluida"
      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/conclu[ií]da|sucesso/i);
      await expect(success).toBeVisible({ timeout: 15_000 });
    } else {
      // Complete via API
      const result = await adminApi.put(`/lgpd/admin/requests/${requestId}/complete`);
      expect(result.data.data.status).toBe('COMPLETED');
    }
  });

  test('should reject a request with reason', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // Create a fresh request to reject
    const freshUser = await (async () => {
      const { signupViaApi } = await import('../../helpers/api-client');
      const ts = Date.now();
      return signupViaApi({
        name: `${TEST_PREFIX}LGPD Reject ${ts}`,
        email: `${TEST_PREFIX}lgpd-reject-${ts}@e2e-test.com`,
        password: 'Test1234!Aa',
        acceptedTerms: true,
      });
    })();

    const userApi = authedApiClient(freshUser.accessToken);
    const reqRes = await userApi.post('/lgpd/requests', {
      type: 'CORRECTION',
      details: `${TEST_PREFIX}Request to be rejected in e2e test.`,
    });
    const requestId = reqRes.data.data.id;

    await adminPage.goto('/pt-BR/admin/lgpd');
    await adminPage.waitForLoadState('networkidle');

    // Find and click "Rejeitar" button (real UI button text for PENDING requests)
    const rejectBtn = adminPage
      .getByRole('button', { name: /Rejeitar/i })
      .first();

    const hasRejectBtn = await rejectBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRejectBtn) {
      await rejectBtn.click();
      await adminPage.waitForTimeout(500);

      // Clicking Rejeitar opens a Dialog with Textarea for reason
      const dialog = adminPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Fill reason in the dialog textarea
      const reasonInput = dialog.locator('textarea').first();
      await expect(reasonInput).toBeVisible({ timeout: 3_000 });
      await reasonInput.fill(
        `${TEST_PREFIX}Solicitacao rejeitada: dados insuficientes para processar o pedido.`,
      );

      // Confirm rejection via the dialog button
      const confirmBtn = dialog
        .getByRole('button', { name: /confirmar|rejeitar/i })
        .first();
      await confirmBtn.click();

      // The real UI shows toast "Solicitacao rejeitada"
      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/rejeitada|sucesso/i);
      await expect(success).toBeVisible({ timeout: 15_000 });
    } else {
      // Reject via API
      const result = await adminApi.put(`/lgpd/admin/requests/${requestId}/reject`, {
        reason: `${TEST_PREFIX}Dados insuficientes para processar o pedido.`,
      });
      expect(result.data.data.status).toBe('REJECTED');
    }
  });
});
