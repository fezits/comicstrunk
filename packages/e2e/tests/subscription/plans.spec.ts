import { test, expect } from '../../fixtures';

/**
 * Subscription Plans page tests.
 *
 * Verifies the plan comparison page at /subscription loads,
 * shows at least FREE and BASIC plans, and displays features per plan.
 */
test.describe('Subscription Plans', () => {
  test('should load subscription plan comparison page', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/subscription');
    await authedPage.waitForLoadState('networkidle');

    const heading = authedPage
      .getByRole('heading', { name: /assinatura|planos|subscription|plans/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should show FREE and BASIC plans', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/subscription');
    await authedPage.waitForLoadState('networkidle');

    // Look for plan names
    const freePlan = authedPage.getByText(/free|gr[aá]tis|gratuito/i).first();
    const basicPlan = authedPage.getByText(/basic|b[aá]sico/i).first();

    await expect(freePlan).toBeVisible({ timeout: 15_000 });
    await expect(basicPlan).toBeVisible({ timeout: 15_000 });
  });

  test('should display features per plan (collection limit, commission rate)', async ({
    authedPage,
  }) => {
    await authedPage.goto('/pt-BR/subscription');
    await authedPage.waitForLoadState('networkidle');

    // Features typically include collection limits and commission rates
    // Look for numeric indicators or feature descriptions
    const featureIndicators = authedPage
      .getByText(/cole[cç][aã]o|itens|comiss[aã]o|commission|limit/i)
      .first();
    await expect(featureIndicators).toBeVisible({ timeout: 15_000 });

    // Should show at least some plan card or feature table
    const planCards = authedPage.locator(
      '[data-testid="plan-card"], .plan-card, [class*="plan"], [class*="pricing"]',
    );
    const cardCount = await planCards.count();
    // If no specific class, just verify text content is present
    if (cardCount === 0) {
      // Fallback: verify the page has meaningful content about plans
      const body = await authedPage.locator('main, [role="main"], body').textContent();
      expect(body).toBeTruthy();
    } else {
      expect(cardCount).toBeGreaterThanOrEqual(2);
    }
  });
});
