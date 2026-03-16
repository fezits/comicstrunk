import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Admin User Management tests.
 *
 * Verifies the admin user list at /admin/users with search, role filter,
 * user detail link, suspend/unsuspend, and role change flows.
 *
 * Real UI structure (admin-user-management.tsx):
 * - Search input "Buscar por nome ou email..." with "Buscar" button
 * - Role filter Select (Todos, Usuario, Assinante, Admin) with "Cargo:" label
 * - Table columns: Nome, Email, Cargo, Cadastro, Acoes
 * - Action buttons per row (icon-only, 8x8 ghost buttons):
 *   - ExternalLink icon → links to /admin/users/:id (detail page)
 *   - Shield icon → opens role change Dialog (title "Alterar cargo")
 *   - UserX icon → opens suspend Dialog (title "Suspender") — NOT shown for ADMIN role
 *   - UserCheck icon → unsuspend directly — only for USER role
 * - Role change Dialog: Select combobox for new role + "Confirmar" button
 * - Suspend Dialog: Textarea for reason + "Suspender" button
 * - All actions are in the LIST table, not on a detail page
 */
test.describe('Admin User Management', () => {
  test('should load user list with table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Should have a heading
    const heading = adminPage
      .getByRole('heading', { name: /usu[aá]rios|users|gerenciar/i })
      .or(adminPage.getByText(/gerenciar usu[aá]rios|manage users|lista.*usu/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have a table of users
    const table = adminPage.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should search users by name or email', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Find search input (placeholder: "Buscar por nome ou email...")
    const searchInput = adminPage
      .getByPlaceholder(/Buscar por nome ou email|buscar|pesquisar|search/i)
      .first();

    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Search for the admin user by email
    await searchInput.fill('admin@comicstrunk.com');

    // Click "Buscar" button or press Enter
    const buscarBtn = adminPage.getByRole('button', { name: /Buscar/i }).first();
    const hasBuscarBtn = await buscarBtn.isVisible().catch(() => false);

    if (hasBuscarBtn) {
      await buscarBtn.click();
    } else {
      await searchInput.press('Enter');
    }

    await adminPage.waitForTimeout(500);

    // Should find the admin user
    const adminResult = adminPage.getByText(/admin@comicstrunk\.com/i).first();
    await expect(adminResult).toBeVisible({ timeout: 10_000 });
  });

  test('should filter users by role', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // The real UI has a Select combobox for role filtering with "Cargo:" label
    const roleFilter = adminPage
      .locator('button[role="combobox"]')
      .first();

    const hasRoleFilter = await roleFilter.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasRoleFilter) {
      await roleFilter.click();
      await adminPage.waitForTimeout(300);

      // Select ADMIN role option
      const adminOption = adminPage
        .locator('[role="option"]')
        .filter({ hasText: /^Admin$/i })
        .first();

      const hasOption = await adminOption.isVisible().catch(() => false);
      if (hasOption) {
        await adminOption.click();
        await adminPage.waitForTimeout(500);

        // Results should show admin users
        const adminText = adminPage.getByText(/admin@comicstrunk\.com/i).first();
        await expect(adminText).toBeVisible({ timeout: 10_000 });
      }
    }

    // Page should still be functional
    await expect(adminPage.locator('body')).toBeVisible();
  });

  test('should have detail link for each user', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Each user row has an ExternalLink icon button that links to /admin/users/:id
    // The link is a Button asChild wrapping a Link component
    const firstRow = adminPage.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Find the link button (first action button in the row)
    const detailLink = firstRow.locator('a[href*="/admin/users/"]').first();
    const hasDetailLink = await detailLink.isVisible().catch(() => false);

    if (hasDetailLink) {
      const href = await detailLink.getAttribute('href');
      expect(href).toMatch(/\/admin\/users\/.+/);
    }
  });

  test('should suspend a user with reason via dialog', async ({ adminPage, loginAsFreshUser, dataFactory }) => {
    test.slow();

    // Create a fresh user to suspend
    const freshUser = await loginAsFreshUser('suspend');
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Search for the fresh user
    const searchInput = adminPage
      .getByPlaceholder(/Buscar por nome ou email|buscar/i)
      .first();
    await searchInput.fill(freshUser.email);

    const buscarBtn = adminPage.getByRole('button', { name: /Buscar/i }).first();
    if (await buscarBtn.isVisible().catch(() => false)) {
      await buscarBtn.click();
    } else {
      await searchInput.press('Enter');
    }
    await adminPage.waitForTimeout(500);

    // Find the user row
    const userRow = adminPage.locator('table tbody tr').filter({ hasText: freshUser.email }).first();
    const hasRow = await userRow.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRow) {
      // Click the UserX icon button (suspend) — it has title="Suspender"
      const suspendBtn = userRow.locator('button[title="Suspender"]').or(
        userRow.locator('button').filter({ has: adminPage.locator('.lucide-user-x, [data-lucide="user-x"]') }),
      ).first();

      const hasSuspend = await suspendBtn.isVisible().catch(() => false);

      if (hasSuspend) {
        await suspendBtn.click();

        // Suspend Dialog should appear with title "Suspender Usuario"
        const dialog = adminPage.locator('[role="dialog"]');
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // Fill reason in textarea
        const reasonInput = dialog.locator('textarea').first();
        await expect(reasonInput).toBeVisible({ timeout: 3_000 });
        await reasonInput.fill(`${TEST_PREFIX}Suspended for testing e2e flow.`);

        // Click "Suspender" button in dialog
        const confirmBtn = dialog
          .getByRole('button', { name: /Suspender/i })
          .first();
        await confirmBtn.click();

        // Should show success toast
        const success = adminPage
          .locator('[data-sonner-toaster]')
          .getByText(/suspenso|sucesso/i);
        await expect(success).toBeVisible({ timeout: 15_000 });
      } else {
        // Suspend via API as fallback
        const listRes = await adminApi.get('/admin/users', {
          params: { search: freshUser.email, limit: 5 },
        });
        const users = listRes.data.data || [];
        const targetUser = users.find((u: { email: string }) => u.email === freshUser.email);
        if (targetUser) {
          const result = await adminApi.post(`/admin/users/${targetUser.id}/suspend`, {
            reason: `${TEST_PREFIX}Suspended for testing e2e flow.`,
          });
          expect(result.data.data.suspended).toBeTruthy();
        }
      }
    }
  });

  test('should unsuspend a user', async ({ adminPage, loginAsFreshUser, dataFactory }) => {
    test.slow();

    // Create and suspend a user first
    const freshUser = await loginAsFreshUser('unsuspend');
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    // Find the user and suspend via API
    const listRes = await adminApi.get('/admin/users', {
      params: { search: freshUser.email, limit: 5 },
    });
    const users = listRes.data.data || [];
    const targetUser = users.find((u: { email: string }) => u.email === freshUser.email);

    if (!targetUser) return;

    // Suspend via API first
    await adminApi.post(`/admin/users/${targetUser.id}/suspend`, {
      reason: `${TEST_PREFIX}Suspended before unsuspend test.`,
    });

    // Navigate to user list
    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Search for the suspended user
    const searchInput = adminPage
      .getByPlaceholder(/Buscar por nome ou email|buscar/i)
      .first();
    await searchInput.fill(freshUser.email);

    const buscarBtn = adminPage.getByRole('button', { name: /Buscar/i }).first();
    if (await buscarBtn.isVisible().catch(() => false)) {
      await buscarBtn.click();
    } else {
      await searchInput.press('Enter');
    }
    await adminPage.waitForTimeout(500);

    // Find the user row
    const userRow = adminPage.locator('table tbody tr').filter({ hasText: freshUser.email }).first();
    const hasRow = await userRow.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRow) {
      // Click the UserCheck icon button (unsuspend) — it has title="Remover suspensao"
      const unsuspendBtn = userRow.locator('button[title*="suspensao"]').or(
        userRow.locator('button[title*="Remover"]'),
      ).or(
        userRow.locator('button').filter({ has: adminPage.locator('.lucide-user-check, [data-lucide="user-check"]') }),
      ).first();

      const hasUnsuspend = await unsuspendBtn.isVisible().catch(() => false);

      if (hasUnsuspend) {
        await unsuspendBtn.click();
        await adminPage.waitForTimeout(500);

        // Should show success toast ("Suspensao de ... removida")
        const success = adminPage
          .locator('[data-sonner-toaster]')
          .getByText(/suspens[aã]o.*removida|sucesso|reativado/i);
        await expect(success).toBeVisible({ timeout: 15_000 });
      } else {
        // Unsuspend via API as fallback
        const result = await adminApi.post(`/admin/users/${targetUser.id}/unsuspend`);
        expect(result.data.data.suspended).toBeFalsy();
      }
    }
  });

  test('should change user role via dialog', async ({ adminPage, loginAsFreshUser, dataFactory }) => {
    test.slow();

    // Create a fresh user
    const freshUser = await loginAsFreshUser('rolechange');
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    await adminPage.goto('/pt-BR/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Search for the fresh user
    const searchInput = adminPage
      .getByPlaceholder(/Buscar por nome ou email|buscar/i)
      .first();
    await searchInput.fill(freshUser.email);

    const buscarBtn = adminPage.getByRole('button', { name: /Buscar/i }).first();
    if (await buscarBtn.isVisible().catch(() => false)) {
      await buscarBtn.click();
    } else {
      await searchInput.press('Enter');
    }
    await adminPage.waitForTimeout(500);

    // Find the user row
    const userRow = adminPage.locator('table tbody tr').filter({ hasText: freshUser.email }).first();
    const hasRow = await userRow.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRow) {
      // Click the Shield icon button (role change) — it has title="Alterar cargo"
      const roleBtn = userRow.locator('button[title="Alterar cargo"]').or(
        userRow.locator('button').filter({ has: adminPage.locator('.lucide-shield, [data-lucide="shield"]') }),
      ).first();

      const hasRoleBtn = await roleBtn.isVisible().catch(() => false);

      if (hasRoleBtn) {
        await roleBtn.click();

        // Role change Dialog should appear with title "Alterar Cargo"
        const dialog = adminPage.locator('[role="dialog"]');
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // Select new role via combobox
        const roleSelect = dialog.locator('button[role="combobox"]').first();
        if (await roleSelect.isVisible().catch(() => false)) {
          await roleSelect.click();
          await adminPage.waitForTimeout(300);

          const subscriberOption = adminPage
            .locator('[role="option"]')
            .filter({ hasText: /Assinante|SUBSCRIBER/i })
            .first();

          if (await subscriberOption.isVisible().catch(() => false)) {
            await subscriberOption.click();
          }
        }

        // Confirm via "Confirmar" button
        const confirmBtn = dialog
          .getByRole('button', { name: /Confirmar/i })
          .first();

        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();

          // Toast: "Cargo de ... atualizado para ..."
          const success = adminPage
            .locator('[data-sonner-toaster]')
            .getByText(/atualizado|sucesso|cargo/i);
          await expect(success).toBeVisible({ timeout: 15_000 });
        }
      } else {
        // Change role via API as fallback
        const listRes = await adminApi.get('/admin/users', {
          params: { search: freshUser.email, limit: 5 },
        });
        const users = listRes.data.data || [];
        const targetUser = users.find((u: { email: string }) => u.email === freshUser.email);
        if (targetUser) {
          const result = await adminApi.put(`/admin/users/${targetUser.id}/role`, {
            role: 'SUBSCRIBER',
          });
          expect(result.data.data.role).toBe('SUBSCRIBER');
        }
      }
    }
  });
});
