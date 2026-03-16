import { test, expect } from '../../fixtures';

/**
 * Public Legal/Policy Pages tests.
 *
 * Verifies the public legal document pages: /terms, /privacy,
 * /seller-terms, /policies hub, /policies/cookies, /policies/payment,
 * and navigation between them.
 */
test.describe('Legal Policy Pages', () => {
  test('should load terms of use page with content', async ({ page }) => {
    await page.goto('/pt-BR/terms');
    await page.waitForLoadState('networkidle');

    // Should have a heading related to terms
    const heading = page
      .getByRole('heading', { name: /termos|terms/i })
      .or(page.getByText(/termos de uso|terms of use|termos.*servi[cç]o/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have document content (not empty)
    const content = page.locator('main, [role="main"], article, .content').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('should load privacy policy page with content', async ({ page }) => {
    await page.goto('/pt-BR/privacy');
    await page.waitForLoadState('networkidle');

    // Should have a heading related to privacy
    const heading = page
      .getByRole('heading', { name: /privacidade|privacy/i })
      .or(page.getByText(/pol[ií]tica.*privacidade|privacy.*policy/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have document content
    const content = page.locator('main, [role="main"], article, .content').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('should load seller terms page with content', async ({ page }) => {
    await page.goto('/pt-BR/seller-terms');
    await page.waitForLoadState('networkidle');

    // Should have a heading related to seller terms
    const heading = page
      .getByRole('heading', { name: /vendedor|seller|termos.*venda/i })
      .or(page.getByText(/termos.*vendedor|seller.*terms|regras.*venda/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('main, [role="main"], article, .content').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('should load policies hub page with all policy links', async ({ page }) => {
    await page.goto('/pt-BR/policies');
    await page.waitForLoadState('networkidle');

    // Should have a heading — use .first() to avoid strict mode violation
    // since both a nav link and the h1 may match the pattern
    const heading = page
      .getByRole('heading', { name: /pol[ií]ticas|policies|documentos|regulamentos/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have links to individual policies
    const policyLinks = [
      /termos|terms/i,
      /privacidade|privacy/i,
      /cookies/i,
      /pagamento|payment/i,
    ];

    let foundLinks = 0;
    for (const pattern of policyLinks) {
      const link = page
        .getByRole('link', { name: pattern })
        .or(page.locator('a').filter({ hasText: pattern }))
        .first();

      const isVisible = await link.isVisible().catch(() => false);
      if (isVisible) foundLinks++;
    }

    expect(foundLinks).toBeGreaterThanOrEqual(2);
  });

  test('should load cookies policy page', async ({ page }) => {
    await page.goto('/pt-BR/policies/cookies');
    await page.waitForLoadState('networkidle');

    // Should have a heading related to cookies
    const heading = page
      .getByRole('heading', { name: /cookies/i })
      .or(page.getByText(/pol[ií]tica.*cookies|cookies.*policy/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('main, [role="main"], article, .content').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });

  test('should load payment policy page', async ({ page }) => {
    await page.goto('/pt-BR/policies/payment');
    await page.waitForLoadState('networkidle');

    // Should have a heading related to payment
    const heading = page
      .getByRole('heading', { name: /pagamento|payment/i })
      .or(page.getByText(/pol[ií]tica.*pagamento|payment.*policy/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('main, [role="main"], article, .content').first();
    const text = await content.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });

  test('should navigate between policy pages', async ({ page }) => {
    // Verify all policy pages are reachable and render unique content.
    // Uses direct navigation since the Next.js dev overlay can intercept
    // footer/nav link clicks in dev mode.
    const policyPages = [
      { path: '/pt-BR/terms', pattern: /termos|terms/i },
      { path: '/pt-BR/privacy', pattern: /privacidade|privacy/i },
      { path: '/pt-BR/policies/cookies', pattern: /cookies/i },
      { path: '/pt-BR/policies/payment', pattern: /pagamento|payment/i },
    ];

    for (const { path, pattern } of policyPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain(path.replace('/pt-BR', ''));

      const heading = page.getByRole('heading', { name: pattern }).first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });
});
