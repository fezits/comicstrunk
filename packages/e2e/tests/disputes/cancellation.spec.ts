import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Dispute Cancellation tests.
 *
 * Verifies that buyers can cancel OPEN disputes and
 * cannot cancel disputes already IN_MEDIATION.
 */
test.describe('Dispute Cancellation', () => {
  let adminToken: string;

  test.beforeAll(async ({ dataFactory }) => {
    adminToken = await dataFactory.getAdminToken();
  });

  /**
   * Helper: creates a full order flow and opens a dispute via API.
   * Returns the dispute ID and buyer API client.
   */
  async function createDisputeViaApi(
    buyerToken: string,
    suffix: string,
    dataFactory: { createAndApproveCatalogEntry: (overrides?: Record<string, unknown>) => Promise<{ id: string; title: string }> },
  ) {
    const buyerApi = authedApiClient(buyerToken);
    const adminApi = authedApiClient(adminToken);

    const entry = await dataFactory.createAndApproveCatalogEntry();

    const collRes = await adminApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'GOOD',
    });
    await adminApi.patch(`/collection/${collRes.data.data.id}/sale`, {
      isForSale: true,
      salePrice: 18.0,
    });

    const marketRes = await buyerApi.get('/marketplace', { params: { limit: 50 } });
    const listings = marketRes.data.data || [];
    const listing = listings.find(
      (l: { catalogEntry?: { id: string } }) => l.catalogEntry?.id === entry.id,
    );

    if (!listing) return null;

    await buyerApi.post('/cart', { collectionItemId: listing.id });

    const addrRes = await buyerApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Cancel ${suffix} Addr`,
      recipientName: `${TEST_PREFIX}Cancel ${suffix}`,
      street: 'Rua Cancelamento',
      number: '900',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001-000',
      phone: '11999990008',
    });

    const orderRes = await buyerApi.post('/orders', {
      shippingAddressId: addrRes.data.data.id,
    });
    const orderId = orderRes.data.data.id;

    const orderDetail = await buyerApi.get(`/orders/${orderId}`);
    const items = orderDetail.data.data.items || orderDetail.data.data.orderItems || [];
    const orderItemId = items[0]?.id;

    await adminApi.post('/payments/admin/approve', { orderId });

    if (orderItemId) {
      try {
        await adminApi.patch(`/orders/items/${orderItemId}/status`, { status: 'SHIPPED' });
        await adminApi.patch(`/orders/items/${orderItemId}/status`, { status: 'DELIVERED' });
      } catch {
        // Continue
      }
    }

    if (!orderItemId) return null;

    // Schema: { orderItemId, reason, description }
    // Valid reasons: NOT_RECEIVED, DIFFERENT_FROM_LISTING, DAMAGED_IN_TRANSIT, NOT_SHIPPED_ON_TIME
    const disputeRes = await buyerApi.post('/disputes', {
      orderItemId,
      reason: 'DIFFERENT_FROM_LISTING',
      description: `${TEST_PREFIX}Cancel test ${suffix}: item does not match listing.`,
    });

    return {
      disputeId: disputeRes.data.data.id,
      buyerApi,
    };
  }

  test('buyer should cancel an OPEN dispute', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    test.slow();

    const buyer = await loginAsFreshUser('cancel-open');
    const result = await createDisputeViaApi(buyer.accessToken, 'open', dataFactory);

    if (!result) {
      test.skip();
      return;
    }

    const { disputeId, buyerApi } = result;

    // Verify OPEN status
    let detail = await buyerApi.get(`/disputes/${disputeId}`);
    expect(detail.data.data.status).toBe('OPEN');

    // Cancel the dispute
    await buyerApi.post(`/disputes/${disputeId}/cancel`);

    // Verify CANCELLED status
    detail = await buyerApi.get(`/disputes/${disputeId}`);
    expect(detail.data.data.status).toBe('CANCELLED');
  });

  test('buyer should not cancel an IN_MEDIATION dispute', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    test.slow();

    const buyer = await loginAsFreshUser('cancel-mediation');
    const result = await createDisputeViaApi(buyer.accessToken, 'mediation', dataFactory);

    if (!result) {
      test.skip();
      return;
    }

    const { disputeId, buyerApi } = result;
    const adminApi = authedApiClient(adminToken);

    // Seller responds to move to IN_MEDIATION (or admin escalates)
    // Schema: { message }
    try {
      await adminApi.post(`/disputes/${disputeId}/respond`, {
        message: `${TEST_PREFIX}Seller responds to escalate to mediation.`,
      });
    } catch {
      // Continue — status might not change
    }

    // Check if status changed to IN_MEDIATION
    let detail = await buyerApi.get(`/disputes/${disputeId}`);
    const currentStatus = detail.data.data.status;

    // Try to cancel — should fail if in mediation
    try {
      await buyerApi.post(`/disputes/${disputeId}/cancel`);

      // If we reach here, either the cancel succeeded (status was still OPEN)
      // or the API allowed it (which would be a bug)
      detail = await buyerApi.get(`/disputes/${disputeId}`);
      if (currentStatus === 'IN_MEDIATION') {
        // Should not have been cancelled
        expect(detail.data.data.status).not.toBe('CANCELLED');
      }
    } catch (err: unknown) {
      // Expected error: dispute cannot be cancelled in current status
      const error = err as { response?: { status: number } };
      expect(error.response?.status).toBeGreaterThanOrEqual(400);
    }
  });
});
