import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Admin Legal Documents tests.
 *
 * Verifies the admin legal documents management page at /admin/legal:
 * list, create new document, version history, and mandatory badge.
 *
 * Real UI structure (admin-legal-documents.tsx):
 * - Table grouped by type (latest version per type)
 * - Columns: Tipo, Versao, Data de Vigencia, Obrigatorio, Atualizado em, Acoes
 * - "Novo Documento" button to create via Dialog
 * - "Historico" button per row to view version history via Dialog
 * - Mandatory shown as "Sim"/"Nao" badges
 * - NO type filter dropdown
 * - Document types: TERMS_OF_SERVICE, PRIVACY_POLICY, COOKIE_POLICY,
 *   MARKETPLACE_TERMS, RETURN_POLICY, SELLER_AGREEMENT, SUBSCRIPTION_TERMS, DATA_PROCESSING
 */
test.describe('Admin Legal Documents', () => {
  test('should load legal documents page with table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // Should have a heading
    const heading = adminPage
      .getByRole('heading', { name: /legal|documentos|jur[ií]dico/i })
      .or(adminPage.getByText(/documentos legais|legal documents|gerenciar.*documentos/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have a table of documents
    const table = adminPage.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    // Seed data creates legal documents
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should show document type labels in table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // The real UI shows human-readable type labels:
    // "Termos de Servico", "Politica de Privacidade", "Politica de Cookies", etc.
    const typeLabels = [
      /Termos de Servico/i,
      /Politica de Privacidade/i,
    ];

    let foundTypes = 0;
    for (const label of typeLabels) {
      const el = adminPage.getByText(label).first();
      const visible = await el.isVisible({ timeout: 5_000 }).catch(() => false);
      if (visible) foundTypes++;
    }
    // At least some document types should be visible from seed data
    expect(foundTypes).toBeGreaterThanOrEqual(1);
  });

  test('should create a new legal document', async ({ adminPage }) => {
    test.slow();

    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // Click "Novo Documento" button
    const createBtn = adminPage
      .getByRole('button', { name: /novo documento|novo|criar|adicionar/i })
      .first();

    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    // Wait for the create dialog to appear
    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The dialog title should be "Novo Documento Legal"
    const dialogTitle = dialog.getByText(/Novo Documento Legal/i);
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Select document type via the Select combobox
    // The label is "Tipo de documento"
    const typeSelect = dialog.locator('button[role="combobox"]').first();
    await typeSelect.click();
    await adminPage.waitForTimeout(300);

    // Pick RETURN_POLICY (less likely to conflict with mandatory seed docs)
    const option = adminPage
      .locator('[role="option"]')
      .filter({ hasText: /Devolu[cç][aã]o|RETURN_POLICY/i })
      .first();

    if (await option.isVisible().catch(() => false)) {
      await option.click();
    } else {
      // Pick any available option
      const anyOption = adminPage.locator('[role="option"]').first();
      await anyOption.click();
    }

    // Fill content textarea
    const contentInput = dialog.locator('textarea').first();
    await expect(contentInput).toBeVisible({ timeout: 3_000 });
    await contentInput.fill(
      `${TEST_PREFIX}Politica de devolucao criada via teste e2e. ` +
      'Este documento define as regras de devolucao para compras na plataforma Comics Trunk.',
    );

    // Fill date of effect (input[type="date"])
    const dateInput = dialog.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];
      await dateInput.fill(dateStr);
    }

    // The mandatory switch is checked by default (formMandatory = true)

    // Submit via "Criar Documento" button
    const submitBtn = dialog
      .getByRole('button', { name: /criar documento|criar|salvar/i })
      .first();
    await submitBtn.click();

    // Should show success toast
    const success = adminPage
      .locator('[data-sonner-toaster]')
      .getByText(/criado.*sucesso|sucesso|documento.*criado/i);
    await expect(success).toBeVisible({ timeout: 15_000 });
  });

  test('should view version history for a document type', async ({ adminPage, dataFactory }) => {
    test.slow();

    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    // Verify version history exists via API
    const historyRes = await adminApi.get('/legal/admin/history/TERMS_OF_SERVICE');
    const history = historyRes.data.data || [];
    expect(Array.isArray(history)).toBeTruthy();
    expect(history.length).toBeGreaterThanOrEqual(1);

    // Navigate to admin legal page
    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // Each row has a "Historico" button (ghost variant with History icon)
    const historyBtn = adminPage
      .getByRole('button', { name: /hist[oó]rico/i })
      .first();

    await expect(historyBtn).toBeVisible({ timeout: 10_000 });
    await historyBtn.click();

    // A history dialog should appear
    const historyDialog = adminPage.locator('[role="dialog"]');
    await expect(historyDialog).toBeVisible({ timeout: 5_000 });

    // Should show version entries (e.g. "v1", "v2" badges or version text)
    const versionEntry = historyDialog
      .getByText(/v\d|vers[aã]o/i)
      .first();
    await expect(versionEntry).toBeVisible({ timeout: 10_000 });
  });

  test('should show mandatory badges (Sim/Nao) for documents', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // The real UI shows "Sim" badge (green) for mandatory and "Nao" badge for non-mandatory
    // in the "Obrigatorio" column of the table
    const simBadge = adminPage.getByText('Sim', { exact: true }).first();
    const naoBadge = adminPage.getByText('Nao', { exact: true }).first();

    const hasSim = await simBadge.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasNao = await naoBadge.isVisible({ timeout: 5_000 }).catch(() => false);

    // At least one mandatory indicator should be visible
    expect(hasSim || hasNao).toBeTruthy();

    if (hasSim) {
      // Count "Sim" badges — seed data should have several mandatory docs
      const simBadges = adminPage.getByText('Sim', { exact: true });
      const simCount = await simBadges.count();
      expect(simCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('should show table headers matching real UI columns', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/legal');
    await adminPage.waitForLoadState('networkidle');

    // The table has these headers: Tipo, Versao, Data de Vigencia, Obrigatorio, Atualizado em, Acoes
    const headers = adminPage.locator('table thead th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(4);

    // Verify at least some key headers
    const tipoHeader = adminPage.locator('table thead th').filter({ hasText: /Tipo/i });
    await expect(tipoHeader).toBeVisible({ timeout: 5_000 });
  });
});
