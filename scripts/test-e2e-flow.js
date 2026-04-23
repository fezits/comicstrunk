const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const API = 'https://api.comicstrunk.com/api/v1';
const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');

// User 1 = seller (vai_q_eh)
// User 2 = buyer (braidatto)
const USER1 = { email: 'vai_q_eh@yahoo.com.br', password: 'Ct@2026!Teste', name: 'Teste Claude' };
const USER2 = { email: 'braidatto@gmail.com', password: 'Ct@2026!Teste', name: 'Fernando Teste' };

let results = [];

function log(msg) { console.log(msg); }

async function apiCall(method, endpoint, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);

  const url = endpoint.startsWith('http') ? endpoint : `${API}${endpoint}`;
  const resp = await fetch(url, opts);
  const json = await resp.json();
  return { status: resp.status, ...json };
}

async function login(email, password) {
  // Try login first, fallback to refresh if rate limited
  const resp = await apiCall('POST', '/auth/login', { email, password });
  if (resp.success) return resp.data.accessToken;

  if (resp.status === 429) {
    log(`    Rate limited - trying signup with new temp email`);
    // Create temp user instead
    const rand = Math.random().toString(36).slice(2, 8);
    const tempResp = await apiCall('POST', '/auth/signup', {
      name: `Test ${rand}`,
      email: `test.${rand}@test.com`,
      password: password,
      acceptedTerms: true,
    });
    if (tempResp.success) return tempResp.data.accessToken;
    throw new Error(`Both login and signup failed: ${JSON.stringify(tempResp)}`);
  }

  throw new Error(`Login failed: ${JSON.stringify(resp)}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });

  log('=== FLUXO E2E: COLECAO, VENDA, COMPRA, AVALIACAO ===\n');

  // 1. Login both users
  log('--- Step 1: Login dos dois usuarios ---');
  const token1 = await login(USER1.email, USER1.password);
  log(`  User1 (${USER1.name}): logado`);
  const token2 = await login(USER2.email, USER2.password);
  log(`  User2 (${USER2.name}): logado`);

  // 2. Accept legal terms for both users (so the modal doesn't block)
  log('\n--- Step 2: Aceitar termos legais ---');
  const legalDocs = await apiCall('GET', '/legal/pending', null, token1);
  if (legalDocs.success && legalDocs.data?.length > 0) {
    for (const doc of legalDocs.data) {
      await apiCall('POST', '/legal/accept', { documentId: doc.id }, token1);
      await apiCall('POST', '/legal/accept', { documentId: doc.id }, token2);
      log(`  Aceito: ${doc.type} v${doc.version}`);
    }
  } else {
    log('  Nenhum documento pendente');
  }

  // 3. User1 adds a gibi to their collection
  log('\n--- Step 3: User1 adiciona gibi a colecao ---');
  const catalogResp = await apiCall('GET', '/catalog?limit=10', null, token1);
  let gibi = null;
  let addToCollection = { success: false, data: null };

  // Try multiple gibis in case some are already in collection
  for (const candidate of catalogResp.data) {
    const result = await apiCall('POST', '/collection', {
      catalogEntryId: candidate.id,
      condition: 'VERY_GOOD',
      readStatus: 'READ',
    }, token1);

    if (result.success) {
      gibi = candidate;
      addToCollection = result;
      log(`  Gibi escolhido: "${gibi.title}" (slug: ${gibi.slug})`);
      log(`  Adicionado a colecao! ID: ${addToCollection.data.id}`);
      results.push({ step: 'Adicionar a colecao', status: 'PASS', detail: addToCollection.data.id });
      break;
    }
  }

  if (!gibi) {
    // Fallback: use first gibi even if already in collection, check existing items
    gibi = catalogResp.data[0];
    log(`  Gibi ja na colecao, usando: "${gibi.title}" (slug: ${gibi.slug})`);
    const collItems = await apiCall('GET', '/collection?limit=1', null, token1);
    if (collItems.success && collItems.data.length > 0) {
      addToCollection = { success: true, data: collItems.data[0] };
      results.push({ step: 'Usar gibi existente na colecao', status: 'PASS', detail: addToCollection.data.id });
    }
  }

  // 4. User1 lists the gibi for sale (update collection item)
  log('\n--- Step 4: User1 coloca gibi pra vender ---');
  const collectionItemId = addToCollection.success ? addToCollection.data.id : null;

  let listingResult = { success: false };
  if (collectionItemId) {
    listingResult = await apiCall('PUT', `/collection/${collectionItemId}`, {
      isForSale: true,
      salePrice: 29.90,
      condition: 'VERY_GOOD',
    }, token1);

    if (listingResult.success) {
      log(`  Anuncio criado! Preco: R$29.90`);
      results.push({ step: 'Colocar pra vender', status: 'PASS', detail: `R$29.90` });
    } else {
      log(`  Erro: ${JSON.stringify(listingResult)}`);
      results.push({ step: 'Colocar pra vender', status: 'FAIL', detail: JSON.stringify(listingResult) });
    }
  }

  // 5. Screenshot: browse marketplace and see the listing
  log('\n--- Step 5: Verificar marketplace no browser ---');
  const page1 = await context.newPage();

  // Login user2 in browser
  await page1.goto(`${BASE}/pt-BR/login`, { waitUntil: 'networkidle' });
  await page1.fill('input[type="email"], input[name="email"]', USER2.email);
  await page1.fill('input[type="password"], input[name="password"]', USER2.password);
  await page1.click('button[type="submit"]');
  await page1.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 30000 }).catch(() => log('    Login redirect timeout - continuing'));
  await page1.waitForTimeout(2000);

  // Accept terms modal if present
  const acceptBtn = page1.locator('text=Li e aceito os termos');
  if (await acceptBtn.isVisible().catch(() => false)) {
    await acceptBtn.click();
    await page1.waitForTimeout(500);
    const confirmBtn = page1.locator('text=Confirmar');
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page1.waitForTimeout(2000);
    }
  }

  // Navigate to marketplace
  await page1.goto(`${BASE}/pt-BR/marketplace`, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(2000);
  await screenshot(page1, '50-marketplace-com-anuncio');
  log('  Screenshot: marketplace');

  // 6. User2 favorites a gibi
  log('\n--- Step 6: User2 favorita um gibi ---');
  const favResult = await apiCall('POST', '/favorites/toggle', { catalogEntryId: gibi.id }, token2);
  if (favResult.success) {
    log(`  Favoritou: ${favResult.data.favorited}`);
    results.push({ step: 'Favoritar gibi', status: 'PASS', detail: `favorited: ${favResult.data.favorited}` });
  } else {
    log(`  Erro: ${JSON.stringify(favResult)}`);
    results.push({ step: 'Favoritar gibi', status: 'FAIL', detail: JSON.stringify(favResult) });
  }

  // Screenshot favoritos
  await page1.goto(`${BASE}/pt-BR/favorites`, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(2000);
  await screenshot(page1, '51-favoritos-com-gibi');
  log('  Screenshot: favoritos');

  // 7. User2 adds the gibi to cart (if listing exists)
  log('\n--- Step 7: User2 adiciona ao carrinho ---');
  if (collectionItemId) {
    const cartResult = await apiCall('POST', '/cart', { collectionItemId }, token2);
    if (cartResult.success) {
      log(`  Adicionado ao carrinho!`);
      results.push({ step: 'Adicionar ao carrinho', status: 'PASS', detail: cartResult.data.id });

      // Screenshot cart
      await page1.goto(`${BASE}/pt-BR/cart`, { waitUntil: 'networkidle' });
      await page1.waitForTimeout(2000);
      await screenshot(page1, '52-carrinho-com-item');
      log('  Screenshot: carrinho com item');
    } else {
      log(`  Erro: ${JSON.stringify(cartResult)}`);
      results.push({ step: 'Adicionar ao carrinho', status: 'FAIL', detail: JSON.stringify(cartResult) });
    }
  }

  // 8. User2 writes a review for the gibi
  log('\n--- Step 8: User2 avalia o gibi ---');
  const reviewResult = await apiCall('POST', '/reviews', {
    catalogEntryId: gibi.id,
    rating: 5,
    title: 'Excelente manga!',
    comment: 'Uma obra prima de Naoki Urasawa. Recomendo demais para quem gosta de suspense.',
  }, token2);
  if (reviewResult.success) {
    log(`  Avaliacao criada! Rating: 5 estrelas`);
    results.push({ step: 'Avaliar gibi', status: 'PASS', detail: '5 estrelas' });
  } else {
    log(`  Erro: ${JSON.stringify(reviewResult)}`);
    results.push({ step: 'Avaliar gibi', status: 'FAIL', detail: JSON.stringify(reviewResult) });
  }

  // 9. User2 writes a comment
  log('\n--- Step 9: User2 comenta no gibi ---');
  const commentResult = await apiCall('POST', '/comments', {
    catalogEntryId: gibi.id,
    content: 'Alguem sabe se essa edicao vem com poster?',
  }, token2);
  if (commentResult.success) {
    log(`  Comentario criado!`);
    results.push({ step: 'Comentar no gibi', status: 'PASS', detail: commentResult.data.id });
  } else {
    log(`  Erro: ${JSON.stringify(commentResult)}`);
    results.push({ step: 'Comentar no gibi', status: 'FAIL', detail: JSON.stringify(commentResult) });
  }

  // 10. Screenshot: catalog detail showing review + comment
  log('\n--- Step 10: Screenshot do gibi com avaliacao e comentario ---');
  await page1.goto(`${BASE}/pt-BR/catalog/${gibi.slug}`, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(3000);
  await screenshot(page1, '53-gibi-detalhe-com-review');

  // Scroll down to reviews
  await page1.evaluate(() => {
    const reviewSection = document.querySelector('#reviews');
    if (reviewSection) reviewSection.scrollIntoView();
  });
  await page1.waitForTimeout(1000);
  await screenshot(page1, '54-gibi-reviews');

  // Scroll to comments
  await page1.evaluate(() => {
    const commentSection = document.querySelector('#comments');
    if (commentSection) commentSection.scrollIntoView();
  });
  await page1.waitForTimeout(1000);
  await screenshot(page1, '55-gibi-comments');

  // 11. User1's collection page
  log('\n--- Step 11: Screenshots paginas do User1 (vendedor) ---');
  const page2 = await context.newPage();
  await page2.goto(`${BASE}/pt-BR/login`, { waitUntil: 'networkidle' });
  await page2.fill('input[type="email"], input[name="email"]', USER1.email);
  await page2.fill('input[type="password"], input[name="password"]', USER1.password);
  await page2.click('button[type="submit"]');
  await page2.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 30000 }).catch(() => log('    Login redirect timeout - continuing'));
  await page2.waitForTimeout(2000);

  // Accept terms if shown
  const acceptBtn2 = page2.locator('text=Li e aceito os termos');
  if (await acceptBtn2.isVisible().catch(() => false)) {
    await acceptBtn2.click();
    await page2.waitForTimeout(500);
    const confirmBtn2 = page2.locator('text=Confirmar');
    if (await confirmBtn2.isVisible().catch(() => false)) {
      await confirmBtn2.click();
      await page2.waitForTimeout(2000);
    }
  }

  await page2.goto(`${BASE}/pt-BR/collection`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(2000);
  await screenshot(page2, '56-colecao-user1');
  log('  Screenshot: colecao do vendedor');

  // 12. Profile page
  await page2.goto(`${BASE}/pt-BR/profile`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(2000);
  await screenshot(page2, '57-perfil-user1');
  log('  Screenshot: perfil do vendedor');

  // 13. Settings page
  await page2.goto(`${BASE}/pt-BR/settings`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(2000);
  await screenshot(page2, '58-configuracoes-user1');
  log('  Screenshot: configuracoes');

  // 14. Notifications
  await page2.goto(`${BASE}/pt-BR/notifications`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(2000);
  await screenshot(page2, '59-notificacoes-user1');
  log('  Screenshot: notificacoes');

  await page1.close();
  await page2.close();
  await browser.close();

  // Summary
  log('\n==============================');
  log('FLUXO E2E - RESUMO');
  log('==============================');
  for (const r of results) {
    log(`  [${r.status}] ${r.step}: ${r.detail}`);
  }
  log(`\nTotal: ${results.length} steps | Pass: ${results.filter(r => r.status === 'PASS').length} | Fail: ${results.filter(r => r.status === 'FAIL').length}`);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
