const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const API = 'https://api.comicstrunk.com/api/v1';
const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');
const PASSWORD = 'Ct@2026!Teste';

async function api(m, e, d, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h.Authorization = 'Bearer ' + t;
  const o = { method: m, headers: h };
  if (d && m !== 'GET') o.body = JSON.stringify(d);
  const r = await fetch(API + e, o);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { success: false }; }
}

async function run() {
  console.log('Setting up test data...');
  const ts = Date.now().toString(36);
  const email = 'views.' + ts + '@test.com';
  const signup = await api('POST', '/auth/signup', { name: 'View Tester', email, password: PASSWORD, acceptedTerms: true });
  const token = signup.data.accessToken;

  // Accept terms
  const pending = await api('GET', '/legal/pending', null, token);
  if (pending.data?.length) for (const doc of pending.data) await api('POST', '/legal/accept', { documentId: doc.id }, token);

  // Add 15 gibis from catalog
  const cat = await api('GET', '/catalog?limit=15&page=2', null, token);
  const ids = cat.data.map(e => e.id);
  await api('POST', '/collection/batch', { catalogEntryIds: ids, condition: 'VERY_GOOD', isRead: false }, token);
  console.log('Added ' + ids.length + ' gibis to collection');

  // Mark some as read
  const items = await api('GET', '/collection?limit=15', null, token);
  for (let i = 0; i < 5 && i < items.data.length; i++) {
    await api('PATCH', '/collection/' + items.data[i].id + '/read', { isRead: true }, token);
  }
  console.log('Marked 5 as read');

  // Browser
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(BASE + '/pt-BR/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Dismiss terms
  try {
    const cb = page.locator('input[type="checkbox"]').first();
    if (await cb.isVisible({ timeout: 3000 })) {
      await cb.click();
      await page.waitForTimeout(300);
      await page.locator('button:has-text("Confirmar")').click();
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Go to collection
  await page.goto(BASE + '/pt-BR/collection', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Screenshot 1: Grid mode (default)
  await page.screenshot({ path: path.join(SCREENSHOTS, '90-collection-view-grid.png') });
  console.log('90 - Grid view');

  // Click compact button (middle button in toggle)
  const toggleButtons = page.locator('button[title]');
  const compactBtn = page.locator('button[title="Compacto"]');
  if (await compactBtn.isVisible({ timeout: 3000 })) {
    await compactBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '91-collection-view-compact.png') });
    console.log('91 - Compact view');
  } else {
    console.log('WARN: Compact button not found');
  }

  // Click list button
  const listBtn = page.locator('button[title="Lista"]');
  if (await listBtn.isVisible({ timeout: 3000 })) {
    await listBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '92-collection-view-list.png') });
    console.log('92 - List view');
  } else {
    console.log('WARN: List button not found');
  }

  await browser.close();
  console.log('\nDone!');
}

run().catch(e => console.error('FATAL:', e));
