/**
 * Smoke tests against production with screenshots as evidence.
 * Run: cd packages/e2e && pnpm exec playwright test ../../docs/test-reports/run-smoke-tests.ts
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';

const BASE = 'https://comicstrunk.com';
const API = 'https://api.comicstrunk.com';
const SCREENSHOTS = path.join(__dirname, 'screenshots');

test.use({
  baseURL: BASE,
  screenshot: 'only-on-failure',
  viewport: { width: 1280, height: 720 },
});

// === PÁGINAS PÚBLICAS ===

test.describe('Páginas Públicas', () => {
  test('Homepage carrega com conteúdo', async ({ page }) => {
    await page.goto('/pt-BR');
    await expect(page).toHaveTitle(/Comics Trunk/);
    await page.screenshot({ path: path.join(SCREENSHOTS, '01-homepage.png'), fullPage: true });
  });

  test('Catálogo lista gibis com capas', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForSelector('[class*="card"], [class*="catalog"], img', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOTS, '02-catalogo.png'), fullPage: false });
    // Verifica que não tem NaN visível
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('NaN');
  });

  test('Busca no catálogo funciona', async ({ page }) => {
    await page.goto('/pt-BR/catalog?title=batman');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '03-busca-batman.png'), fullPage: false });
    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toContain('batman');
  });

  test('Detalhe do gibi carrega', async ({ page }) => {
    // Pega primeiro gibi do catálogo via API
    const res = await page.request.get(`${API}/api/v1/catalog?limit=1`);
    const data = await res.json();
    const id = data.data[0]?.id;
    if (!id) return;

    await page.goto(`/pt-BR/catalog/${id}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '04-detalhe-gibi.png'), fullPage: false });
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('NaN');
  });

  test('Séries lista corretamente', async ({ page }) => {
    await page.goto('/pt-BR/series');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '05-series.png'), fullPage: false });
  });

  test('Marketplace carrega', async ({ page }) => {
    await page.goto('/pt-BR/marketplace');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '06-marketplace.png'), fullPage: false });
  });

  test('Ofertas carrega', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '07-ofertas.png'), fullPage: false });
  });

  test('Contato carrega', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '08-contato.png'), fullPage: false });
  });

  test('Políticas/Termos/Privacidade carregam', async ({ page }) => {
    await page.goto('/pt-BR/terms');
    await page.screenshot({ path: path.join(SCREENSHOTS, '09-termos.png') });
    await page.goto('/pt-BR/privacy');
    await page.screenshot({ path: path.join(SCREENSHOTS, '10-privacidade.png') });
    await page.goto('/pt-BR/policies');
    await page.screenshot({ path: path.join(SCREENSHOTS, '11-politicas.png') });
  });
});

// === ACENTOS E LABELS ===

test.describe('Acentos e Labels', () => {
  test('Labels têm acentos corretos no menu', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForTimeout(1000);
    const bodyText = await page.textContent('body') || '';

    // Não deve ter labels sem acento
    const badLabels = ['Catalogo', 'Colecao', 'Configuracoes', 'Notificacoes', 'Avaliacao'];
    for (const bad of badLabels) {
      if (bodyText.includes(bad)) {
        await page.screenshot({ path: path.join(SCREENSHOTS, `FAIL-acento-${bad}.png`) });
      }
      expect(bodyText, `Label sem acento encontrado: "${bad}"`).not.toContain(bad);
    }
  });

  test('Títulos dos gibis têm acentos corretos', async ({ page }) => {
    await page.goto('/pt-BR/catalog?title=edicao');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '12-acentos-titulos.png'), fullPage: false });
    const bodyText = await page.textContent('body') || '';
    // "Edição" deve aparecer, não "Edicao"
    expect(bodyText).toContain('Edição');
  });
});

// === AVALIAÇÕES (NaN) ===

test.describe('Avaliações sem NaN', () => {
  test('Catálogo não mostra NaN', async ({ page }) => {
    await page.goto('/pt-BR/catalog');
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body') || '';
    if (bodyText.includes('NaN')) {
      await page.screenshot({ path: path.join(SCREENSHOTS, 'FAIL-nan-catalogo.png'), fullPage: true });
    }
    expect(bodyText).not.toContain('NaN');
  });
});

// === AUTH ===

test.describe('Autenticação', () => {
  test('Página de login carrega', async ({ page }) => {
    await page.goto('/pt-BR/login');
    await page.screenshot({ path: path.join(SCREENSHOTS, '13-login.png') });
  });

  test('Página de cadastro carrega', async ({ page }) => {
    await page.goto('/pt-BR/signup');
    await page.screenshot({ path: path.join(SCREENSHOTS, '14-cadastro.png') });
  });
});

// === API ENDPOINTS ===

test.describe('API Endpoints', () => {
  test('Catálogo retorna dados', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/catalog?limit=3`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.pagination.total).toBeGreaterThan(20000);
  });

  test('Categorias retorna dados', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/categories`);
    expect(res.status()).toBe(200);
  });

  test('Séries retorna dados', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/series?limit=3`);
    expect(res.status()).toBe(200);
  });

  test('Busca funciona', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/catalog?title=batman&limit=3`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].title.toLowerCase()).toContain('batman');
  });

  test('Imagem de capa é acessível', async ({ request }) => {
    const catalog = await (await request.get(`${API}/api/v1/catalog?limit=1`)).json();
    const coverUrl = catalog.data[0]?.coverImageUrl;
    if (coverUrl) {
      const imgRes = await request.get(coverUrl);
      expect(imgRes.status()).toBe(200);
      expect(imgRes.headers()['content-type']).toContain('image');
    }
  });

  test('Auth rejeita credenciais inválidas', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: 'fake@test.com', password: 'wrong' },
    });
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test('Rota protegida rejeita sem token', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/users/profile`);
    expect(res.status()).toBe(401);
  });
});

// === RESPONSIVO ===

test.describe('Responsivo', () => {
  test('Mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt-BR/catalog`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '15-mobile-catalogo.png'), fullPage: false });
    await ctx.close();
  });

  test('Tablet viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt-BR/catalog`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '16-tablet-catalogo.png'), fullPage: false });
    await ctx.close();
  });
});
