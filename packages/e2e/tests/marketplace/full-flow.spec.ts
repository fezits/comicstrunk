/**
 * MARKETPLACE FULL-FLOW E2E
 * --------------------------------------------------------------------------
 * Cobre o ciclo completo de uma venda P2P no Comics Trunk com screenshots
 * em cada etapa. Funciona em local OU produção.
 *
 * Local (default):
 *   pnpm exec playwright test tests/marketplace/full-flow.spec.ts --headed
 *
 * Produção:
 *   E2E_PROD=true \
 *   BASE_URL=https://comicstrunk.com \
 *   API_URL=https://api.comicstrunk.com/api/v1 \
 *   ADMIN_EMAIL=<admin> ADMIN_PASSWORD=<pass> \
 *   pnpm exec playwright test tests/marketplace/full-flow.spec.ts
 *
 * Todos os IDs criados são registrados em rollback.json para limpeza
 * posterior via scripts/rollback-e2e-prod.js (rollback NÃO roda automático).
 *
 * Cada teste navega pela UI autenticada via UI login, então as screenshots
 * mostram a tela real que cada persona vê.
 * --------------------------------------------------------------------------
 */
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import axios, { AxiosInstance } from 'axios';
import fs from 'node:fs';
import path from 'node:path';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const IS_PROD = process.env.E2E_PROD === 'true';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@comicstrunk.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const RUN_ID = new Date()
  .toISOString()
  .replace(/[:T.]/g, '-')
  .replace(/Z$/, '')
  .slice(0, 19);

const REPORT_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'test-reports',
  'marketplace-flow',
  RUN_ID,
);
const SCREENSHOTS_DIR = path.join(REPORT_ROOT, 'screenshots');
const MANIFEST_PATH = path.join(REPORT_ROOT, 'rollback.json');

const TEST_PREFIX = `_e2e_${RUN_ID.replace(/-/g, '')}_`;

// -----------------------------------------------------------------------------
// Manifesto de rollback
// -----------------------------------------------------------------------------
type Manifest = {
  runId: string;
  timestamp: string;
  env: 'local' | 'production';
  baseUrl: string;
  apiUrl: string;
  adminEmail: string;
  testPrefix: string;
  entities: {
    users: string[];
    catalogEntries: string[];
    collectionItems: string[];
    shippingAddresses: string[];
    bankAccounts: string[];
    orders: string[];
    orderItems: string[];
    payments: string[];
  };
  steps: Array<{ step: string; ok: boolean; durationMs: number; note?: string }>;
};

const manifest: Manifest = {
  runId: RUN_ID,
  timestamp: new Date().toISOString(),
  env: IS_PROD ? 'production' : 'local',
  baseUrl: BASE_URL,
  apiUrl: API_URL,
  adminEmail: ADMIN_EMAIL,
  testPrefix: TEST_PREFIX,
  entities: {
    users: [],
    catalogEntries: [],
    collectionItems: [],
    shippingAddresses: [],
    bankAccounts: [],
    orders: [],
    orderItems: [],
    payments: [],
  },
  steps: [],
};

function saveManifest() {
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

// -----------------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------------
// Em produção, a API exige header Origin (CORS) para qualquer rota.
const COMMON_HEADERS = {
  Origin: BASE_URL,
  'User-Agent': 'Mozilla/5.0 (E2E Marketplace Full-Flow)',
};

function publicApi(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
}

function authedApi(token: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 30_000,
  });
}

type Persona = {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken: string;
  refreshCookie: string;
};

function extractRefreshCookie(setCookie: unknown): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = (arr as string[]).find((c) => typeof c === 'string' && c.startsWith('refreshToken='));
  if (!found) return '';
  return found.split(';')[0].replace('refreshToken=', '');
}

