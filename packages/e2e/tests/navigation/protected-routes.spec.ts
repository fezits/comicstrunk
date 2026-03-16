import { test, expect } from '../../fixtures';

test.describe('Protected Route Redirects', () => {
  test.describe('unauthenticated users are redirected to /login', () => {
    // These routes exist under (collector), (orders), (admin), or (seller)
    // layouts that use RequireAuth, which client-side redirects to /login.
    const protectedRoutes = [
      { path: '/pt-BR/collection', label: '/collection' },
      { path: '/pt-BR/orders', label: '/orders' },
      { path: '/pt-BR/favorites', label: '/favorites' },
      { path: '/pt-BR/admin', label: '/admin' },
      { path: '/pt-BR/seller/banking', label: '/seller/banking' },
    ];

    for (const route of protectedRoutes) {
      test(`redirects ${route.label} to /login`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      });
    }
  });

  test.describe('additional protected routes redirect correctly', () => {
    // Only routes that have actual page files under protected layouts.
    // Removed /cart, /profile, /settings — they have no page files and show 404.
    const additionalRoutes = [
      { path: '/pt-BR/collection/series-progress', label: '/collection/series-progress' },
      { path: '/pt-BR/payments/history', label: '/payments/history' },
      { path: '/pt-BR/subscription', label: '/subscription' },
      { path: '/pt-BR/notifications', label: '/notifications' },
      { path: '/pt-BR/notifications/preferences', label: '/notifications/preferences' },
      { path: '/pt-BR/lgpd', label: '/lgpd' },
    ];

    for (const route of additionalRoutes) {
      test(`redirects ${route.label} to /login`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      });
    }
  });

  test.describe('routes without page files show 404', () => {
    // These routes have no corresponding page.tsx file, so they render
    // the Next.js 404 page instead of redirecting to login.
    const notFoundRoutes = [
      { path: '/pt-BR/cart', label: '/cart' },
      { path: '/pt-BR/profile', label: '/profile' },
      { path: '/pt-BR/settings', label: '/settings' },
    ];

    for (const route of notFoundRoutes) {
      test(`${route.label} shows 404 (no page exists)`, async ({ page }) => {
        const response = await page.goto(route.path);
        // Next.js returns 404 for routes without a matching page file
        expect(response?.status()).toBe(404);
      });
    }
  });

  test('authenticated user can access protected route without redirect', async ({
    authedPage,
  }) => {
    await authedPage.goto('/pt-BR/favorites');
    await authedPage.waitForLoadState('domcontentloaded');

    // Should NOT be redirected to login
    await expect(authedPage).not.toHaveURL(/\/login/);
    // Should stay on the favorites page
    await expect(authedPage).toHaveURL(/\/favorites/);
  });

  test.describe('Phase 09/10 public routes should NOT redirect', () => {
    const publicRoutes = [
      { path: '/pt-BR/deals', label: '/deals' },
      { path: '/pt-BR/contact', label: '/contact' },
      { path: '/pt-BR/terms', label: '/terms' },
      { path: '/pt-BR/privacy', label: '/privacy' },
      { path: '/pt-BR/seller-terms', label: '/seller-terms' },
      { path: '/pt-BR/policies', label: '/policies' },
    ];

    for (const route of publicRoutes) {
      test(`${route.label} does NOT redirect to /login`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
      });
    }
  });
});
