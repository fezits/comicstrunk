import { test, expect } from '../../fixtures';
import { SidebarComponent } from '../../page-objects/sidebar.component';

/**
 * Admin Dashboard tests.
 *
 * Verifies the admin dashboard at /admin loads correctly, displays
 * KPI metric cards, quick action links, and hides admin nav for
 * non-admin users.
 */
test.describe('Admin Dashboard', () => {
  test('should load dashboard page with heading', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin');
    await adminPage.waitForLoadState('networkidle');

    // The page has an <h1> "Painel Administrativo" and an <h2> "Acoes rapidas"
    // Target the h1 specifically to avoid ambiguity
    const heading = adminPage.locator('h1', { hasText: /Painel Administrativo/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should show KPI metric cards', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin');
    await adminPage.waitForLoadState('networkidle');

    // The dashboard displays 8 KPI cards in a grid. Each card is a shadcn Card
    // with a CardTitle (text-sm label) and a text-2xl bold value.
    // Card labels: "Usuarios totais", "Novos este mes", "Pedidos hoje",
    // "Receita do mes", "Catalogo aprovado", "Aprovacoes pendentes",
    // "Disputas ativas", "Mensagens nao lidas"
    const metricLabels = [
      'Usuarios totais',
      'Novos este mes',
      'Pedidos hoje',
      'Receita do mes',
      'Catalogo aprovado',
      'Aprovacoes pendentes',
      'Disputas ativas',
      'Mensagens nao lidas',
    ];

    let matchCount = 0;
    for (const label of metricLabels) {
      const el = adminPage.getByText(label, { exact: false }).first();
      const visible = await el.isVisible({ timeout: 10_000 }).catch(() => false);
      if (visible) matchCount++;
    }
    expect(matchCount).toBeGreaterThanOrEqual(4);
  });

  test('should display numeric values in metric cards', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin');
    await adminPage.waitForLoadState('networkidle');

    // Wait for loading to finish (skeleton placeholders disappear)
    await adminPage.waitForTimeout(2_000);

    // Each KPI card has a .text-2xl.font-bold element containing the numeric value.
    // Look for these bold value elements within the KPI grid.
    const kpiGrid = adminPage.locator('.grid').first();
    await expect(kpiGrid).toBeVisible({ timeout: 10_000 });

    // The numeric values are in div.text-2xl.font-bold inside CardContent
    const numericValues = kpiGrid.locator('.text-2xl.font-bold');
    const count = await numericValues.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify at least one has a numeric-looking text (digit or R$ currency)
    const firstText = await numericValues.first().textContent();
    expect(firstText).toBeTruthy();
    expect(firstText).toMatch(/\d/);
  });

  test('should have quick action links to admin sub-pages', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin');
    await adminPage.waitForLoadState('networkidle');

    // The dashboard has an "Acoes rapidas" section with links to admin sub-pages
    const quickActionsHeading = adminPage.locator('h2', { hasText: /Acoes rapidas/i });
    await expect(quickActionsHeading).toBeVisible({ timeout: 10_000 });

    // Quick action links: "Gerenciar Usuarios", "Catalogo", "Disputas",
    // "Pagamentos", "Documentos Legais", "Solicitacoes LGPD",
    // "Mensagens de Contato", "Assinaturas"
    const quickActionPatterns = [
      { name: /Gerenciar Usuarios/i, path: 'users' },
      { name: /Documentos Legais/i, path: 'legal' },
      { name: /Mensagens de Contato/i, path: 'contact' },
      { name: /Solicitacoes LGPD/i, path: 'lgpd' },
    ];

    let foundNavLinks = 0;

    for (const { name } of quickActionPatterns) {
      const link = adminPage.getByRole('link', { name }).first();
      const isVisible = await link.isVisible().catch(() => false);
      if (isVisible) {
        foundNavLinks++;
      }
    }

    expect(foundNavLinks).toBeGreaterThanOrEqual(2);
  });

  test('should hide admin nav group for non-admin user on /admin', async ({ authedPage }) => {
    // Non-admin users CAN access /admin but they see a simplified dashboard
    // without the "Administracao" sidebar navigation group.
    await authedPage.goto('/pt-BR/admin');
    await authedPage.waitForLoadState('networkidle');

    // The page should load (no redirect)
    await expect(authedPage.locator('body')).toBeVisible();

    // The sidebar "Administracao" group should NOT be visible for non-admin users
    const sidebar = new SidebarComponent(authedPage);
    await sidebar.expectGroupHidden(/Administra/i);
  });
});
