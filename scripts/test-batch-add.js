const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const API = 'https://api.comicstrunk.com/api/v1';
const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');

const EMAIL = 'vai_q_eh@yahoo.com.br';
const PASSWORD = 'Ct@2026!Teste';

async function api(method, endpoint, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);
  const resp = await fetch(API + endpoint, opts);
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { success: false }; }
}

async function run() {
  console.log('=== BATCH ADD TEST ===\n');

  // Login via API first to check rate limit
  let token;
  const loginResp = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (loginResp.success) {
    token = loginResp.data.accessToken;
    console.log('Logged in via API');
  } else {
    // Create temp user
    const ts = Date.now().toString(36);
    const signup = await api('POST', '/auth/signup', { name: 'Batch Test', email: 'batch.' + ts + '@test.com', password: PASSWORD, acceptedTerms: true });
    token = signup.data.accessToken;
    console.log('Created temp user');

    // Accept terms
    const pending = await api('GET', '/legal/pending', null, token);
    if (pending.data?.length) {
      for (const doc of pending.data) await api('POST', '/legal/accept', { documentId: doc.id }, token);
    }
  }

  // Test batch API directly
  console.log('\n--- API Test: batch add ---');
  const series = await api('GET', '/series?title=Naruto&limit=1', null, token);
  if (series.data?.length > 0) {
    const s = series.data[0];
    console.log('Series: ' + s.title + ' (slug: ' + s.slug + ')');

    const detail = await api('GET', '/series/' + (s.slug || s.id), null, token);
    const editions = detail.data?.catalogEntries || [];
    console.log('Editions: ' + editions.length);

    if (editions.length > 0) {
      const ids = editions.slice(0, 5).map(e => e.id);
      const result = await api('POST', '/collection/batch', {
        catalogEntryIds: ids,
        condition: 'VERY_GOOD',
        isRead: true,
      }, token);
      console.log('Batch result: ' + JSON.stringify(result.data || result.error));
    }
  }

  // Browser tests
  console.log('\n--- Browser Screenshots ---');
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login in browser
  await page.goto(BASE + '/pt-BR/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Dismiss terms modal if present
  try {
    const cb = page.locator('input[type="checkbox"]').first();
    if (await cb.isVisible({ timeout: 2000 })) {
      await cb.click();
      await page.waitForTimeout(300);
      const btn = page.locator('button:has-text("Confirmar")');
      if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(2000); }
    }
  } catch {}

  // Navigate to batch add page
  await page.goto(BASE + '/pt-BR/collection/add-batch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '80-batch-add-empty.png') });
  console.log('80-batch-add-empty.png');

  // Search for a series
  await page.fill('input[placeholder*="serie"]', 'Naruto');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '81-batch-add-series-search.png') });
  console.log('81-batch-add-series-search.png');

  // Click first series result
  const firstResult = page.locator('button:has-text("Naruto")').first();
  if (await firstResult.isVisible({ timeout: 3000 })) {
    await firstResult.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '82-batch-add-series-grid.png') });
    console.log('82-batch-add-series-grid.png');

    // Click "Selecionar todos"
    const selectAllBtn = page.locator('button:has-text("Selecionar todos")');
    if (await selectAllBtn.isVisible({ timeout: 2000 })) {
      await selectAllBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS, '83-batch-add-all-selected.png') });
      console.log('83-batch-add-all-selected.png');
    }
  }

  // Switch to quick search tab
  const quickTab = page.locator('button[role="tab"]:has-text("Busca Rapida")');
  if (await quickTab.isVisible({ timeout: 2000 })) {
    await quickTab.click();
    await page.waitForTimeout(1000);

    // Search for a gibi
    const searchInput = page.locator('input[placeholder*="titulo"]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('Batman');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS, '84-batch-add-quick-search.png') });
      console.log('84-batch-add-quick-search.png');

      // Click first "Adicionar" button
      const addBtn = page.locator('button:has-text("Adicionar")').first();
      if (await addBtn.isVisible({ timeout: 2000 })) {
        await addBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS, '85-batch-add-quick-added.png') });
        console.log('85-batch-add-quick-added.png');
      }
    }
  }

  // Check sidebar nav has the entry
  await page.screenshot({ path: path.join(SCREENSHOTS, '86-batch-add-nav.png') });
  console.log('86-batch-add-nav.png');

  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(e => console.error('FATAL:', e));
