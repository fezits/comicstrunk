import { test, expect } from '../../fixtures';
import { OrdersPage, OrderDetailPage } from '../../page-objects/orders.page';
import { authedApiClient } from '../../helpers/api-client';
import { TEST_PREFIX, STORAGE_STATE_WITH_CONSENT } from '../../helpers/test-constants';

test.describe('Buyer Orders', () => {
  /**
   * Helper: create a complete order scenario via API.
   * Returns buyer, seller, order, and address info.
   */
  async function createOrderScenario(
    loginAsFreshUser: (suffix?: string) => Promise<{
      accessToken: string;
      id: string;
      refreshCookie: string;
      name: string;
      email: string;
      role: string;
    }>,
    dataFactory: {
      createAndApproveCatalogEntry: (o?: Record<string, unknown>) => Promise<{ id: string; title: string }>;
    },
    suffix: string,
  ) {
    // 1. Create catalog entry
    const entry = await dataFactory.createAndApproveCatalogEntry();

    // 2. Seller: add to collection, mark for sale
    const seller = await loginAsFreshUser(`seller_bo_${suffix}`);
    const sellerApi = authedApiClient(seller.accessToken);

    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'VERY_GOOD',
      pricePaid: 18.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 32.0,
    });

    // 3. Buyer: create address, add to cart, create order
    const buyer = await loginAsFreshUser(`buyer_bo_${suffix}`);
    const buyerApi = authedApiClient(buyer.accessToken);

    const addressRes = await buyerApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa`,
      street: `${TEST_PREFIX}Rua Teste`,
      number: '100',
      neighborhood: 'Centro',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '20040-020',
      isDefault: true,
    });
    const addressId = addressRes.data.data.id;

    await buyerApi.post('/cart', { collectionItemId });

    const orderRes = await buyerApi.post('/orders', { shippingAddressId: addressId });
    const order = orderRes.data.data;

    return { seller, buyer, order, entry, collectionItemId, addressId };
  }

  test('should display buyer orders list', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `list_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const orders = new OrdersPage(page);
    await orders.navigate();
    await orders.waitForContent();

    // Should show the heading
    await orders.expectHeading(/pedidos|orders/i);

    // Should have at least one order
    await orders.expectHasOrders();

    await context.close();
  });

  test('should filter orders by status', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `filter_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const orders = new OrdersPage(page);
    await orders.navigate();
    await orders.waitForContent();

    // Try filtering by PENDING status
    await orders.filterByStatus('Pendente');

    // Should still have orders (our order is PENDING)
    const count = await orders.getOrderCount();
    expect(count).toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test('should navigate to order detail page', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `detail_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    // Navigate directly to the order detail
    const detail = new OrderDetailPage(page);
    await detail.navigate(order.id);
    await detail.waitForContent();
    await detail.expectLoaded();

    // Order number should be visible
    const orderNumber = await detail.getOrderNumber();
    expect(orderNumber).toContain('CT-');

    // Status badge should show PENDING
    await detail.expectStatus(/pendente|pending/i);

    await context.close();
  });

  test('should cancel a PENDING order', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `cancel_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const detail = new OrderDetailPage(page);
    await detail.navigate(order.id);
    await detail.waitForContent();
    await detail.expectLoaded();

    // Cancel the order
    await detail.cancelOrder();

    // After cancellation, status should show CANCELLED
    await detail.expectStatus(/cancelad|cancelled/i);

    await context.close();
  });

  test('should show tracking info when order is SHIPPED', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { seller, buyer, order, collectionItemId } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `track_${Date.now()}`,
    );

    const sellerApi = authedApiClient(seller.accessToken);
    const buyerApi = authedApiClient(buyer.accessToken);

    // Get order items to find the order item ID
    const orderDetail = await buyerApi.get(`/orders/${order.id}`);
    const orderItem = orderDetail.data.data.orderItems[0];

    // Seller updates item status to PROCESSING first, then adds tracking
    await sellerApi.patch(`/orders/items/${orderItem.id}/status`, {
      status: 'PROCESSING',
    });

    await sellerApi.patch(`/shipping/tracking/${orderItem.id}`, {
      trackingCode: 'BR123456789CT',
      carrier: 'Correios',
    });

    // Verify the order item now has tracking info
    const updatedOrder = await buyerApi.get(`/orders/${order.id}`);
    const updatedItem = updatedOrder.data.data.orderItems[0];

    expect(updatedItem.status).toBe('SHIPPED');
    expect(updatedItem.trackingCode).toBe('BR123456789CT');
    expect(updatedItem.carrier).toBe('Correios');
  });
});
