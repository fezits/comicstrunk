import { test, expect } from '../../fixtures';
import { HeaderComponent } from '../../page-objects/header.component';
import { SidebarComponent } from '../../page-objects/sidebar.component';

test.describe('Navigation Visibility by Auth State', () => {
  test('unauthenticated: header shows login and signup buttons', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const header = new HeaderComponent(page);
    await header.expectUnauthenticated();
  });

  test('authenticated: header shows user avatar, hides login/signup', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/catalog');
    await authedPage.waitForLoadState('domcontentloaded');

    const header = new HeaderComponent(authedPage);
    await header.expectAuthenticated();
  });

  test('unauthenticated: sidebar hides protected nav groups', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(page);

    // Public group should be visible
    await sidebar.expectGroupVisible(/explorar/i);

    // Protected groups should be hidden for unauthenticated users
    await sidebar.expectGroupHidden(/cole[çc][aã]o/i);
    await sidebar.expectGroupHidden(/pedidos/i);
    await sidebar.expectGroupHidden(/conta/i);
    await sidebar.expectGroupHidden(/vendedor/i);
    await sidebar.expectGroupHidden(/administra/i);
  });

  test('authenticated USER: sidebar shows collection/orders/account, hides admin', async ({
    authedPage,
  }) => {
    await authedPage.goto('/pt-BR/catalog');
    await authedPage.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(authedPage);

    // Public group always visible
    await sidebar.expectGroupVisible(/explorar/i);

    // Protected groups visible for authenticated user
    await expect(sidebar.getNavItem(/favoritos/i)).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getNavItem(/meus pedidos/i)).toBeVisible();
    await expect(sidebar.getNavItem(/perfil/i)).toBeVisible();

    // Admin group should be hidden for regular users
    await sidebar.expectGroupHidden(/administra/i);
  });

  test('authenticated ADMIN: sidebar shows all groups including admin', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/catalog');
    await adminPage.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(adminPage);

    // Public group
    await sidebar.expectGroupVisible(/explorar/i);

    // Admin group should be visible for admin users
    await sidebar.expectGroupVisible(/administra/i);
    await expect(sidebar.getNavItem(/painel/i)).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated: public group shows Deals and Contact nav items', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(page);
    await sidebar.expectGroupVisible(/explorar/i);

    // Deals (Ofertas) and Contact (Contato) should be visible in public group
    await expect(sidebar.getNavItem(/ofertas/i)).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getNavItem(/contato/i)).toBeVisible();
  });

  test('authenticated USER: account group shows LGPD nav item', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/catalog');
    await authedPage.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(authedPage);

    // LGPD/Privacidade item should be visible in account group
    await expect(sidebar.getNavItem(/lgpd|privacidade/i)).toBeVisible({ timeout: 10_000 });
  });

  test('authenticated ADMIN: admin group shows new Phase 09/10 nav items', async ({
    adminPage,
  }) => {
    await adminPage.goto('/pt-BR/catalog');
    await adminPage.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(adminPage);
    await sidebar.expectGroupVisible(/administra/i);

    // Phase 09/10 admin nav items
    await expect(sidebar.getNavItem(/ofertas/i)).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getNavItem(/homepage/i)).toBeVisible();
    await expect(sidebar.getNavItem(/documentos legais/i)).toBeVisible();
    await expect(sidebar.getNavItem(/lgpd/i)).toBeVisible();
    await expect(sidebar.getNavItem(/mensagens/i)).toBeVisible();
    await expect(sidebar.getNavItem(/usu[áa]rios/i)).toBeVisible();
  });

  test('authenticated USER: can see Deals link in public group', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/catalog');
    await authedPage.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(authedPage);
    await sidebar.expectGroupVisible(/explorar/i);

    // Deals link should be accessible for authenticated users in public group
    await expect(sidebar.getNavItem(/ofertas/i)).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated: can see Contact link in public group', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(page);
    await sidebar.expectGroupVisible(/explorar/i);

    // Contact link should be visible without auth
    await expect(sidebar.getNavItem(/contato/i)).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar bottom shows login/signup for unauthenticated users', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = new SidebarComponent(page);
    await sidebar.expectBottomAuthButtons();
  });
});
