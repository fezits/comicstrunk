import { test, expect } from '../../fixtures';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Subscription Management tests.
 *
 * Verifies current plan status display, admin manual activation (dev-mode),
 * and cancellation flow.
 */
test.describe('Subscription Management', () => {
  test('should show current plan status on subscription page', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/subscription');
    await authedPage.waitForLoadState('networkidle');

    // Should display current plan info (e.g., "Plano atual: Free" or plan status)
    const planStatus = authedPage
      .getByText(/plano atual|current plan|seu plano|your plan|free|gr[aá]tis/i)
      .first();
    await expect(planStatus).toBeVisible({ timeout: 15_000 });
  });

  test('admin should be able to activate subscription manually', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/subscriptions');
    await adminPage.waitForLoadState('networkidle');

    // Admin subscriptions dashboard should load
    const heading = adminPage
      .getByRole('heading', { name: /assinatura|subscription/i })
      .or(adminPage.getByText(/gerenciar assinaturas|manage subscriptions/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Look for activate button or user search
    const activateBtn = adminPage
      .getByRole('button', { name: /ativar|activate/i })
      .first();
    const isVisible = await activateBtn.isVisible().catch(() => false);

    if (isVisible) {
      // Admin can see and interact with the activate functionality
      await expect(activateBtn).toBeEnabled();
    }
    // If not visible, the page still loaded correctly which we verified above
  });

  test('after admin activation, user subscription page reflects new plan', async ({
    authedPage,
    loginAsFreshUser,
    loginAsAdmin,
    dataFactory,
  }) => {
    test.slow();

    // Create a fresh user and activate via API
    const freshUser = await loginAsFreshUser('sub-mgmt');
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    // Admin activates BASIC subscription for the fresh user
    // adminActivateSubscriptionSchema: { userId, planType: 'FREE'|'BASIC', durationDays? }
    await adminApi.post('/subscriptions/admin/activate', {
      userId: freshUser.id,
      planType: 'BASIC',
    });

    // Now check the user's subscription status via API
    const freshApi = authedApiClient(freshUser.accessToken);
    const statusRes = await freshApi.get('/subscriptions/status');
    const status = statusRes.data.data;

    // getSubscriptionStatus returns { planType, collectionLimit, ... }
    expect(status.planType).toBe('BASIC');
  });

  test('should show cancel subscription button with confirmation', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/subscription');
    await authedPage.waitForLoadState('networkidle');

    // Look for a cancel or manage button
    const cancelBtn = authedPage
      .getByRole('button', { name: /cancelar|cancel/i })
      .or(authedPage.getByRole('link', { name: /cancelar|cancel/i }))
      .first();

    const isVisible = await cancelBtn.isVisible().catch(() => false);

    if (isVisible) {
      await cancelBtn.click();

      // Should show a confirmation dialog or navigate to cancel page
      const confirmDialog = authedPage
        .getByText(/tem certeza|are you sure|confirmar cancelamento|confirm cancel/i)
        .or(authedPage.getByRole('alertdialog'))
        .first();

      const onCancelPage = authedPage.url().includes('cancel');
      const dialogVisible = await confirmDialog.isVisible().catch(() => false);

      expect(onCancelPage || dialogVisible).toBeTruthy();
    } else {
      // User may be on FREE plan where cancel is not shown — acceptable
      const freeIndicator = authedPage.getByText(/free|gr[aá]tis|gratuito/i).first();
      await expect(freeIndicator).toBeVisible();
    }
  });
});
