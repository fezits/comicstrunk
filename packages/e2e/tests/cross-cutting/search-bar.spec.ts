import { test, expect } from '../../fixtures';

const LOCALE = 'pt-BR';
const DEBOUNCE_MS = 400;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// Collection tests use the cached auth fixture which can flake when a previous
// test invalidates the refresh token chain. Retry once locally to absorb that.
test.describe.configure({ retries: 2 });

test.describe('SearchBar — unified search UX', () => {
  test.describe('Catalog — desktop', () => {
    test('does NOT auto-submit before 3 chars; submits at >=3', async ({ page }) => {
      await page.goto(`/${LOCALE}/catalog`);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);

      await searchInput.fill('s');
      await page.waitForTimeout(DEBOUNCE_MS + 200);
      expect(page.url()).not.toContain('title=');

      await searchInput.fill('sp');
      await page.waitForTimeout(DEBOUNCE_MS + 200);
      expect(page.url()).not.toContain('title=');

      await searchInput.fill('spi');
      await page.waitForTimeout(DEBOUNCE_MS + 300);
      expect(page.url()).toContain('title=spi');

      await searchInput.fill('');
      await page.waitForTimeout(DEBOUNCE_MS + 300);
      expect(page.url()).not.toContain('title=');
    });

    test('Enter submits regardless of length (1 char)', async ({ page }) => {
      await page.goto(`/${LOCALE}/catalog`);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
      await searchInput.fill('x');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('title=x');
    });

    test('mobile lupa button is HIDDEN on desktop viewport', async ({ page }) => {
      await page.goto(`/${LOCALE}/catalog`);
      await page.waitForLoadState('networkidle');

      // CSS-based locator (not role) since md:hidden removes it from a11y tree
      const lupaButton = page.locator('button[aria-label="Buscar"]').first();
      const count = await page.locator('button[aria-label="Buscar"]').count();
      expect(count).toBeGreaterThanOrEqual(1);
      const isVisible = await lupaButton.isVisible();
      expect(isVisible).toBeFalsy();
    });
  });

  test.describe('Catalog — mobile (viewport 390x844)', () => {
    test('does NOT auto-submit on typing; lupa button submits', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(`/${LOCALE}/catalog`);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
      const lupaButton = page.locator('button[aria-label="Buscar"]').first();
      await expect(lupaButton).toBeVisible();

      await searchInput.fill('spide');
      await page.waitForTimeout(DEBOUNCE_MS + 300);
      expect(page.url()).not.toContain('title=');

      await lupaButton.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('title=spide');
    });

    test('Enter submits on mobile', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(`/${LOCALE}/catalog`);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
      await searchInput.fill('xy');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('title=xy');
    });
  });

  test.describe('Collection — desktop', () => {
    test('SearchBar is in the page toolbar (not inside filters sidebar)', async ({
      authedPage,
    }) => {
      await authedPage.goto(`/${LOCALE}/collection`);
      // Wait for the collection heading to confirm we landed (not redirected to login)
      await expect(authedPage.getByRole('heading', { level: 1, name: /minha cole[cç][aã]o/i })).toBeVisible({ timeout: 15000 });
      await authedPage.waitForLoadState('networkidle');

      const searchInput = authedPage.getByPlaceholder(/buscar na cole[cç][aã]o/i);
      await expect(searchInput).toBeVisible();

      const sidebarSearchInputs = authedPage.locator(
        'aside input[placeholder*="cole" i]',
      );
      expect(await sidebarSearchInputs.count()).toBe(0);
    });

    test('multi-token search works (BUG ORIGINAL: "dragon ball")', async ({
      authedPage,
    }) => {
      await authedPage.goto(`/${LOCALE}/collection`);
      // Wait for the collection heading to confirm we landed (not redirected to login)
      await expect(authedPage.getByRole('heading', { level: 1, name: /minha cole[cç][aã]o/i })).toBeVisible({ timeout: 15000 });
      await authedPage.waitForLoadState('networkidle');

      const searchInput = authedPage.getByPlaceholder(/buscar na cole[cç][aã]o/i);
      await searchInput.fill('dragon ball');
      await searchInput.press('Enter');
      await authedPage.waitForTimeout(800);

      expect(authedPage.url()).toContain('query=dragon');

      const dragonHeadings = authedPage.locator('h3, h2, p').filter({ hasText: /dragon ball/i });
      const count = await dragonHeadings.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('single-word search "marvel" matches via PUBLISHER (multi-column)', async ({
      authedPage,
    }) => {
      await authedPage.goto(`/${LOCALE}/collection`);
      // Wait for the collection heading to confirm we landed (not redirected to login)
      await expect(authedPage.getByRole('heading', { level: 1, name: /minha cole[cç][aã]o/i })).toBeVisible({ timeout: 15000 });
      await authedPage.waitForLoadState('networkidle');

      const searchInput = authedPage.getByPlaceholder(/buscar na cole[cç][aã]o/i);
      await searchInput.fill('marvel');
      await searchInput.press('Enter');
      await authedPage.waitForTimeout(800);

      const spiderHeading = authedPage
        .locator('h3, h2, p')
        .filter({ hasText: /spider/i });
      expect(await spiderHeading.count()).toBeGreaterThanOrEqual(1);
    });

    test('does NOT auto-submit before 3 chars on desktop', async ({ authedPage }) => {
      await authedPage.goto(`/${LOCALE}/collection`);
      // Wait for the collection heading to confirm we landed (not redirected to login)
      await expect(authedPage.getByRole('heading', { level: 1, name: /minha cole[cç][aã]o/i })).toBeVisible({ timeout: 15000 });
      await authedPage.waitForLoadState('networkidle');

      const searchInput = authedPage.getByPlaceholder(/buscar na cole[cç][aã]o/i);
      await searchInput.fill('dr');
      await authedPage.waitForTimeout(DEBOUNCE_MS + 200);
      expect(authedPage.url()).not.toContain('query=');

      await searchInput.fill('dra');
      await authedPage.waitForTimeout(DEBOUNCE_MS + 300);
      expect(authedPage.url()).toContain('query=dra');
    });
  });

  test.describe('Collection — mobile (viewport 390x844)', () => {
    test('lupa button visible and submits multi-token query', async ({ authedPage }) => {
      await authedPage.setViewportSize(MOBILE_VIEWPORT);
      await authedPage.goto(`/${LOCALE}/collection`);
      // Wait for the collection heading to confirm we landed (not redirected to login)
      await expect(authedPage.getByRole('heading', { level: 1, name: /minha cole[cç][aã]o/i })).toBeVisible({ timeout: 15000 });
      await authedPage.waitForLoadState('networkidle');

      const searchInput = authedPage.getByPlaceholder(/buscar na cole[cç][aã]o/i);
      const lupaButton = authedPage.locator('button[aria-label="Buscar"]').first();
      await expect(lupaButton).toBeVisible();

      await searchInput.fill('dragon ball');
      await authedPage.waitForTimeout(DEBOUNCE_MS + 300);
      expect(authedPage.url()).not.toContain('query=');

      await lupaButton.click();
      await authedPage.waitForTimeout(800);
      expect(authedPage.url()).toContain('query=dragon');

      const dragon = authedPage.locator('h3, h2, p').filter({ hasText: /dragon ball/i });
      expect(await dragon.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
