import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin User management page (/admin/users).
 *
 * Real UI structure (admin-user-management.tsx):
 * - Search input "Buscar por nome ou email..." with "Buscar" button
 * - Role filter Select (Todos, Usuario, Assinante, Admin) with "Cargo:" label
 * - Table columns: Nome, Email, Cargo, Cadastro, Acoes
 * - Action buttons per row (icon-only 8x8 ghost buttons):
 *   - ExternalLink icon → link to /admin/users/:id
 *   - Shield icon → opens role change Dialog (title="Alterar cargo")
 *   - UserX icon → opens suspend Dialog (title="Suspender") — NOT for ADMIN role
 *   - UserCheck icon → unsuspend directly (title="Remover suspensao") — only for USER role
 * - Role change Dialog: Select combobox for new role + "Confirmar" button
 * - Suspend Dialog: Textarea for reason + "Suspender" button
 */
export class AdminUsersPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly roleFilter: Locator;
  readonly usersTable: Locator;
  readonly userRows: Locator;
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  // --- Suspend dialog ---

  readonly suspendDialog: Locator;
  readonly suspendReasonTextarea: Locator;
  readonly suspendConfirmButton: Locator;

  // --- Role change dialog ---

  readonly roleChangeDialog: Locator;
  readonly roleChangeSelect: Locator;
  readonly roleChangeConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.searchInput = page.getByPlaceholder(/Buscar por nome ou email|buscar/i);
    this.searchButton = page.getByRole('button', { name: /Buscar/i }).first();
    // Role filter is a Select combobox
    this.roleFilter = page.locator('button[role="combobox"]').first();
    this.usersTable = page.locator('table').first();
    this.userRows = page.locator('table tbody tr');
    this.pagination = page.locator('nav[aria-label*="pagina" i]');
    this.prevPageButton = page.getByRole('button', { name: /Anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /Pr[oó]xima/i });
    this.loadingSpinner = page.locator('.animate-spin');
    this.emptyState = page.getByText(/nenhum usu[aá]rio|sem usu[aá]rios/i);

    // Suspend dialog (title contains "Suspender")
    this.suspendDialog = page.locator('[role="dialog"]').filter({
      hasText: /Suspender/i,
    });
    this.suspendReasonTextarea = this.suspendDialog.locator('textarea').first();
    this.suspendConfirmButton = this.suspendDialog.getByRole('button', {
      name: /Suspender/i,
    });

    // Role change dialog (title contains "Alterar Cargo")
    this.roleChangeDialog = page.locator('[role="dialog"]').filter({
      hasText: /Alterar.*Cargo/i,
    });
    this.roleChangeSelect = this.roleChangeDialog.locator('button[role="combobox"]').first();
    this.roleChangeConfirmButton = this.roleChangeDialog.getByRole('button', {
      name: /Confirmar/i,
    });
  }

  /** Navigate to /admin/users */
  async navigate(): Promise<void> {
    await this.goto('/admin/users');
  }

  /** Type a search term and submit */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    const hasBuscarBtn = await this.searchButton.isVisible().catch(() => false);
    if (hasBuscarBtn) {
      await this.searchButton.click();
    } else {
      await this.searchInput.press('Enter');
    }
    await this.page.waitForTimeout(500);
    await this.waitForLoaded();
  }

  /** Filter users by role using the role dropdown */
  async filterByRole(role: string): Promise<void> {
    await this.roleFilter.click();
    await this.page.getByRole('option', { name: new RegExp(role, 'i') }).click();
    await this.waitForLoaded();
  }

  /** Get the user rows locator */
  getUserRows(): Locator {
    return this.userRows;
  }

  /** Get the count of visible user rows */
  async getUserCount(): Promise<number> {
    return this.userRows.count();
  }

  /**
   * Click the detail link (ExternalLink icon) on a user row.
   * @param index - zero-based index of the user row
   */
  async viewUserDetail(index: number): Promise<void> {
    const row = this.userRows.nth(index);
    const detailLink = row.locator('a[href*="/admin/users/"]').first();
    await detailLink.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Suspend a user by clicking the UserX icon button and filling the dialog.
   * @param index - zero-based index of the user row
   * @param reason - Reason for suspension
   */
  async suspendUser(index: number, reason: string): Promise<void> {
    const row = this.userRows.nth(index);
    // UserX icon button has title="Suspender"
    const suspendButton = row.locator('button[title="Suspender"]').first();
    await suspendButton.click();

    await expect(this.suspendDialog).toBeVisible({ timeout: 5_000 });
    await this.suspendReasonTextarea.fill(reason);
    await this.suspendConfirmButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Unsuspend a user by clicking the UserCheck icon button.
   * @param index - zero-based index of the user row
   */
  async unsuspendUser(index: number): Promise<void> {
    const row = this.userRows.nth(index);
    // UserCheck icon button has title="Remover suspensao"
    const unsuspendButton = row.locator('button[title*="suspensao"]').or(
      row.locator('button[title*="Remover"]'),
    ).first();
    await unsuspendButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Change a user's role via the Shield icon button and dialog.
   * @param index - zero-based index of the user row
   * @param newRole - The new role to assign
   */
  async changeRole(index: number, newRole: string): Promise<void> {
    const row = this.userRows.nth(index);
    // Shield icon button has title="Alterar cargo"
    const roleButton = row.locator('button[title="Alterar cargo"]').first();
    await roleButton.click();

    await expect(this.roleChangeDialog).toBeVisible({ timeout: 5_000 });

    await this.roleChangeSelect.click();
    await this.page.getByRole('option', { name: new RegExp(newRole, 'i') }).click();

    await this.roleChangeConfirmButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Assert the users table has at least one user */
  async expectHasUsers(): Promise<void> {
    const count = await this.getUserCount();
    expect(count).toBeGreaterThan(0);
  }
}
