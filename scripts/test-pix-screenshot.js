const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const API = 'https://api.comicstrunk.com/api/v1';
const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');

async function api(method, endpoint, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);
  const resp = await fetch(API + endpoint, opts);
  const text = await resp.text();
  try { return { status: resp.status, ...JSON.parse(text) }; } catch { return { status: resp.status, success: false }; }
}

async function run() {
  const ts = Date.now().toString(36);
  console.log('Creating test users...');
  const s1 = await api('POST', '/auth/signup', { name: 'PIX Seller Demo', email: 'psd.' + ts + '@test.com', password: 'Ct@2026!Teste', acceptedTerms: true });
  const s2 = await api('POST', '/auth/signup', { name: 'PIX Buyer Demo', email: 'pbd.' + ts + '@test.com', password: 'Ct@2026!Teste', acceptedTerms: true });
  const sellerT = s1.data.accessToken;
  const buyerT = s2.data.accessToken;
  const buyerEmail = 'pbd.' + ts + '@test.com';

  // Accept terms
  const p = await api('GET', '/legal/pending', null, sellerT);
  if (p.data?.length) for (const d of p.data) { await api('POST', '/legal/accept', { documentId: d.id }, sellerT); await api('POST', '/legal/accept', { documentId: d.id }, buyerT); }

  // Setup: seller lists gibi
  const cat = await api('GET', '/catalog?limit=5&page=15', null, sellerT);
  const gibi = cat.data[0];
  console.log('Gibi: ' + gibi.title);
  const coll = await api('POST', '/collection', { catalogEntryId: gibi.id, condition: 'VERY_GOOD', readStatus: 'READ' }, sellerT);
  await api('PATCH', '/collection/' + coll.data.id + '/sale', { isForSale: true, salePrice: 19.90 }, sellerT);

  // Buyer: cart + address + order + PIX
  await api('POST', '/cart', { collectionItemId: coll.data.id }, buyerT);
  const addr = await api('POST', '/shipping/addresses', {
    recipientName: 'Demo', street: 'Rua PIX', number: '1',
    neighborhood: 'Centro', city: 'SP', state: 'SP', zipCode: '01001000', phone: '11999998888'
  }, buyerT);
  const order = await api('POST', '/orders', { shippingAddressId: addr.data.id }, buyerT);
  console.log('Order: ' + order.data.orderNumber);

  const pix = await api('POST', '/payments/initiate', { orderId: order.data.id }, buyerT);
  console.log('PIX: ' + (pix.success ? 'OK - QR code generated' : 'FAIL'));

  // Browser: login + navigate to payment page
  console.log('\nOpening browser...');
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/pt-BR/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', buyerEmail);
  await page.fill('input[type="password"]', 'Ct@2026!Teste');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Dismiss terms modal if present
  try {
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 2000 })) {
      await checkbox.click();
      await page.waitForTimeout(300);
      const btn = page.locator('button:has-text("Confirmar")');
      if (await btn.isVisible()) await btn.click();
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Go to payment page
  await page.goto(BASE + '/pt-BR/checkout/payment?orderId=' + order.data.id, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '70-pix-payment-page.png') });
  console.log('Screenshot: 70-pix-payment-page.png');

  await browser.close();
  console.log('Done!');
}

run().catch(e => console.error('FATAL:', e));
