import { test, expect } from '../../fixtures';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Subscription Limits tests.
 *
 * Verifies that FREE plan has a 50 item collection limit and
 * BASIC plan has a 200 item limit.
 */
test.describe('Subscription Limits', () => {
  test('FREE plan should have 50 item collection limit', async ({
    loginAsFreshUser,
  }) => {
    const freshUser = await loginAsFreshUser('limit-free');
    const api = authedApiClient(freshUser.accessToken);

    // Check subscription status for a free user
    // getSubscriptionStatus returns { planType, collectionLimit, ... }
    const statusRes = await api.get('/subscriptions/status');
    const status = statusRes.data.data;

    // Free plan should have a limit of 50
    expect(status.planType).toBe('FREE');
    expect(status.collectionLimit).toBe(50);
  });

  test('BASIC plan should have 200 item collection limit', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const freshUser = await loginAsFreshUser('limit-basic');
    const adminToken = await dataFactory.getAdminToken();
    const adminApi = authedApiClient(adminToken);

    // Activate BASIC plan for the fresh user
    // adminActivateSubscriptionSchema: { userId, planType: 'FREE'|'BASIC', durationDays? }
    await adminApi.post('/subscriptions/admin/activate', {
      userId: freshUser.id,
      planType: 'BASIC',
    });

    // Verify the limit changed
    // getSubscriptionStatus returns { planType, collectionLimit, ... }
    const userApi = authedApiClient(freshUser.accessToken);
    const statusRes = await userApi.get('/subscriptions/status');
    const status = statusRes.data.data;

    expect(status.planType).toBe('BASIC');
    expect(status.collectionLimit).toBe(200);
  });
});
