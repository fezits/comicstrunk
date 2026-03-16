import { test, expect } from '../../fixtures';
import { HeaderComponent } from '../../page-objects/header.component';

test.describe('Session Persistence', () => {
  test('should persist session after page reload', async ({ authedPage }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Navigate to the home page to establish session
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Session should still be active -- user avatar visible, no login button
    await header.expectAuthenticated();
  });

  test('should persist session when navigating between pages', async ({ authedPage }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Start on home page
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Navigate to catalog
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');
    await header.expectAuthenticated();

    // Navigate to collection (protected route)
    await page.goto('/pt-BR/collection');
    await page.waitForLoadState('domcontentloaded');
    // Should still be authenticated (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await header.expectAuthenticated();

    // Navigate back to home
    await page.goto('/pt-BR/');
    await page.waitForLoadState('domcontentloaded');
    await header.expectAuthenticated();
  });

  test('should persist session when using browser back button', async ({ authedPage }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Navigate to home page
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Navigate to catalog
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('domcontentloaded');
    await header.expectAuthenticated();

    // Press browser back button
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // Session should still be intact
    await header.expectAuthenticated();
  });

  test('should persist session in a new page within the same context', async ({
    authedPage,
  }) => {
    const page = authedPage;
    const header = new HeaderComponent(page);

    // Establish session on the first page
    await page.goto('/pt-BR/');
    await header.expectAuthenticated();

    // Open a new page in the same browser context (shares cookies)
    const context = page.context();
    const newPage = await context.newPage();
    await newPage.goto('/pt-BR/');
    await newPage.waitForLoadState('domcontentloaded');

    // The new page should also have an authenticated session
    const newHeader = new HeaderComponent(newPage);
    await newHeader.expectAuthenticated();

    await newPage.close();
  });
});