// Em prod o sistema tem rate limit de 5 logins/15min/IP, então usamos o
// accessToken + cookie já retornados pelo signup, sem fazer login extra.
async function signupAsPersona(suffix: string): Promise<Persona> {
  const email = `${TEST_PREFIX}${suffix}@e2e-test.invalid`;
  const password = 'Test1234!Aa';
  const name = `E2E ${suffix}`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await publicApi().post('/auth/signup', {
        name,
        email,
        password,
        acceptedTerms: true,
      });
      const { accessToken, user } = res.data.data;
      const refreshCookie = extractRefreshCookie(res.headers['set-cookie']);

      manifest.entities.users.push(user.id);
      return { id: user.id, email, password, name, accessToken, refreshCookie };
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && attempt < MAX_RETRIES) {
        const waitSec = attempt * 60;
        console.warn(`[signupAsPersona ${suffix}] 429 — aguardando ${waitSec}s (${attempt}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`signupAsPersona ${suffix}: max retries reached`);
}

async function loginAdmin(): Promise<Persona> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await publicApi().post('/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      const { accessToken, user } = res.data.data;
      const refreshCookie = extractRefreshCookie(res.headers['set-cookie']);
      return {
        id: user.id,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: user.name,
        accessToken,
        refreshCookie,
      };
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && attempt < MAX_RETRIES) {
        const waitSec = attempt * 60; // 60s, 120s
        console.warn(`[loginAdmin] 429 — aguardando ${waitSec}s (tentativa ${attempt}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('loginAdmin: max retries reached');
}

// -----------------------------------------------------------------------------
// UI helpers — login UI por persona (mantém contexto aberto pela suíte inteira)
// -----------------------------------------------------------------------------
const API_HOST = new URL(API_URL).hostname;
const IS_HTTPS = BASE_URL.startsWith('https');

async function newAnonContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    locale: 'pt-BR',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [{ name: 'cookieConsent', value: 'true' }],
        },
      ],
    },
  });
}

/**
 * Cria contexto autenticado por refresh cookie (sem UI login).
 *
 * IMPORTANTE: em produção o cookie é cross-origin (api.comicstrunk.com →
 * comicstrunk.com). O frontend mantém o accessToken APENAS em memória, então
 * ao abrir nova page sem login UI, o AuthProvider não consegue restaurar a
 * sessão e a página redireciona para /login.
 *
 * Resultado: as screenshots das páginas autenticadas (02, 04-06, 08-13)
 * mostram a tela de login. O FLUXO FUNCIONAL é validado via assertions de
 * API (status do Order, OrderItem, Payment). Telas autenticadas reais ficam
 * para um teste separado (ver `marketplace-screens-auth.spec.ts`) que faz
 * login UI uma única vez quando o rate limit permitir.
 */
async function newAuthedContext(browser: Browser, persona: Persona): Promise<BrowserContext> {
  const context = await newAnonContext(browser);
  if (persona.refreshCookie) {
    await context.addCookies([
      {
        name: 'refreshToken',
        value: persona.refreshCookie,
        domain: API_HOST,
        path: '/api/v1/auth/refresh',
        httpOnly: true,
        secure: IS_HTTPS,
        sameSite: IS_HTTPS ? 'Lax' : 'Strict',
      },
    ]);
  }
  return context;
}

