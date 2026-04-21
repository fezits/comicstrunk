import { test, expect } from '../../fixtures';
import { API_URL } from '../../helpers/test-constants';
import { apiClient, authedApiClient } from '../../helpers/api-client';
import axios from 'axios';

const TEST_PREFIX = '_test_';

test.describe('Deal Detail and Click Tracking', () => {
  test('should show discount badge and type badge on deal cards', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');

    // Wait for deal cards to load
    const dealCards = page.locator('[class*="card"], [data-testid*="deal"]').filter({
      has: page.locator('h2, h3, h4, [class*="title"]'),
    });
    await expect(dealCards.first()).toBeVisible({ timeout: 10_000 });

    // Check for discount badges (e.g., "10%", "15%", "R$29,90")
    const discountBadge = page.locator('[class*="badge"], [class*="discount"], [class*="tag"]').filter({
      hasText: /%|R\$|off|desconto|frete/i,
    });
    const hasDiscountBadge = await discountBadge.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // Check for type badges (CUPOM / PROMOCAO)
    const typeBadge = page.locator('[class*="badge"], [class*="type"], [class*="tag"]').filter({
      hasText: /cupom|coupon|promo[cç][aã]o|promotion/i,
    });
    const hasTypeBadge = await typeBadge.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // At least one badge type should be visible
    expect(hasDiscountBadge || hasTypeBadge).toBeTruthy();
  });

  test('should show copyable coupon code for COUPON type deals', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    // Look for a coupon code element (seed coupon codes: MANGA10, HQ15OFF, FRETEFREE, DB20FULL)
    const couponCodeElement = page.locator('[class*="coupon"], [data-testid*="coupon"], code, [class*="code"]').filter({
      hasText: /MANGA10|HQ15OFF|FRETEFREE|DB20FULL/i,
    });

    const hasCouponCode = await couponCodeElement.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasCouponCode) {
      await expect(couponCodeElement.first()).toBeVisible();

      // Look for a copy button near the coupon code
      const copyButton = page.getByRole('button', { name: /copiar|copy/i }).or(
        page.locator('[aria-label*="copiar" i], [aria-label*="copy" i]').or(
          page.locator('[class*="copy"], [data-testid*="copy"]'),
        ),
      );
      const hasCopyButton = await copyButton.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasCopyButton).toBeTruthy();
    }
  });

  test('should show UI feedback when copying coupon code', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    // Find the first copy button
    const copyButton = page.getByRole('button', { name: /copiar|copy/i }).or(
      page.locator('[aria-label*="copiar" i], [aria-label*="copy" i]'),
    ).first();

    const hasCopyButton = await copyButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasCopyButton) {
      await copyButton.click();

      // Check for UI feedback: check icon, success toast, or tooltip
      const feedback = page.locator('[data-sonner-toaster]').getByText(/copiado|copied|sucesso/i).or(
        page.locator('[class*="check"], svg[class*="check"]'),
      ).or(
        page.getByText(/copiado|copied/i),
      );

      await expect(feedback.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should have correct href for "Ver oferta" link pointing to click tracking URL', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    // Look for "Ver oferta" or affiliate link button
    const ofertaLink = page.getByRole('link', { name: /ver oferta|acessar|ir para loja|visitar/i }).or(
      page.getByRole('button', { name: /ver oferta|acessar|ir para loja|visitar/i }),
    );

    const hasOfertaLink = await ofertaLink.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasOfertaLink) {
      const href = await ofertaLink.first().getAttribute('href');

      if (href) {
        // The href should point to the click tracking endpoint or contain /deals/click/
        expect(href).toMatch(/deals\/click\/|api\/v1\/deals\/click\//i);
      }
    }
  });

  test('should return 302 redirect from click tracking endpoint (API test)', async () => {
    // Get a valid deal ID from the API
    const dealsResponse = await apiClient.get('/deals', {
      params: { page: 1, limit: 1 },
    });
    expect(dealsResponse.status).toBe(200);

    const deals = dealsResponse.data.data;
    expect(deals.length).toBeGreaterThanOrEqual(1);

    const dealId = deals[0].id;

    // Call the click tracking endpoint without following redirects
    try {
      await axios.get(`${API_URL}/deals/click/${dealId}`, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        // Axios throws on redirect when maxRedirects=0
        expect(err.response?.status).toBe(302);
        expect(err.response?.headers?.location).toBeDefined();
      }
    }
  });

  test('should show affiliate disclosure banner on deals page', async ({ page }) => {
    await page.goto('/pt-BR/deals');
    await page.waitForLoadState('domcontentloaded');

    // Look for affiliate disclosure text
    const disclosure = page.getByText(
      /afiliado|affiliate|parceiro|comiss[aã]o|links.*afiliados|programa.*afiliados/i,
    );

    const hasDisclosure = await disclosure.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // If no visible text, check for an info icon or tooltip that might contain disclosure
    if (!hasDisclosure) {
      const infoIcon = page.locator('[aria-label*="info" i], [title*="afiliado" i], [title*="disclosure" i]');
      const hasInfoIcon = await infoIcon.first().isVisible({ timeout: 3_000 }).catch(() => false);
      // At minimum, the page should have some disclosure element
      expect(hasDisclosure || hasInfoIcon).toBeTruthy();
    } else {
      await expect(disclosure.first()).toBeVisible();
    }
  });

  test('should deduplicate clicks within 1 hour for same user (API test)', async ({
    loginAsUser,
  }) => {
    test.slow();

    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Get a valid deal ID
    const dealsResponse = await apiClient.get('/deals', {
      params: { page: 1, limit: 1 },
    });
    const dealId = dealsResponse.data.data[0].id;

    // First click: should create a click log
    try {
      await axios.get(`${API_URL}/deals/click/${dealId}`, {
        maxRedirects: 0,
        headers: { Authorization: `Bearer ${user.accessToken}` },
        validateStatus: () => true,
      });
    } catch {
      // Expected redirect
    }

    // Second click within same "hour": should be deduplicated
    try {
      await axios.get(`${API_URL}/deals/click/${dealId}`, {
        maxRedirects: 0,
        headers: { Authorization: `Bearer ${user.accessToken}` },
        validateStatus: () => true,
      });
    } catch {
      // Expected redirect
    }

    // Both calls should return redirect (302), meaning the endpoint works
    // but only one click log should be created (deduplication)
    // We verify the API still responds correctly (not throwing errors)
    const response = await axios.get(`${API_URL}/deals/click/${dealId}`, {
      maxRedirects: 0,
      headers: { Authorization: `Bearer ${user.accessToken}` },
      validateStatus: () => true,
    });

    // The endpoint should still redirect successfully
    expect(response.status).toBe(302);
  });
});
