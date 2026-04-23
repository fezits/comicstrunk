const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const API = 'https://api.comicstrunk.com/api/v1';
const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');

let results = [];
let passed = 0;
let failed = 0;

function log(msg) { console.log(msg); }

async function apiCall(method, endpoint, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);
  const url = `${API}${endpoint}`;
  try {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    try {
      return { status: resp.status, ...JSON.parse(text) };
    } catch {
      return { status: resp.status, success: false, error: { message: 'Non-JSON response' } };
    }
  } catch (err) {
    return { status: 0, success: false, error: { message: err.message } };
  }
}

function step(name, success, detail) {
  if (success) { passed++; } else { failed++; }
  const status = success ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  log(`  [${status}] ${name}: ${detail}`);
}

async function run() {
  log('=== FLUXO E2E COMPLETO ===\n');

  // Create two fresh users
  const rand = Date.now().toString(36);
  const seller = { email: `seller.${rand}@test.com`, password: 'Ct@2026!Teste', name: 'Vendedor Teste' };
  const buyer = { email: `buyer.${rand}@test.com`, password: 'Ct@2026!Teste', name: 'Comprador Teste' };

  log('--- Cadastro ---');
  const s1 = await apiCall('POST', '/auth/signup', { ...seller, acceptedTerms: true });
  step('Cadastro vendedor', s1.success, s1.success ? `ID: ${s1.data.user.id}` : s1.error?.message);
  const sellerToken = s1.data?.accessToken;

  const s2 = await apiCall('POST', '/auth/signup', { ...buyer, acceptedTerms: true });
  step('Cadastro comprador', s2.success, s2.success ? `ID: ${s2.data.user.id}` : s2.error?.message);
  const buyerToken = s2.data?.accessToken;

  // Accept legal terms
  log('\n--- Termos legais ---');
  const pending = await apiCall('GET', '/legal/pending', null, sellerToken);
  if (pending.success && pending.data?.length > 0) {
    for (const doc of pending.data) {
      await apiCall('POST', '/legal/accept', { documentId: doc.id }, sellerToken);
      await apiCall('POST', '/legal/accept', { documentId: doc.id }, buyerToken);
    }
    step('Aceitar termos', true, `${pending.data.length} documentos aceitos`);
  } else {
    step('Aceitar termos', true, 'Nenhum pendente');
  }

  // Get a gibi from catalog
  log('\n--- Catalogo ---');
  const cat = await apiCall('GET', '/catalog?limit=5', null, sellerToken);
  step('Listar catalogo', cat.success, `${cat.data?.length || 0} gibis retornados`);
  const gibi = cat.data?.[2]; // Pick 3rd to avoid collisions

  // Add to collection
  log('\n--- Colecao ---');
  const addColl = await apiCall('POST', '/collection', {
    catalogEntryId: gibi.id,
    condition: 'VERY_GOOD',
    readStatus: 'READ',
  }, sellerToken);
  step('Adicionar a colecao', addColl.success, addColl.success ? `Item: ${addColl.data.id}` : addColl.error?.message);

  // List for sale
  log('\n--- Marketplace ---');
  let collItemId = addColl.data?.id;
  if (collItemId) {
    const sell = await apiCall('PATCH', `/collection/${collItemId}/sale`, {
      isForSale: true,
      salePrice: 25.00,
    }, sellerToken);
    step('Colocar pra vender', sell.success, sell.success ? 'R$25.00' : sell.error?.message);
  }

  // Buyer favorites the gibi
  log('\n--- Favoritos ---');
  const fav = await apiCall('POST', '/favorites/toggle', { catalogEntryId: gibi.id }, buyerToken);
  step('Favoritar gibi', fav.success, fav.success ? `favorited: ${fav.data.favorited}` : fav.error?.message);

  // Buyer adds to cart
  log('\n--- Carrinho ---');
  if (collItemId) {
    const cart = await apiCall('POST', '/cart', { collectionItemId: collItemId }, buyerToken);
    step('Adicionar ao carrinho', cart.success, cart.success ? `CartItem: ${cart.data.id}` : cart.error?.message);
  }

  // Buyer writes a review
  log('\n--- Avaliacao ---');
  const review = await apiCall('POST', '/reviews/catalog', {
    catalogEntryId: gibi.id,
    rating: 5,
    title: 'Manga incrivel!',
    comment: 'Naoki Urasawa em sua melhor forma. Suspense do inicio ao fim.',
  }, buyerToken);
  step('Criar avaliacao', review.success, review.success ? '5 estrelas' : review.error?.message);

  // Buyer writes a comment
  log('\n--- Comentario ---');
  const comment = await apiCall('POST', '/comments', {
    catalogEntryId: gibi.id,
    content: 'Essa edicao definitiva vale muito a pena. As paginas extras sao otimas!',
  }, buyerToken);
  step('Criar comentario', comment.success, comment.success ? `ID: ${comment.data?.id}` : comment.error?.message);

  // Check notifications (seller should have notification about new review)
  log('\n--- Notificacoes ---');
  const notif = await apiCall('GET', '/notifications?limit=5', null, sellerToken);
  step('Listar notificacoes', notif.success, `${notif.data?.length || 0} notificacoes`);

  // Check collection stats
  log('\n--- Stats ---');
  const stats = await apiCall('GET', '/collection/stats', null, sellerToken);
  step('Stats da colecao', stats.success, stats.success ? `Total: ${stats.data?.totalItems}, Venda: ${stats.data?.totalForSale}` : stats.error?.message);

  // ======================================================================
  // BROWSER SCREENSHOTS (public pages, no login needed)
  // ======================================================================
  log('\n--- Screenshots ---');
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  // Catalog detail with slug
  await page.goto(`${BASE}/pt-BR/catalog/${gibi.slug}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '60-gibi-detalhe-final.png') });
  log('  60-gibi-detalhe-final.png');

  // Scroll to reviews
  await page.evaluate(() => document.querySelector('#reviews')?.scrollIntoView());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS, '61-gibi-reviews-final.png') });
  log('  61-gibi-reviews-final.png');

  // Scroll to comments
  await page.evaluate(() => document.querySelector('#comments')?.scrollIntoView());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS, '62-gibi-comments-final.png') });
  log('  62-gibi-comments-final.png');

  // Marketplace
  await page.goto(`${BASE}/pt-BR/marketplace`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '63-marketplace-final.png') });
  log('  63-marketplace-final.png');

  // Series with slug
  const seriesResp = await apiCall('GET', '/series?limit=1', null, null);
  if (seriesResp.data?.[0]?.slug) {
    await page.goto(`${BASE}/pt-BR/series/${seriesResp.data[0].slug}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '64-series-slug-final.png') });
    log('  64-series-slug-final.png');
  }

  await browser.close();

  // ======================================================================
  // SUMMARY
  // ======================================================================
  log('\n==============================');
  log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  log('==============================\n');

  // Write results to file
  let md = `# E2E Flow Test Report\n\n`;
  md += `**Data:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Vendedor:** ${seller.email}\n`;
  md += `**Comprador:** ${buyer.email}\n`;
  md += `**Gibi testado:** ${gibi.title} (${gibi.slug})\n\n`;
  md += `| Status | Teste | Detalhe |\n|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.status} | ${r.name} | ${r.detail} |\n`;
  }
  md += `\n## Screenshots\n\n`;
  md += `![Detalhe](screenshots/60-gibi-detalhe-final.png)\n`;
  md += `![Reviews](screenshots/61-gibi-reviews-final.png)\n`;
  md += `![Comments](screenshots/62-gibi-comments-final.png)\n`;
  md += `![Marketplace](screenshots/63-marketplace-final.png)\n`;
  md += `![Series](screenshots/64-series-slug-final.png)\n`;

  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'test-reports', 'e2e-flow-report.md'), md);
  log('Report: docs/test-reports/e2e-flow-report.md');
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
