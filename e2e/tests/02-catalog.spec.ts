import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders, loginUI } from './helpers';

test.describe('Catalog — Browse, Search, Detail', () => {
  test('API returns catalog entries', async ({ request }) => {
    const res = await request.get(`${API_URL}/catalog?limit=10`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.pagination.total).toBeGreaterThan(20000);
  });

  test('API search by title (multi-word)', async ({ request }) => {
    const res = await request.get(`${API_URL}/catalog?title=Batman+Vigilantes&limit=5`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].title.toLowerCase()).toContain('batman');
    expect(json.data[0].title.toLowerCase()).toContain('vigilantes');
  });

  test('API search returns empty for nonsense', async ({ request }) => {
    const res = await request.get(`${API_URL}/catalog?title=xyznonexistent12345&limit=5`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(0);
  });

  test('API catalog entry detail', async ({ request }) => {
    const list = await request.get(`${API_URL}/catalog?limit=1`);
    const items = await list.json();
    const id = items.data[0].id;
    
    const res = await request.get(`${API_URL}/catalog/${id}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(id);
    expect(json.data.title).toBeTruthy();
  });

  test('UI catalog page shows entries with covers', async ({ page }) => {
    await loginUI(page);
    await page.goto('/pt-BR/catalog');
    await page.waitForTimeout(3000);
    
    // Check page loaded
    const title = page.locator('h1, h2').first();
    await expect(title).toBeVisible();
    
    // Check entries are visible
    const cards = page.locator('a[href*="/catalog/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('UI catalog detail page loads without error', async ({ page }) => {
    await loginUI(page);
    await page.goto('/pt-BR/catalog', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Get the href of the first entry link and navigate directly
    const firstLink = page.locator('a[href*="/catalog/"]').first();
    const href = await firstLink.getAttribute('href');
    expect(href).toBeTruthy();
    
    await page.goto(href!, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Should be on detail page
    expect(page.url()).toMatch(/\/catalog\//);
    
    // No Next.js error overlay
    const errorOverlay = page.locator('[data-nextjs-dialog]');
    await expect(errorOverlay).not.toBeVisible();
  });

  test('UI catalog search filters results', async ({ page }) => {
    await loginUI(page);
    await page.goto('/pt-BR/catalog');
    await page.waitForTimeout(3000);
    
    // Find search input and type
    const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Batman');
      await page.waitForTimeout(2000);
      
      // Results should contain Batman
      const firstCard = page.locator('a[href*="/catalog/"]').first();
      await expect(firstCard).toContainText(/batman/i);
    }
  });
});