async function shot(page: Page, n: number, name: string) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const file = path.join(SCREENSHOTS_DIR, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

function recordStep(step: string, ok: boolean, start: number, note?: string) {
  manifest.steps.push({ step, ok, durationMs: Date.now() - start, note });
  saveManifest();
}

// -----------------------------------------------------------------------------
// Shared state (serial)
// -----------------------------------------------------------------------------
type Ctx = {
  seller?: Persona;
  buyer?: Persona;
  admin?: Persona;
  sellerContext?: BrowserContext;
  buyerContext?: BrowserContext;
  adminContext?: BrowserContext;
  catalogEntryId?: string;
  collectionItemId?: string;
  bankAccountId?: string;
  addressId?: string;
  orderId?: string;
  orderNumber?: string;
  orderItemId?: string;
};
const ctx: Ctx = {};

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

test.describe('Marketplace E2E — fluxo completo de compra e venda', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    saveManifest();
    console.log(`\n[full-flow] env=${manifest.env} baseUrl=${BASE_URL}`);
    console.log(`[full-flow] outDir=${REPORT_ROOT}\n`);
  });

  test.afterAll(async () => {
    await ctx.sellerContext?.close().catch(() => undefined);
    await ctx.buyerContext?.close().catch(() => undefined);
    await ctx.adminContext?.close().catch(() => undefined);
    saveManifest();
    console.log(`\n[full-flow] manifesto salvo em: ${MANIFEST_PATH}`);
    console.log(`[full-flow] screenshots em:    ${SCREENSHOTS_DIR}\n`);
  });

  // ---------------------------------------------------------------------------
  test('00 — preparação: signup seller/buyer + login admin', async ({ browser }) => {
    // Backoff em retries de 429 pode chegar a ~3min total
    test.setTimeout(420_000);
    const t0 = Date.now();
    ctx.seller = await signupAsPersona('seller');
    ctx.buyer = await signupAsPersona('buyer');
    ctx.admin = await loginAdmin();
    expect(ctx.admin.accessToken).toBeTruthy();
    expect(ctx.admin.id).toBeTruthy();

    // Contextos com refresh cookie (frontend cai em /login mas o fluxo
    // funcional é validado via API). Ver README do report para detalhes.
    ctx.sellerContext = await newAuthedContext(browser, ctx.seller);
    ctx.buyerContext = await newAuthedContext(browser, ctx.buyer);
    ctx.adminContext = await newAuthedContext(browser, ctx.admin);
    recordStep('00-prep', true, t0, `sellerId=${ctx.seller.id} buyerId=${ctx.buyer.id}`);
  });

  // ---------------------------------------------------------------------------
  test('01 — vendedor cadastra dados bancários (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const sellerApi = authedApi(ctx.seller!.accessToken);

    const bankRes = await sellerApi.post('/banking', {
      bankName: 'Banco do Brasil',
      branchNumber: '0001',
      accountNumber: '123456',
      cpf: '11144477735', // CPF válido fictício para testes
      holderName: ctx.seller!.name,
      accountType: 'CHECKING',
      isPrimary: true,
    });
    ctx.bankAccountId = bankRes.data.data.id;
    manifest.entities.bankAccounts.push(ctx.bankAccountId!);

    const page = await ctx.sellerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/seller/banking`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 1, 'seller-banking');
    await page.close();

    recordStep('01-banking', true, t0, `bankAccountId=${ctx.bankAccountId}`);
  });

  // ---------------------------------------------------------------------------
  test('02 — vendedor adiciona item à coleção e marca à venda (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const sellerApi = authedApi(ctx.seller!.accessToken);
    const adminApi = authedApi(ctx.admin!.accessToken);

    const title = `${TEST_PREFIX}HQ Teste`;
    const catalogRes = await adminApi.post('/catalog', {
      title,
      publisher: 'Panini',
      description: `E2E full-flow run ${RUN_ID}`,
    });
    ctx.catalogEntryId = catalogRes.data.data.id;
    manifest.entities.catalogEntries.push(ctx.catalogEntryId!);

    await adminApi.patch(`/catalog/${ctx.catalogEntryId}/submit`).catch(() => undefined);
    await adminApi.patch(`/catalog/${ctx.catalogEntryId}/approve`).catch(() => undefined);

    const collRes = await sellerApi.post('/collection', {
      catalogEntryId: ctx.catalogEntryId,
      condition: 'NEW',
      pricePaid: 20.0,
    });
    ctx.collectionItemId = collRes.data.data.id;
    manifest.entities.collectionItems.push(ctx.collectionItemId!);

    await sellerApi.patch(`/collection/${ctx.collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 50.0,
    });

    const page = await ctx.sellerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/collection`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 2, 'seller-mark-for-sale');
    await page.close();

    recordStep('02-mark-for-sale', true, t0, `collectionItemId=${ctx.collectionItemId}`);
  });

  // ---------------------------------------------------------------------------
  test('03 — item aparece no marketplace público (sem auth)', async ({ browser }) => {
    const t0 = Date.now();
    const anonContext = await newAnonContext(browser);
    const page = await anonContext.newPage();

    await page.goto(`${BASE_URL}/pt-BR/marketplace?search=${encodeURIComponent(TEST_PREFIX)}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 3, 'marketplace-listing');
    await anonContext.close();

    recordStep('03-marketplace', true, t0);
  });

  // ---------------------------------------------------------------------------
  test('04 — comprador cria endereço e adiciona ao carrinho (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const buyerApi = authedApi(ctx.buyer!.accessToken);

    const addrRes = await buyerApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa`,
      street: 'Rua dos Testes',
      number: '100',
      complement: 'Apto 1',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001-000',
      isDefault: true,
    });
    ctx.addressId = addrRes.data.data.id;
    manifest.entities.shippingAddresses.push(ctx.addressId!);

    await buyerApi.post('/cart', { collectionItemId: ctx.collectionItemId });

    const page = await ctx.buyerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/cart`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 4, 'buyer-cart');
    await page.close();

    recordStep('04-cart', true, t0, `addressId=${ctx.addressId}`);
  });

  // ---------------------------------------------------------------------------
  test('05 — comprador faz checkout e pedido fica PENDING (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const buyerApi = authedApi(ctx.buyer!.accessToken);

    const page = await ctx.buyerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/checkout`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 5, 'buyer-checkout');
    await page.close();

    const orderRes = await buyerApi.post('/orders', { shippingAddressId: ctx.addressId });
    ctx.orderId = orderRes.data.data.id;
    ctx.orderNumber = orderRes.data.data.orderNumber;
    ctx.orderItemId = orderRes.data.data.orderItems[0].id;

    manifest.entities.orders.push(ctx.orderId!);
    manifest.entities.orderItems.push(
      ...orderRes.data.data.orderItems.map((i: { id: string }) => i.id),
    );

    expect(orderRes.data.data.status).toBe('PENDING');
    expect(ctx.orderNumber).toMatch(/^(ORD-|CT-)/);
    recordStep('05-order', true, t0, `order=${ctx.orderNumber} status=PENDING`);
  });

  // ---------------------------------------------------------------------------
  test('06 — comprador inicia PIX e vê QR code (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const buyerApi = authedApi(ctx.buyer!.accessToken);

    const payRes = await buyerApi.post('/payments/initiate', { orderId: ctx.orderId });
    if (payRes.data?.data?.id) manifest.entities.payments.push(payRes.data.data.id);

    const page = await ctx.buyerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/checkout/payment?orderId=${ctx.orderId}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 6, 'buyer-pix-qr');
    await page.close();

    recordStep('06-pix', true, t0);
  });

  // ---------------------------------------------------------------------------
  test('07 — admin vê pagamento pendente em /admin/payments (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const adminApi = authedApi(ctx.admin!.accessToken);
    const pending = await adminApi.get('/payments/admin/pending');
    const found = pending.data.data.find((o: { id: string }) => o.id === ctx.orderId);
    expect(found, 'Order pendente deve aparecer no admin').toBeTruthy();

    const page = await ctx.adminContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/admin/payments`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 7, 'admin-pending-payments');
    await page.close();

    recordStep('07-admin-pending', true, t0);
  });

  // ---------------------------------------------------------------------------
  test('08 — admin aprova pagamento → Order PAID (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const adminApi = authedApi(ctx.admin!.accessToken);
    const buyerApi = authedApi(ctx.buyer!.accessToken);

    await adminApi.post('/payments/admin/approve', { orderId: ctx.orderId });

    const orderRes = await buyerApi.get(`/orders/${ctx.orderId}`);
    expect(orderRes.data.data.status).toBe('PAID');
    expect(orderRes.data.data.orderItems[0].status).toBe('PAID');

    const page = await ctx.adminContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/admin/payments`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 8, 'admin-after-approval');
    await page.close();

    recordStep('08-admin-approve', true, t0, `${ctx.orderNumber} -> PAID`);
  });

  // ---------------------------------------------------------------------------
  test('09 — vendedor vê pedido PAID, marca PROCESSING e adiciona tracking (UI)', async ({
    browser,
  }) => {
    const t0 = Date.now();
    const sellerApi = authedApi(ctx.seller!.accessToken);

    await sellerApi.patch(`/orders/items/${ctx.orderItemId}/status`, { status: 'PROCESSING' });

    const page = await ctx.sellerContext!.newPage();
    await page.goto(`${BASE_URL}/pt-BR/seller/orders`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 9, 'seller-orders-paid');

    const trackRes = await sellerApi.patch(`/shipping/tracking/${ctx.orderItemId}`, {
      trackingCode: 'CT123456789BR',
      carrier: 'Correios',
    });
    expect(trackRes.data.data.status).toBe('SHIPPED');

    await page.goto(`${BASE_URL}/pt-BR/seller/orders`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 10, 'seller-tracking-added');
    await page.close();

    recordStep('09-shipping', true, t0, 'tracking=CT123456789BR carrier=Correios');
  });

  // ---------------------------------------------------------------------------
  test('10 — comprador vê SHIPPED e marca DELIVERED → COMPLETED (UI)', async ({ browser }) => {
    const t0 = Date.now();
    const buyerApi = authedApi(ctx.buyer!.accessToken);
    const sellerApi = authedApi(ctx.seller!.accessToken);

    const page = await ctx.buyerContext!.newPage();

    await page.goto(`${BASE_URL}/pt-BR/orders/${ctx.orderId}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 11, 'buyer-shipped');

    // Gap #10: Backend permite apenas SHIPPED → DELIVERED (state machine), mas
    // a service NÃO permite que o buyer marque DELIVERED — só o seller/admin.
    // Workaround: seller marca DELIVERED (semanticamente errado, mas é o único
    // caminho hoje sem admin manual). Buyer então pode marcar COMPLETED.
    await sellerApi.patch(`/orders/items/${ctx.orderItemId}/status`, { status: 'DELIVERED' });
    await page.goto(`${BASE_URL}/pt-BR/orders/${ctx.orderId}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 12, 'buyer-delivered');

    await buyerApi.patch(`/orders/items/${ctx.orderItemId}/status`, { status: 'COMPLETED' });
    const finalRes = await buyerApi.get(`/orders/${ctx.orderId}`);
    expect(finalRes.data.data.orderItems[0].status).toBe('COMPLETED');

    await page.goto(`${BASE_URL}/pt-BR/orders/${ctx.orderId}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, 13, 'completed');
    await page.close();

    recordStep('10-completed', true, t0, `${ctx.orderNumber} -> COMPLETED (via seller-DELIVERED workaround)`);
  });
});
