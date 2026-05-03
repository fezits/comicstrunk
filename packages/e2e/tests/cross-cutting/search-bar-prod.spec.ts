import { test, expect } from '@playwright/test';

const PROD = 'https://comicstrunk.com';
const DEBOUNCE_MS = 400;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Production smoke — SearchBar deployed', () => {
  test('catalog desktop: 3-char threshold + URL update', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // 2 chars: NO auto submit
    await searchInput.fill('dr');
    await page.waitForTimeout(DEBOUNCE_MS + 200);
    expect(page.url()).not.toContain('title=');

    // 3 chars: auto submit
    await searchInput.fill('dra');
    await page.waitForTimeout(DEBOUNCE_MS + 500);
    expect(page.url()).toContain('title=dra');
  });

  test('catalog desktop: Enter submits 1-char', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('x');
    await searchInput.press('Enter');
    await page.waitForTimeout(800);
    expect(page.url()).toContain('title=x');
  });

  test('catalog desktop: lupa button hidden by md:hidden', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('domcontentloaded');
    const lupa = page.locator('button[aria-label="Buscar"]').first();
    expect(await lupa.count()).toBeGreaterThanOrEqual(1);
    expect(await lupa.isVisible()).toBeFalsy();
  });

  test('catalog mobile (390): lupa visible + button submits', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    const lupa = page.locator('button[aria-label="Buscar"]').first();
    await expect(lupa).toBeVisible();

    // Type 5 chars on mobile — should NOT auto submit
    await searchInput.fill('drago');
    await page.waitForTimeout(DEBOUNCE_MS + 300);
    expect(page.url()).not.toContain('title=');

    // Click lupa
    await lupa.click();
    await page.waitForTimeout(800);
    expect(page.url()).toContain('title=drago');
  });

  test('catalog: multi-token "dragon ball" returns matches', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog?title=dragon%20ball`);
    await page.waitForLoadState('networkidle');
    // At least one entry header with "dragon ball"
    const matches = page.locator('h3').filter({ hasText: /dragon ball/i });
    expect(await matches.count()).toBeGreaterThanOrEqual(1);
  });

  test('clear button (X) shows when typing and clears the search', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder(/buscar quadrinhos/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Initially: no clear button
    expect(await page.locator('button[aria-label="Limpar"]').count()).toBe(0);

    // Type — clear button appears
    await searchInput.fill('spi');
    const clearButton = page.getByRole('button', { name: 'Limpar', exact: true }).first();
    await expect(clearButton).toBeVisible();

    // Wait for auto-submit to settle (so URL has title=spi)
    await page.waitForTimeout(800);
    expect(page.url()).toContain('title=spi');

    // Click X
    await clearButton.click();
    await page.waitForTimeout(800);

    // Input cleared, URL cleared
    expect(await searchInput.inputValue()).toBe('');
    expect(page.url()).not.toContain('title=');
  });

  test('layout: collection counter renders inline (no jump on search)', async ({ page }) => {
    await page.goto(`${PROD}/pt-BR/catalog`);
    await page.waitForLoadState('networkidle');

    // The counter <p> next to the heading should always be present in DOM
    // (we removed the !loading gate so it's reserved space)
    const counter = page.locator('main p.text-sm.text-muted-foreground').first();
    await expect(counter).toBeVisible();
    // It should contain "NN quadrinhos" once the client fetch settles
    await expect(counter).toContainText(/quadrinhos/i, { timeout: 10000 });
  });
});
