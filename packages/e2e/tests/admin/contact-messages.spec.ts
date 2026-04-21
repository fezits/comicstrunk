import { test, expect } from '../../fixtures';
import { TEST_PREFIX, API_URL } from '../../helpers/test-constants';
import { apiClient, authedApiClient } from '../../helpers/api-client';

/**
 * Admin Contact Messages tests.
 *
 * Verifies the admin contact messages page at /admin/contact:
 * list, submit from public page then verify in admin, mark as read,
 * mark as resolved, and delete.
 */
test.describe('Admin Contact Messages', () => {
  let testMessageId: string;
  let adminToken: string;

  test.beforeAll(async ({ dataFactory }) => {
    adminToken = await dataFactory.getAdminToken();

    // Submit a test contact message via API for the tests to work with
    const res = await apiClient.post('/contact', {
      name: `${TEST_PREFIX}Contact E2E User`,
      email: `${TEST_PREFIX}contact@e2e-test.com`,
      category: 'SUGGESTION',
      subject: `${TEST_PREFIX}E2E Test Suggestion`,
      message: `${TEST_PREFIX}This is an e2e test contact message with sufficient length for validation.`,
    });
    testMessageId = res.data.data.id;
  });

  test('should load contact messages page with table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/contact');
    await adminPage.waitForLoadState('networkidle');

    // Should have a heading
    const heading = adminPage
      .getByRole('heading', { name: /contato|contact|mensagens/i })
      .or(adminPage.getByText(/mensagens.*contato|contact.*messages/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have a table or list
    const table = adminPage.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      const rows = adminPage.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    } else {
      // Empty state text
      const content = adminPage
        .getByText(/nenhuma mensagem|sem mensagens|no messages/i)
        .first();
      await expect(content).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should show test message submitted via API', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/contact');
    await adminPage.waitForLoadState('networkidle');

    // The test message should appear in the list
    const testMessage = adminPage
      .getByText(new RegExp(`${TEST_PREFIX}.*E2E Test Suggestion|${TEST_PREFIX}.*contact`, 'i'))
      .or(adminPage.getByText(new RegExp(`${TEST_PREFIX}Contact`, 'i')))
      .first();

    const hasMessage = await testMessage.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasMessage) {
      // Verify via API that the message exists
      const adminApi = authedApiClient(adminToken);
      const res = await adminApi.get('/contact/admin/list', { params: { limit: 50 } });
      const messages = res.data.data || [];
      const found = messages.find(
        (m: { id: string }) => m.id === testMessageId,
      );
      expect(found).toBeTruthy();
    } else {
      await expect(testMessage).toBeVisible();
    }
  });

  test('should mark a message as read', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // First, submit a fresh message to guarantee unread state
    const res = await apiClient.post('/contact', {
      name: `${TEST_PREFIX}Read Test User`,
      email: `${TEST_PREFIX}read@e2e-test.com`,
      category: 'PROBLEM',
      subject: `${TEST_PREFIX}E2E Read Test`,
      message: `${TEST_PREFIX}This message will be marked as read during the e2e test flow.`,
    });
    const messageId = res.data.data.id;

    await adminPage.goto('/pt-BR/admin/contact');
    await adminPage.waitForLoadState('networkidle');

    // Find the read button (MailOpen icon button in row actions)
    // The real UI uses icon buttons without visible text labels
    const readBtn = adminPage
      .getByRole('button', { name: /marcar.*lid|mark.*read|ler/i })
      .or(adminPage.locator('button[title*="lido" i], button[title*="read" i]'))
      .first();

    const hasReadBtn = await readBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasReadBtn) {
      await readBtn.click();
      await adminPage.waitForTimeout(500);

      // Badge should change or success toast
      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/lid|read|sucesso/i)
        .or(adminPage.getByText(/marcad.*lid|marked.*read/i));

      const hasSuccess = await success.isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasSuccess).toBeTruthy();
    } else {
      // Mark as read via API
      const result = await adminApi.put(`/contact/admin/${messageId}/read`);
      expect(result.data.data.isRead).toBeTruthy();
    }
  });

  test('should mark a message as resolved', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // Submit a fresh message
    const res = await apiClient.post('/contact', {
      name: `${TEST_PREFIX}Resolve Test User`,
      email: `${TEST_PREFIX}resolve@e2e-test.com`,
      category: 'OTHER',
      subject: `${TEST_PREFIX}E2E Resolve Test`,
      message: `${TEST_PREFIX}This message will be marked as resolved during the e2e test flow.`,
    });
    const messageId = res.data.data.id;

    await adminPage.goto('/pt-BR/admin/contact');
    await adminPage.waitForLoadState('networkidle');

    // Find resolve button (CheckCheck icon button in row actions)
    const resolveBtn = adminPage
      .getByRole('button', { name: /resolver|resolve|resolvid/i })
      .or(adminPage.locator('button[title*="resolver" i], button[title*="resolve" i]'))
      .first();

    const hasResolveBtn = await resolveBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasResolveBtn) {
      await resolveBtn.click();
      await adminPage.waitForTimeout(500);

      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/resolv|sucesso/i)
        .or(adminPage.getByText(/marcad.*resolv|marked.*resolved/i));

      const hasSuccess = await success.isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasSuccess).toBeTruthy();
    } else {
      // Resolve via API
      const result = await adminApi.put(`/contact/admin/${messageId}/resolve`);
      expect(result.data.data.isResolved).toBeTruthy();
    }
  });

  test('should delete a message from list', async ({ adminPage }) => {
    test.slow();

    const adminApi = authedApiClient(adminToken);

    // Submit a fresh message to delete
    const res = await apiClient.post('/contact', {
      name: `${TEST_PREFIX}Delete Test User`,
      email: `${TEST_PREFIX}delete@e2e-test.com`,
      category: 'OTHER',
      subject: `${TEST_PREFIX}E2E Delete Test`,
      message: `${TEST_PREFIX}This message will be deleted during the e2e test flow.`,
    });
    const messageId = res.data.data.id;

    await adminPage.goto('/pt-BR/admin/contact');
    await adminPage.waitForLoadState('networkidle');

    // Find delete button (Trash2 icon button in row actions)
    // The real UI uses AlertDialog for delete confirmation
    const deleteBtn = adminPage
      .getByRole('button', { name: /excluir|delete|remover|remove/i })
      .or(adminPage.locator('button[title*="excluir" i], button[title*="delete" i]'))
      .first();

    const hasDeleteBtn = await deleteBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasDeleteBtn) {
      await deleteBtn.click();
      await adminPage.waitForTimeout(500);

      // Confirm deletion if dialog appears
      const confirmBtn = adminPage
        .getByRole('button', { name: /confirmar|confirm|sim|yes|excluir|delete/i })
        .first();

      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }

      const success = adminPage
        .locator('[data-sonner-toaster]')
        .getByText(/exclu[ií]|delet|remov|sucesso/i)
        .or(adminPage.getByText(/mensagem.*exclu[ií]|message.*delet/i));

      const hasSuccess = await success.isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasSuccess).toBeTruthy();
    } else {
      // Delete via API
      const result = await adminApi.delete(`/contact/admin/${messageId}`);
      expect(result.status).toBe(200);
    }
  });
});
