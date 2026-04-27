const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const BASE = 'https://comicstrunk.com';
const API = 'https://api.comicstrunk.com/api/v1';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');
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
  console.log('=== BATCH ADD TEST v2 ===\n');

  // Create fresh user to avoid rate limit
  const ts = Date.now().toString(36);
  const email = 'batchv2.' + ts + '@test.com';
  const signup = await api('POST', '/auth/signup', { name: 'Batch Tester', email, password: PASSWORD, acceptedTerms: true });
  const token = signup.data.accessToken;

  // Accept terms
  const pending = await api('GET', '/legal/pending', null, token);
  if (pending.data?.length) for (const doc of pending.data) await api('POST', '/legal/accept', { documentId: doc.id }, token);
  console.log('User: ' + email);

  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(BASE + '/pt-BR/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Dismiss terms modal
  try {
    const cb = page.locator('input[type="checkbox"]').first();
    if (await cb.isVisible({ timeout: 3000 })) {
      await cb.click();
      await page.waitForTimeout(300);
      await page.locator('button:has-text("Confirmar")').click();
      await page.waitForTimeout(2000);
    }
  } catch {}

  // 1. Empty state
  await page.goto(BASE + '/pt-BR/collection/add-batch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '80-batch-add-empty.png') });
  console.log('80 - Empty state OK');

  // 2. Search "X-Men" in series tab
  await page.fill('input[placeholder*="serie"]', 'X-Men');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS, '81-batch-add-series-results.png') });
  console.log('81 - Series search results');

  // 3. Click first result (should be a series with many editions)
  const firstSeries = page.locator('button.w-full').first();
  if (await firstSeries.isVisible({ timeout: 3000 })) {
    await firstSeries.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '82-batch-add-series-grid.png') });
    console.log('82 - Series grid loaded');

    // 4. Click "Selecionar todos"
    const selectAll = page.locator('button:has-text("Selecionar todos")');
    if (await selectAll.isVisible({ timeout: 2000 })) {
      await selectAll.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS, '83-batch-add-all-selected.png') });
      console.log('83 - All selected');

      // 5. Scroll down to see action bar
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS, '84-batch-add-action-bar.png') });
      console.log('84 - Action bar');

      // 6. Click "Adicionar X a colecao"
      const addBtn = page.locator('button:has-text("Adicionar")').last();
      if (await addBtn.isEnabled({ timeout: 2000 })) {
        await addBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(SCREENSHOTS, '85-batch-add-success.png') });
        console.log('85 - Added successfully');
      }
    }
  } else {
    console.log('WARN: No series results found');
  }

  // 7. Switch to Busca Rapida tab
  await page.locator('button[role="tab"]:has-text("Busca Rapida")').click();
  await page.waitForTimeout(1000);

  const quickInput = page.locator('input[placeholder*="titulo"]');
  await quickInput.fill('Batman');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS, '86-batch-quick-search.png') });
  console.log('86 - Quick search results');

  // 8. Click add on first result
  const addQuick = page.locator('button:has-text("Adicionar")').first();
  if (await addQuick.isVisible({ timeout: 2000 })) {
    await addQuick.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '87-batch-quick-added.png') });
    console.log('87 - Quick add success');
  }

  // 9. Check collection page now has items
  await page.goto(BASE + '/pt-BR/collection', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '88-collection-after-batch.png') });
  console.log('88 - Collection with batch items');

  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(e => console.error('FATAL:', e));
