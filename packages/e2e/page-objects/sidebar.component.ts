import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page-object for the desktop sidebar component (<aside>).
 *
 * The sidebar has 6 nav groups, each with a collapsible heading (uppercase label):
 *   - "Explorar"       (public, always visible)
 *   - "Minha Colecao"  (requiresAuth)
 *   - "Pedidos"         (requiresAuth)
 *   - "Conta"           (requiresAuth)
 *   - "Vendedor"        (requiresAuth)
 *   - "Administracao"   (adminOnly + requiresAuth)
 *
 * Bottom section:
 *   - When unauthenticated: "Entrar" and "Cadastrar" buttons
 *   - When authenticated: user info card (avatar initial, name, email) + "Sair" button
 *
 * NOTE: The sidebar is only visible on desktop (lg: breakpoint, >=1024px).
 */
export class SidebarComponent {
  readonly page: Page;

  /** The <aside> root element */
  private get root(): Locator {
    return this.page.locator('aside');
  }

  // --- Constructor ---

  constructor(page: Page) {
    this.page = page;
  }

  // --- Group locators ---

  /**
   * Get the nav group heading button by its label text.
   * Group headings are <button> elements with uppercase text-xs styling.
   */
  getGroupHeading(groupLabel: string | RegExp): Locator {
    return this.root.locator('button').filter({ hasText: groupLabel });
  }

  // --- Nav item locators ---

  /**
   * Get a nav item link by its text.
   * Nav items are <a> elements with text rendered via i18n.
   */
  getNavItem(itemText: string | RegExp): Locator {
    return this.root.getByRole('link', { name: itemText });
  }

  // --- Bottom section locators ---

  /** Login button in the bottom auth section (for unauthenticated users) */
  get bottomLoginButton(): Locator {
    return this.root.getByRole('link', { name: 'Entrar' });
  }

  /** Signup button in the bottom auth section (for unauthenticated users) */
  get bottomSignupButton(): Locator {
    return this.root.getByRole('link', { name: 'Cadastrar' });
  }

  /** Logout button "Sair" in the bottom section (for authenticated users) */
  get bottomLogoutButton(): Locator {
    return this.root.getByRole('button', { name: 'Sair' });
  }

  /** User name text in the bottom user info card */
  get bottomUserName(): Locator {
    return this.root.locator('.mt-auto p.font-medium');
  }

  /** User email text in the bottom user info card */
  get bottomUserEmail(): Locator {
    return this.root.locator('.mt-auto p.text-muted-foreground').first();
  }

  // --- Actions ---

  /** Click a nav item by its text */
  async clickNavItem(itemText: string | RegExp): Promise<void> {
    await this.getNavItem(itemText).click();
  }

  /** Toggle a nav group open/closed by clicking its heading */
  async toggleGroup(groupLabel: string | RegExp): Promise<void> {
    await this.getGroupHeading(groupLabel).click();
  }

  // --- Assertions ---

  /** Assert that a nav group heading is visible */
  async expectGroupVisible(groupLabel: string | RegExp): Promise<void> {
    await expect(this.getGroupHeading(groupLabel)).toBeVisible();
  }

  /** Assert that a nav group heading is NOT visible (hidden for unauth/non-admin users) */
  async expectGroupHidden(groupLabel: string | RegExp): Promise<void> {
    await expect(this.getGroupHeading(groupLabel)).not.toBeVisible();
  }

  /**
   * Assert that a nav item appears as active/selected.
   * Active items have the CSS class `bg-primary/10` and `text-primary`.
   */
  async expectActiveItem(itemText: string | RegExp): Promise<void> {
    const item = this.getNavItem(itemText);
    await expect(item).toBeVisible();
    await expect(item).toHaveClass(/bg-primary/);
  }

  /** Assert that the bottom section shows login/signup buttons (unauthenticated state) */
  async expectBottomAuthButtons(): Promise<void> {
    await expect(this.bottomLoginButton).toBeVisible();
    await expect(this.bottomSignupButton).toBeVisible();
  }

  /** Assert that the bottom section shows user info (authenticated state) */
  async expectBottomUserInfo(): Promise<void> {
    // The authenticated bottom section has the user avatar initial + name/email
    // and a "Sair" (logout) button
    await expect(this.bottomLogoutButton).toBeVisible();
    // Verify user info card is present (avatar initial div)
    const avatarInitial = this.root.locator('.mt-auto div.rounded-full');
    await expect(avatarInitial).toBeVisible();
  }
}
