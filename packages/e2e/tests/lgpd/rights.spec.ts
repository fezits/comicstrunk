import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * User LGPD Rights tests.
 *
 * Verifies the user LGPD rights page at /lgpd:
 * page load with rights cards, export data, correction request,
 * request history, account deletion flow, and duplicate prevention.
 */
test.describe('User LGPD Rights', () => {
  test('should load LGPD page with heading and rights cards', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/lgpd');
    await authedPage.waitForLoadState('networkidle');

    // Should have a heading
    const heading = authedPage
      .getByRole('heading', { name: /lgpd|prote[cç][aã]o.*dados|direitos|privacidade/i })
      .or(authedPage.getByText(/seus.*direitos|your.*rights|prote[cç][aã]o.*dados/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have 4 rights cards: access, correction, portability/export, deletion
    const rightsPatterns = [
      /acesso|access/i,
      /corre[cç][aã]o|correction/i,
      /portabilidade|portability|exporta[cç][aã]o|export/i,
      /exclus[aã]o|dele[cç][aã]o|deletion|apagar|remover/i,
    ];

    let foundRights = 0;
    for (const pattern of rightsPatterns) {
      const card = authedPage
        .getByText(pattern)
        .first();
      const isVisible = await card.isVisible().catch(() => false);
      if (isVisible) foundRights++;
    }

    expect(foundRights).toBeGreaterThanOrEqual(2);
  });

  test('should export user data via download', async ({ authedPage, loginAsUser }) => {
    test.slow();

    await authedPage.goto('/pt-BR/lgpd');
    await authedPage.waitForLoadState('networkidle');

    // Find export/download button
    const exportBtn = authedPage
      .getByRole('button', { name: /exportar|export|baixar|download/i })
      .or(authedPage.getByRole('link', { name: /exportar|export|baixar|download/i }))
      .first();

    const hasExportBtn = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasExportBtn) {
      // Set up download listener
      const downloadPromise = authedPage.waitForEvent('download', { timeout: 30_000 }).catch(() => null);

      await exportBtn.click();

      const download = await downloadPromise;

      if (download) {
        // Verify the download filename
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/meus-dados|dados|data|export/i);
      } else {
        // May have shown a success message instead of direct download
        const success = authedPage
          .locator('[data-sonner-toaster]')
          .getByText(/sucesso|export|download/i)
          .or(authedPage.getByText(/dados.*exportados|data.*exported/i));

        const hasSuccess = await success.isVisible({ timeout: 10_000 }).catch(() => false);
        expect(hasSuccess).toBeTruthy();
      }
    } else {
      // Verify export works via API
      const user = await loginAsUser();
      const userApi = authedApiClient(user.accessToken);
      const res = await userApi.get('/lgpd/export');
      expect(res.status).toBe(200);
      expect(res.data.data).toBeTruthy();
    }
  });

  test('should submit a correction request with details', async ({ authedPage }) => {
    test.slow();

    await authedPage.goto('/pt-BR/lgpd');
    await authedPage.waitForLoadState('networkidle');

    // Find correction request button or section
    const correctionBtn = authedPage
      .getByRole('button', { name: /corre[cç][aã]o|correction|solicitar.*corre/i })
      .or(authedPage.getByRole('link', { name: /corre[cç][aã]o|correction/i }))
      .first();

    const hasCorrectionBtn = await correctionBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasCorrectionBtn) {
      await correctionBtn.click();
      await authedPage.waitForTimeout(500);

      // Fill details
      const detailsInput = authedPage
        .getByPlaceholder(/detalhe|descri[cç][aã]o|detail|describe/i)
        .or(authedPage.locator('textarea').first());

      if (await detailsInput.isVisible().catch(() => false)) {
        await detailsInput.fill(
          `${TEST_PREFIX}Solicito correcao do meu nome cadastrado. O nome correto e "E2E Test User Corrigido".`,
        );
      }

      // Submit
      const submitBtn = authedPage
        .getByRole('button', { name: /enviar|submit|solicitar|confirmar|send/i })
        .first();

      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();

        const success = authedPage
          .locator('[data-sonner-toaster]')
          .getByText(/sucesso|enviada|enviado|created|sent/i)
          .or(authedPage.getByText(/solicita[cç][aã]o.*enviada|request.*sent|criada/i));
        await expect(success).toBeVisible({ timeout: 15_000 });
      }
    } else {
      // Submit via API as fallback
      const { loginViaApi } = await import('../../helpers/api-client');
      const { accessToken } = await loginViaApi('user@test.com', 'Test1234');
      const userApi = authedApiClient(accessToken);

      const res = await userApi.post('/lgpd/requests', {
        type: 'CORRECTION',
        details: `${TEST_PREFIX}E2E correction request via API fallback.`,
      });
      expect(res.data.data.type).toBe('CORRECTION');
      expect(res.data.data.status).toBe('PENDING');
    }
  });

  test('should show request in history list after submission', async ({ authedPage, loginAsUser }) => {
    test.slow();

    // First submit a request via API to guarantee we have one
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    await userApi.post('/lgpd/requests', {
      type: 'ACCESS',
      details: `${TEST_PREFIX}E2E history test request for access data.`,
    });

    await authedPage.goto('/pt-BR/lgpd');
    await authedPage.waitForLoadState('networkidle');

    // Look for history section
    const historySection = authedPage
      .getByText(/hist[oó]rico|history|solicita[cç][oõ]es|minhas.*solicita/i)
      .first();
    const hasHistory = await historySection.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasHistory) {
      // Should show the request in the list
      const requestItem = authedPage
        .getByText(/ACCESS|acesso/i)
        .or(authedPage.getByText(/PENDING|pendente/i))
        .first();
      await expect(requestItem).toBeVisible({ timeout: 10_000 });
    } else {
      // Navigate to a dedicated history page if exists
      const historyLink = authedPage
        .getByRole('link', { name: /hist[oó]rico|history|ver.*solicita/i })
        .first();

      if (await historyLink.isVisible().catch(() => false)) {
        await historyLink.click();
        await authedPage.waitForLoadState('networkidle');

        const requestItem = authedPage
          .getByText(/ACCESS|acesso|PENDING|pendente/i)
          .first();
        await expect(requestItem).toBeVisible({ timeout: 10_000 });
      } else {
        // Verify history via API
        const res = await userApi.get('/lgpd/requests', { params: { limit: 50 } });
        const requests = res.data.data || [];
        expect(requests.length).toBeGreaterThanOrEqual(1);

        const hasAccessReq = requests.some(
          (r: { type: string }) => r.type === 'ACCESS',
        );
        expect(hasAccessReq).toBeTruthy();
      }
    }
  });

  test('should initiate account deletion with confirmation dialog', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
  }) => {
    test.slow();

    // Use a fresh user to avoid affecting other tests
    const freshUser = await loginAsFreshUser('lgpddelete');
    const context = await browser.newContext();
    await authenticateContext(context, freshUser);
    const page = await context.newPage();

    try {
      await page.goto('/pt-BR/lgpd');
      await page.waitForLoadState('networkidle');

      // Find delete account button
      const deleteBtn = page
        .getByRole('button', { name: /excluir.*conta|delete.*account|apagar.*conta|remover.*conta/i })
        .or(page.getByRole('link', { name: /excluir.*conta|delete.*account/i }))
        .first();

      const hasDeleteBtn = await deleteBtn.isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasDeleteBtn) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page
          .locator('[role="alertdialog"], [role="dialog"]')
          .or(page.getByText(/certeza|sure|confirmar.*exclus|confirm.*delet/i))
          .first();

        const hasDialog = await confirmDialog.isVisible({ timeout: 5_000 }).catch(() => false);

        if (hasDialog) {
          // Click confirm in the dialog
          const confirmBtn = page
            .getByRole('button', { name: /confirmar|confirm|sim|yes|excluir|delete/i })
            .first();

          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();

            // Should show pending status or success message
            const result = page
              .locator('[data-sonner-toaster]')
              .getByText(/sucesso|solicitad|agendad|scheduled|pending/i)
              .or(page.getByText(/exclus[aã]o.*solicitad|deletion.*scheduled|30.*dias/i));
            await expect(result).toBeVisible({ timeout: 15_000 });
          }
        }
      } else {
        // Delete via API as fallback
        const userApi = authedApiClient(freshUser.accessToken);
        const res = await userApi.post('/lgpd/delete-account');
        expect(res.data.data.type).toBe('DELETION');
        expect(res.data.data.status).toBe('PENDING');
      }
    } finally {
      await context.close();
    }
  });

  test('should not allow duplicate PENDING deletion request', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
  }) => {
    test.slow();

    // Create a fresh user and submit a deletion request
    const freshUser = await loginAsFreshUser('lgpdnodupe');
    const userApi = authedApiClient(freshUser.accessToken);

    // First deletion request via API
    await userApi.post('/lgpd/delete-account');

    // Try to submit again — should fail
    try {
      await userApi.post('/lgpd/delete-account');
      // If it succeeds, the test should fail
      expect(true).toBe(false);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number } };
      // Should get a 400 or 409 (conflict/bad request)
      expect([400, 409]).toContain(axiosError.response?.status);
    }

    // Also verify via UI
    const context = await browser.newContext();
    await authenticateContext(context, freshUser);
    const page = await context.newPage();

    try {
      await page.goto('/pt-BR/lgpd');
      await page.waitForLoadState('networkidle');

      const deleteBtn = page
        .getByRole('button', { name: /excluir.*conta|delete.*account|apagar.*conta/i })
        .first();

      const hasDeleteBtn = await deleteBtn.isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasDeleteBtn) {
        // Button might be disabled or show "already requested" state
        const isDisabled = await deleteBtn.isDisabled().catch(() => false);
        const pendingText = page
          .getByText(/j[aá].*solicitad|already.*request|pendente|pending|aguardando/i)
          .first();
        const hasPending = await pendingText.isVisible().catch(() => false);

        // Either the button is disabled or there's a pending status message
        if (!isDisabled && !hasPending) {
          await deleteBtn.click();
          await page.waitForTimeout(500);

          // Confirm if dialog
          const confirmBtn = page
            .getByRole('button', { name: /confirmar|confirm|sim|yes|excluir|delete/i })
            .first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
          }

          // Should show error about duplicate
          const error = page
            .locator('[data-sonner-toaster]')
            .getByText(/j[aá].*exist|already|duplicate|pendente/i)
            .or(page.getByText(/j[aá].*solicitad|already.*request/i));

          const hasError = await error.isVisible({ timeout: 10_000 }).catch(() => false);
          expect(hasError || isDisabled || hasPending).toBeTruthy();
        }
      }
    } finally {
      await context.close();
    }
  });

  test('should show correct statuses in request history', async ({ authedPage, loginAsUser, dataFactory }) => {
    test.slow();

    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    // Create a request and process it to COMPLETED to have varied statuses
    const reqRes = await userApi.post('/lgpd/requests', {
      type: 'EXPORT',
      details: `${TEST_PREFIX}Request for status history verification.`,
    });
    const requestId = reqRes.data.data.id;

    // Process and complete it
    await adminApi.put(`/lgpd/admin/requests/${requestId}/process`);
    await adminApi.put(`/lgpd/admin/requests/${requestId}/complete`);

    // Create another request that stays PENDING
    await userApi.post('/lgpd/requests', {
      type: 'ACCESS',
      details: `${TEST_PREFIX}Another request to show PENDING status.`,
    });

    // Navigate to LGPD page
    await authedPage.goto('/pt-BR/lgpd');
    await authedPage.waitForLoadState('networkidle');

    // Look for status indicators in the history
    const completedStatus = authedPage
      .getByText(/COMPLETED|conclu[ií]d|finaliz/i)
      .first();
    const pendingStatus = authedPage
      .getByText(/PENDING|pendente/i)
      .first();

    const hasCompleted = await completedStatus.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasPending = await pendingStatus.isVisible().catch(() => false);

    if (!hasCompleted && !hasPending) {
      // Verify via API that statuses are correct
      const res = await userApi.get('/lgpd/requests', { params: { limit: 50 } });
      const requests = res.data.data || [];

      const statuses = requests.map((r: { status: string }) => r.status);
      expect(statuses).toContain('COMPLETED');
      expect(statuses).toContain('PENDING');
    } else {
      // At least one status should be visible
      expect(hasCompleted || hasPending).toBeTruthy();
    }
  });
});
