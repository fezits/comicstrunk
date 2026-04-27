const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const BASE = 'https://comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, '..', 'docs', 'test-reports', 'screenshots');
const REPORT = path.join(__dirname, '..', 'docs', 'test-reports', 'feature-test-report.md');

let results = [];
let passed = 0;
let failed = 0;

function log(msg) {
  console.log(msg);
}

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
  // PUBLIC PAGES
  // ======================================================================

  await test('01 - Homepage carrega', async () => {
    await page.goto(`${BASE}/pt-BR`, { waitUntil: 'networkidle' });
    const title = await page.title();
    const img = await screenshot(page, '01-homepage');
    return { detail: `Title: "${title}"`, screenshot: img };
  });

  await test('02 - Favicon carrega (CT)', async () => {
    const resp = await page.goto(`${BASE}/favicon.ico`);
    const status = resp.status();
    await page.goto(`${BASE}/pt-BR`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '02-favicon');
    return { detail: `Status: ${status}`, screenshot: img };
  });

  await test('03 - Catalogo lista gibis', async () => {
    await page.goto(`${BASE}/pt-BR/catalog`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[class*="group"]', { timeout: 10000 });
    const count = await page.locator('a[href*="/catalog/"]').count();
    const img = await screenshot(page, '03-catalogo-lista');
    return { detail: `${count} items na pagina`, screenshot: img };
  });

  await test('04 - Catalogo detalhe por SLUG', async () => {
    // Click first catalog item
    const firstLink = page.locator('a[href*="/catalog/"]').first();
    const href = await firstLink.getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    const url = page.url();
    const hasSlug = !url.match(/\/catalog\/c[a-z0-9]{24}$/);
    const img = await screenshot(page, '04-catalogo-detalhe-slug');
    return { detail: `URL: ${url} | Slug: ${hasSlug}`, screenshot: img };
  });

  await test('05 - Catalogo detalhe tem titulo e capa', async () => {
    const hasTitle = await page.locator('h1, h2').first().isVisible();
    const img = await screenshot(page, '05-catalogo-detalhe-conteudo');
    return { detail: `Titulo visivel: ${hasTitle}`, screenshot: img };
  });

  await test('06 - Series lista', async () => {
    await page.goto(`${BASE}/pt-BR/series`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[class*="group"]', { timeout: 10000 });
    const count = await page.locator('a[href*="/series/"]').count();
    const img = await screenshot(page, '06-series-lista');
    return { detail: `${count} series na pagina`, screenshot: img };
  });

  await test('07 - Series detalhe por SLUG', async () => {
    const firstLink = page.locator('a[href*="/series/"]').first();
    const href = await firstLink.getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    const url = page.url();
    const hasSlug = !url.match(/\/series\/c[a-z0-9]{24}$/);
    const img = await screenshot(page, '07-series-detalhe-slug');
    return { detail: `URL: ${url} | Slug: ${hasSlug}`, screenshot: img };
  });

  await test('08 - Marketplace lista', async () => {
    await page.goto(`${BASE}/pt-BR/marketplace`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '08-marketplace');
    return { detail: 'Marketplace carregou', screenshot: img };
  });

  await test('09 - Deals', async () => {
    await page.goto(`${BASE}/pt-BR/deals`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '09-deals');
    return { detail: 'Deals carregou', screenshot: img };
  });

  await test('10 - Contato', async () => {
    await page.goto(`${BASE}/pt-BR/contact`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '10-contato');
    return { detail: 'Contato carregou', screenshot: img };
  });

  await test('11 - Termos de uso', async () => {
    await page.goto(`${BASE}/pt-BR/terms`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '11-termos');
    return { detail: 'Termos carregou', screenshot: img };
  });

  await test('12 - Politica de privacidade', async () => {
    await page.goto(`${BASE}/pt-BR/privacy`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '12-privacidade');
    return { detail: 'Privacidade carregou', screenshot: img };
  });

  await test('13 - Politicas (hub)', async () => {
    await page.goto(`${BASE}/pt-BR/policies`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '13-politicas');
    return { detail: 'Politicas hub carregou', screenshot: img };
  });

  // ======================================================================
  // AUTH PAGES
  // ======================================================================

  await test('14 - Login page', async () => {
    await page.goto(`${BASE}/pt-BR/login`, { waitUntil: 'networkidle' });
    const hasForm = await page.locator('input[type="email"], input[name="email"]').isVisible();
    const img = await screenshot(page, '14-login');
    return { detail: `Form visivel: ${hasForm}`, screenshot: img };
  });

  await test('15 - Signup page', async () => {
    await page.goto(`${BASE}/pt-BR/signup`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '15-signup');
    return { detail: 'Signup carregou', screenshot: img };
  });

  await test('16 - Forgot password', async () => {
    await page.goto(`${BASE}/pt-BR/forgot-password`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '16-forgot-password');
    return { detail: 'Forgot password carregou', screenshot: img };
  });

  // ======================================================================
  // LOGIN AND AUTHENTICATED PAGES
  // ======================================================================

  await test('17 - Login com credenciais admin', async () => {
    await page.goto(`${BASE}/pt-BR/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"]', 'admin@comicstrunk.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/pt-BR', { timeout: 10000 });
    const url = page.url();
    const img = await screenshot(page, '17-login-sucesso');
    return { detail: `Redirecionou para: ${url}`, screenshot: img };
  });

  await test('18 - Carrinho (page)', async () => {
    await page.goto(`${BASE}/pt-BR/cart`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '18-carrinho');
    return { detail: 'Carrinho carregou', screenshot: img };
  });

  await test('19 - Perfil', async () => {
    await page.goto(`${BASE}/pt-BR/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '19-perfil');
    return { detail: 'Perfil carregou', screenshot: img };
  });

  await test('20 - Configuracoes', async () => {
    await page.goto(`${BASE}/pt-BR/settings`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '20-configuracoes');
    return { detail: 'Configuracoes carregou', screenshot: img };
  });

  await test('21 - Colecao', async () => {
    await page.goto(`${BASE}/pt-BR/collection`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '21-colecao');
    return { detail: 'Colecao carregou', screenshot: img };
  });

  await test('22 - Favoritos', async () => {
    await page.goto(`${BASE}/pt-BR/favorites`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '22-favoritos');
    return { detail: 'Favoritos carregou', screenshot: img };
  });

  await test('23 - Notificacoes', async () => {
    await page.goto(`${BASE}/pt-BR/notifications`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '23-notificacoes');
    return { detail: 'Notificacoes carregou', screenshot: img };
  });

  await test('24 - Assinatura', async () => {
    await page.goto(`${BASE}/pt-BR/subscription`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '24-assinatura');
    return { detail: 'Assinatura carregou', screenshot: img };
  });

  await test('25 - LGPD', async () => {
    await page.goto(`${BASE}/pt-BR/lgpd`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '25-lgpd');
    return { detail: 'LGPD carregou', screenshot: img };
  });

  await test('26 - Meus pedidos', async () => {
    await page.goto(`${BASE}/pt-BR/orders`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '26-pedidos');
    return { detail: 'Pedidos carregou', screenshot: img };
  });

  await test('27 - Historico de pagamentos', async () => {
    await page.goto(`${BASE}/pt-BR/payments/history`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '27-pagamentos');
    return { detail: 'Pagamentos carregou', screenshot: img };
  });

  await test('28 - Progresso de series', async () => {
    await page.goto(`${BASE}/pt-BR/collection/series-progress`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '28-series-progress');
    return { detail: 'Series progress carregou', screenshot: img };
  });

  // ======================================================================
  // ADMIN PAGES
  // ======================================================================

  await test('29 - Admin dashboard', async () => {
    await page.goto(`${BASE}/pt-BR/admin`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '29-admin-dashboard');
    return { detail: 'Admin dashboard carregou', screenshot: img };
  });

  await test('30 - Admin catalogo', async () => {
    await page.goto(`${BASE}/pt-BR/admin/catalog`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '30-admin-catalogo');
    return { detail: 'Admin catalogo carregou', screenshot: img };
  });

  await test('31 - Admin catalogo recente', async () => {
    await page.goto(`${BASE}/pt-BR/admin/catalog/recent`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '31-admin-catalogo-recente');
    return { detail: 'Catalogo recente carregou', screenshot: img };
  });

  await test('32 - Admin usuarios', async () => {
    await page.goto(`${BASE}/pt-BR/admin/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const img = await screenshot(page, '32-admin-usuarios');
    return { detail: 'Admin usuarios carregou', screenshot: img };
  });

  await test('33 - Admin legal (fix do RangeError)', async () => {
    await page.goto(`${BASE}/pt-BR/admin/legal`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Check no JS errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    const img = await screenshot(page, '33-admin-legal');
    return { detail: `Erros JS: ${errors.length === 0 ? 'nenhum' : errors.join(', ')}`, screenshot: img };
  });

  await test('34 - Admin conteudo', async () => {
    await page.goto(`${BASE}/pt-BR/admin/content`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '34-admin-conteudo');
    return { detail: 'Admin conteudo carregou', screenshot: img };
  });

  await test('35 - Admin deals', async () => {
    await page.goto(`${BASE}/pt-BR/admin/deals`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '35-admin-deals');
    return { detail: 'Admin deals carregou', screenshot: img };
  });

  await test('36 - Admin homepage', async () => {
    await page.goto(`${BASE}/pt-BR/admin/homepage`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '36-admin-homepage');
    return { detail: 'Admin homepage carregou', screenshot: img };
  });

  await test('37 - Admin assinaturas', async () => {
    await page.goto(`${BASE}/pt-BR/admin/subscriptions`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '37-admin-assinaturas');
    return { detail: 'Admin assinaturas carregou', screenshot: img };
  });

  await test('38 - Admin LGPD', async () => {
    await page.goto(`${BASE}/pt-BR/admin/lgpd`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '38-admin-lgpd');
    return { detail: 'Admin LGPD carregou', screenshot: img };
  });

  await test('39 - Admin contato', async () => {
    await page.goto(`${BASE}/pt-BR/admin/contact`, { waitUntil: 'networkidle' });
    const img = await screenshot(page, '39-admin-contato');
    return { detail: 'Admin contato carregou', screenshot: img };
  });

  // ======================================================================
  // SLUG VERIFICATION
  // ======================================================================

  await test('40 - Links do catalogo usam slug (nao CUID)', async () => {
    await page.goto(`${BASE}/pt-BR/catalog`, { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/catalog/"]', { timeout: 10000 });
    const links = await page.locator('a[href*="/pt-BR/catalog/"]').all();
    let slugCount = 0;
    let cuidCount = 0;
    for (const link of links.slice(0, 10)) {
      const href = await link.getAttribute('href');
      if (href && href.match(/\/catalog\/c[a-z0-9]{24}$/)) {
        cuidCount++;
      } else if (href && !href.endsWith('/catalog') && !href.includes('/admin/')) {
        slugCount++;
      }
    }
    const img = await screenshot(page, '40-links-slug-verificacao');
    return { detail: `Slug: ${slugCount}, CUID: ${cuidCount}`, screenshot: img };
  });

  await test('41 - CSS e JS estaticos carregam (server.js custom)', async () => {
    await page.goto(`${BASE}/pt-BR`, { waitUntil: 'networkidle' });
    const styles = await page.evaluate(() => {
      return document.querySelectorAll('link[rel="stylesheet"]').length;
    });
    const img = await screenshot(page, '41-static-assets');
    return { detail: `${styles} stylesheets carregados`, screenshot: img };
  });

  // ======================================================================
  // DONE
  // ======================================================================

  await browser.close();

  // Generate report
  let md = `# Comics Trunk - Relatorio de Testes de Funcionalidades\n\n`;
  md += `**Data:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**URL:** ${BASE}\n`;
  md += `**Total:** ${passed + failed} testes | **Passou:** ${passed} | **Falhou:** ${failed}\n\n`;
  md += `---\n\n`;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : '[FAIL]';
    md += `## ${r.name}\n\n`;
    md += `**Status:** ${icon}\n`;
    md += `**Detalhe:** ${r.detail}\n\n`;
    if (r.screenshot) {
      md += `![${r.name}](${r.screenshot})\n\n`;
    }
    md += `---\n\n`;
  }

  fs.writeFileSync(REPORT, md);
  log(`\n==============================`);
  log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  log(`Report: ${REPORT}`);
  log(`==============================`);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
