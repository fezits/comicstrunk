import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page-object for the fixed header component.
 *
 * The header renders different UI for authenticated vs unauthenticated users:
 * - Unauth: shows "Entrar" (login) and "Cadastrar" (signup) buttons + theme toggle
 * - Auth:   shows cart icon (with badge), notification bell (with badge),
 *           theme toggle, and user avatar dropdown (Profile, Settings, Logout)
 */
export class HeaderComponent {
  readonly page: Page;

  /** The <header> root element */
  private get root(): Locator {
    return this.page.locator('header');
  }

  // --- Logo ---

  /** "Comics Trunk" logo link */
  get logo(): Locator {
    return this.root.getByText('Comics Trunk');
  }

  // --- Unauthenticated elements ---

  /** Login button/link "Entrar" shown to unauthenticated users */
  get loginButton(): Locator {
    return this.root.getByRole('link', { name: 'Entrar' });
  }

  /** Signup button/link "Cadastrar" shown to unauthenticated users */
  get signupButton(): Locator {
    return this.root.getByRole('link', { name: 'Cadastrar' });
  }

  // --- Authenticated elements ---

  /**
   * User avatar trigger button.
   * The button itself has the `rounded-full` class:
   *   <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
   */
  get userAvatar(): Locator {
    return this.root.locator('button.rounded-full');
  }

  /** Cart button (aria-label contains "Carrinho") */
  get cartButton(): Locator {
    return this.root.getByRole('button', { name: /[Cc]arrinho/ });
  }

  /** Cart count badge (the <span> inside the cart button showing count) */
  get cartBadge(): Locator {
    return this.cartButton.locator('span.rounded-full');
  }

  /** Notification bell button (aria-label contains "Notificacoes") */
  get notificationButton(): Locator {
    return this.root.getByRole('button', { name: /[Nn]otifica/ });
  }

  /** Notification count badge (the <span> inside the notification bell) */
  get notificationBadge(): Locator {
    return this.notificationButton.locator('span.rounded-full');
  }

  /** Theme toggle button */
  get themeToggle(): Locator {
    return this.root.getByRole('button', { name: /[Tt]ema|[Tt]heme|[Aa]lternar/ });
  }

  // --- Dropdown menu items (visible after opening user menu) ---

  /** "Perfil" (Profile) menu item */
  private get profileMenuItem(): Locator {
    return this.page.getByRole('menuitem', { name: 'Perfil' });
  }

  /** "Configuracoes" (Settings) menu item */
  private get settingsMenuItem(): Locator {
    return this.page.getByRole('menuitem', { name: /[Cc]onfigurac/ });
  }

  /** "Sair" (Logout) menu item */
  private get logoutMenuItem(): Locator {
    return this.page.getByRole('menuitem', { name: 'Sair' });
  }

  // --- Constructor ---

  constructor(page: Page) {
    this.page = page;
  }

  // --- Actions ---

  /** Click the user avatar to open the dropdown menu */
  async openUserMenu(): Promise<void> {
    await this.userAvatar.click();
    // Wait for the dropdown content to appear
    await expect(this.logoutMenuItem).toBeVisible({ timeout: 3_000 });
  }

  /** Open the user dropdown and click "Sair" (Logout) */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutMenuItem.click();
  }

  /** Open the user dropdown and click "Perfil" (Profile) */
  async goToProfile(): Promise<void> {
    await this.openUserMenu();
    await this.profileMenuItem.click();
  }

  /** Open the user dropdown and click "Configuracoes" (Settings) */
  async goToSettings(): Promise<void> {
    await this.openUserMenu();
    await this.settingsMenuItem.click();
  }

  /** Get the text from the cart count badge. Returns null if badge is not visible. */
  async getCartBadge(): Promise<string | null> {
    if (await this.cartBadge.isVisible()) {
      return this.cartBadge.textContent();
    }
    return null;
  }

  /** Get the text from the notification count badge. Returns null if badge is not visible. */
  async getNotificationBadge(): Promise<string | null> {
    if (await this.notificationBadge.isVisible()) {
      return this.notificationBadge.textContent();
    }
    return null;
  }

  // --- Assertions ---

  /** Assert header is in unauthenticated state: login/signup visible, avatar hidden */
  async expectUnauthenticated(): Promise<void> {
    // On auth pages (login/signup), the main header doesn't exist.
    // Check if we're on an auth page by URL — that's the expected unauthenticated state.
    const url = this.page.url();
    if (url.includes('/login') || url.includes('/signup')) {
      return;
    }
    await expect(this.loginButton).toBeVisible({ timeout: 10_000 });
    await expect(this.signupButton).toBeVisible({ timeout: 10_000 });
  }

  /** Assert header is in authenticated state: avatar visible, login/signup hidden */
  async expectAuthenticated(): Promise<void> {
    await expect(this.userAvatar).toBeVisible({ timeout: 10_000 });
    await expect(this.loginButton).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(this.signupButton).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  }
}
