import { test, expect } from '../../fixtures';
import { HeaderComponent } from '../../page-objects/header.component';

test.describe('Logout Flow', () => {
  test('should logout via user menu and redirect to login', async ({ authedPage }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Navigate to a page to ensure session is loaded
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Perform logout via header dropdown
    await header.logout();

    // Should redirect to login page
    await page.waitForURL('**/pt-BR/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Header should show unauthenticated state (login/signup buttons)
    await header.expectUnauthenticated();
  });

  test('should redirect to login when accessing protected route after logout', async ({
    authedPage,
  }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Start on a page so the session is established
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Logout
    await header.logout();
    await page.waitForURL('**/pt-BR/login', { timeout: 10_000 });

    // Try accessing a protected route (collection)
    await page.goto('/pt-BR/collection');

    // Should be redirected back to login
    await page.waitForURL('**/pt-BR/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should stay logged out after page reload post-logout', async ({ authedPage }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Establish session
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Logout
    await header.logout();
    await page.waitForURL('**/pt-BR/login', { timeout: 10_000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should still be on login page (session was cleared)
    await expect(page).toHaveURL(/\/login/);
    await header.expectUnauthenticated();
  });
});
