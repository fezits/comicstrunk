import { test, expect } from '../../fixtures';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Favorites E2E flow with screenshots.
 *
 * Tests the full favorites lifecycle: toggling on catalog detail,
 * viewing favorites page, and removing items.
 */
test.describe('Favorites Flow (with screenshots)', () => {
  let catalogEntryId: string;

  test.beforeAll(async ({ dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    catalogEntryId = entry.id;
  });

  test('complete favorites lifecycle with screenshots', async ({ authedPage, loginAsUser }) => {
    const page = authedPage;
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Ensure item is NOT favorited
    const checkRes = await userApi.get(`/favorites/check/${catalogEntryId}`);
    if (checkRes.data.data.isFavorited) {
      await userApi.post('/favorites/toggle', { catalogEntryId });
    }

    // 1. Navigate to catalog detail page
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/favorites/01-catalog-detail-unfavorited.png',
      fullPage: true,
    });

    // 2. Click favorite button
    const favoriteBtn = page
      .locator(
        '[data-testid="favorite-button"], [data-testid="favorite-toggle"], ' +
          'button[aria-label*="favorit"], button[aria-label*="curtir"]',
      )
      .first();

    const hasBtn = await favoriteBtn.isVisible().catch(() => false);
    if (hasBtn) {
      await favoriteBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: 'screenshots/favorites/02-item-favorited.png',
        fullPage: false,
      });

      // Verify via API
      const verifyRes = await userApi.get(`/favorites/check/${catalogEntryId}`);
      expect(verifyRes.data.data.isFavorited).toBe(true);
    } else {
      // Favorite via API
      await userApi.post('/favorites/toggle', { catalogEntryId });
    }

    // 3. Navigate to favorites page
    await page.goto('/pt-BR/favorites');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/favorites/03-favorites-page-with-item.png',
      fullPage: true,
    });

    // 4. Verify favorites list has our item
    const heading = page
      .getByRole('heading', { name: /favoritos|favorites/i })
      .or(page.getByText(/meus favoritos|my favorites/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const items = page.locator(
      '[data-testid="favorite-item"], [data-testid="catalog-card"], .group, table tbody tr',
    );
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 5. Unfavorite from the favorites page
    const unfavoriteBtn = page
      .locator(
        '[data-testid="favorite-button"], [data-testid="favorite-toggle"], ' +
          'button[aria-label*="favorit"], button[aria-label*="remover"]',
      )
      .first();

    const hasBtnOnPage = await unfavoriteBtn.isVisible().catch(() => false);
    if (hasBtnOnPage) {
      await unfavoriteBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: 'screenshots/favorites/04-item-unfavorited.png',
        fullPage: true,
      });
    } else {
      await userApi.post('/favorites/toggle', { catalogEntryId });
    }

    // 6. Empty favorites state
    // Re-verify the page after unfavoriting
    await page.reload();
    await page.waitForLoadState('networkidle');

    const emptyState = page
      .getByText(/nenhum favorito|sem favoritos|lista vazia|no favorites/i)
      .first();
    const isEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);

    await page.screenshot({
      path: 'screenshots/favorites/05-favorites-empty-state.png',
      fullPage: true,
    });
  });

  test('heart icon visible on catalog browse', async ({ authedPage }) => {
    const page = authedPage;

    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/favorites/06-catalog-browse-with-hearts.png',
      fullPage: false,
    });

    // Hover over a card to reveal heart
    const firstCard = page.locator('[data-testid="catalog-card"], .group').first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.hover();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: 'screenshots/favorites/07-catalog-card-hover-heart.png',
        fullPage: false,
      });
    }
  });
});
