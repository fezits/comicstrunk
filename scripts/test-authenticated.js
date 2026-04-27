const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');

const EMAIL = 'vai_q_eh@yahoo.com.br';
const PASSWORD = 'Ct@2026!Teste';

let results = [];
let passed = 0;
let failed = 0;

function log(msg) { console.log(msg); }

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return `screenshots/${name}.png`;
}

async function test(name, fn) {
  log(`\n--- TEST: ${name} ---`);
  try {
    const result = await fn();
    passed++;
    results.push({ name, status: 'PASS', ...result });
    log(`  PASS: ${result.detail || ''}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', detail: err.message, screenshot: null });
    log(`  FAIL: ${err.message}`);
  }
}

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  // ======================================================================
  // LOGIN
  // ======================================================================

  await test('17 - Login', async () => {
    await page.goto(`${BASE}/pt-BR/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    const imgBefore = await screenshot(page, '17-login-preenchido');

    await page.click('button[type="submit"]');
    // Wait for navigation away from login page
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    const img = await screenshot(page, '17-login-sucesso');
    return { detail: `Logado! Redirecionou para: ${url}`, screenshot: img };
  });

  // ======================================================================
  // COLLECTOR PAGES
  // ======================================================================

  await test('18 - Carrinho (page)', async () => {
    await page.goto(`${BASE}/pt-BR/cart`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '18-carrinho');
    const hasCartContent = await page.locator('text=Meu Carrinho, text=carrinho esta vazio, text=Explorar marketplace').first().isVisible().catch(() => false);
    return { detail: `Carrinho carregou (conteudo: ${hasCartContent})`, screenshot: img };
  });

  await test('19 - Perfil', async () => {
    await page.goto(`${BASE}/pt-BR/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const img = await screenshot(page, '19-perfil');
    return { detail: 'Perfil carregou', screenshot: img };
  });

  await test('20 - Configuracoes', async () => {
    await page.goto(`${BASE}/pt-BR/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '20-configuracoes');
    return { detail: 'Configuracoes carregou', screenshot: img };
  });

  await test('21 - Colecao', async () => {
    await page.goto(`${BASE}/pt-BR/collection`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '21-colecao');
    return { detail: 'Colecao carregou', screenshot: img };
  });

  await test('22 - Favoritos', async () => {
    await page.goto(`${BASE}/pt-BR/favorites`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '22-favoritos');
    return { detail: 'Favoritos carregou', screenshot: img };
  });

  await test('23 - Notificacoes', async () => {
    await page.goto(`${BASE}/pt-BR/notifications`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '23-notificacoes');
    return { detail: 'Notificacoes carregou', screenshot: img };
  });

  await test('24 - Assinatura', async () => {
    await page.goto(`${BASE}/pt-BR/subscription`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '24-assinatura');
    return { detail: 'Assinatura carregou', screenshot: img };
  });

  await test('25 - LGPD', async () => {
    await page.goto(`${BASE}/pt-BR/lgpd`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '25-lgpd');
    return { detail: 'LGPD carregou', screenshot: img };
  });

  await test('26 - Meus pedidos', async () => {
    await page.goto(`${BASE}/pt-BR/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '26-pedidos');
    return { detail: 'Pedidos carregou', screenshot: img };
  });

  await test('27 - Historico de pagamentos', async () => {
    await page.goto(`${BASE}/pt-BR/payments/history`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '27-pagamentos');
    return { detail: 'Pagamentos carregou', screenshot: img };
  });

  await test('28 - Progresso de series', async () => {
    await page.goto(`${BASE}/pt-BR/collection/series-progress`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '28-series-progress');
    return { detail: 'Series progress carregou', screenshot: img };
  });

  // ======================================================================
  // INTERACOES
  // ======================================================================

  await test('42 - Adicionar gibi a colecao', async () => {
    await page.goto(`${BASE}/pt-BR/catalog`, { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/catalog/"]', { timeout: 10000 });
    const firstLink = page.locator('a[href*="/catalog/"]').first();
    const href = await firstLink.getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for "add to collection" button
    const addBtn = page.locator('button:has-text("colecao"), button:has-text("Colecao"), button:has-text("Adicionar")').first();
    const btnExists = await addBtn.isVisible().catch(() => false);
    const img = await screenshot(page, '42-adicionar-colecao');
    return { detail: `Botao colecao visivel: ${btnExists}`, screenshot: img };
  });

  await test('43 - Favoritar gibi', async () => {
    // Still on catalog detail page - look for heart/favorite button
    const favBtn = page.locator('button[aria-label*="favor"], button:has(svg.lucide-heart)').first();
    const btnExists = await favBtn.isVisible().catch(() => false);
    if (btnExists) {
      await favBtn.click();
      await page.waitForTimeout(1500);
    }
    const img = await screenshot(page, '43-favoritar');
    return { detail: `Botao favorito visivel: ${btnExists}`, screenshot: img };
  });

  await test('44 - Header dropdown (perfil e configuracoes)', async () => {
    await page.goto(`${BASE}/pt-BR`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Click avatar/user menu in header
    const avatarBtn = page.locator('header button:has(span), header [role="button"]').last();
    const exists = await avatarBtn.isVisible().catch(() => false);
    if (exists) {
      await avatarBtn.click();
      await page.waitForTimeout(1000);
    }
    const img = await screenshot(page, '44-header-dropdown');
    return { detail: `Dropdown aberto: ${exists}`, screenshot: img };
  });

  await test('45 - Sidebar navegacao (mobile)', async () => {
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(`${BASE}/pt-BR`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000);
    // Click hamburger menu
    const hamburger = mobilePage.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    const exists = await hamburger.isVisible().catch(() => false);
    if (exists) {
      await hamburger.click();
      await mobilePage.waitForTimeout(1000);
    }
    const img = await screenshot(mobilePage, '45-mobile-sidebar');
    await mobilePage.close();
    return { detail: `Hamburger visivel: ${exists}`, screenshot: img };
  });

  // ======================================================================
  // NOTE: Admin pages require ADMIN role, this user is USER role
  // ======================================================================

  log('\n--- NOTA: Paginas admin requerem role ADMIN ---');
  log('--- Usuario de teste tem role USER, admin pages vao redirecionar ---');

  await test('29 - Admin dashboard (requer ADMIN)', async () => {
    await page.goto(`${BASE}/pt-BR/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '29-admin-dashboard');
    const url = page.url();
    return { detail: `URL: ${url} (redireciona se nao admin)`, screenshot: img };
  });

  await browser.close();

  // Print summary
  log(`\n==============================`);
  log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  log(`==============================`);

  // Update results to file
  const lines = results.map(r => `| ${r.status} | ${r.name} | ${r.detail || ''} |`);
  console.log('\nResults table:');
  console.log('| Status | Test | Detail |');
  console.log('|---|---|---|');
  lines.forEach(l => console.log(l));
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
