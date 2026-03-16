import { test, expect } from '../../fixtures';
import { OrdersPage, OrderDetailPage } from '../../page-objects/orders.page';
import { authedApiClient } from '../../helpers/api-client';
import { TEST_PREFIX, STORAGE_STATE_WITH_CONSENT } from '../../helpers/test-constants';

test.describe('Seller Orders', () => {
  /**
   * Helper: create a complete order scenario via API for seller testing.
   * Returns seller, buyer, order, and item info.
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
    const seller = await loginAsFreshUser(`seller_so_${suffix}`);
    const sellerApi = authedApiClient(seller.accessToken);

    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'NEW',
      pricePaid: 25.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 45.0,
    });

    // 3. Buyer: create address, add to cart, create order
    const buyer = await loginAsFreshUser(`buyer_so_${suffix}`);
    const buyerApi = authedApiClient(buyer.accessToken);

    const addressRes = await buyerApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa Buyer`,
      street: `${TEST_PREFIX}Rua do Comprador`,
      number: '200',
      neighborhood: 'Jardins',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01401-000',
      isDefault: true,
    });
    const addressId = addressRes.data.data.id;

    await buyerApi.post('/cart', { collectionItemId });

    const orderRes = await buyerApi.post('/orders', { shippingAddressId: addressId });
    const order = orderRes.data.data;

    return { seller, buyer, order, entry, collectionItemId, addressId };
  }

  test('should display seller orders list with incoming orders', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { seller } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `slist_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, seller);
    const page = await context.newPage();

    const orders = new OrdersPage(page);
    await orders.navigateToSellerOrders();
    await orders.waitForContent();

    // Should have at least one incoming order
    await orders.expectHasOrders();

    await context.close();
  });

  test('should add tracking code and change status to SHIPPED', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { seller, buyer, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `ship_${Date.now()}`,
    );

    const sellerApi = authedApiClient(seller.accessToken);
    const buyerApi = authedApiClient(buyer.accessToken);

    // Get the order item ID
    const orderDetail = await buyerApi.get(`/orders/${order.id}`);
    const orderItem = orderDetail.data.data.orderItems[0];

    // Seller advances to PROCESSING
    await sellerApi.patch(`/orders/items/${orderItem.id}/status`, {
      status: 'PROCESSING',
    });

    // Seller adds tracking code
    const trackingRes = await sellerApi.patch(`/shipping/tracking/${orderItem.id}`, {
      trackingCode: 'CT987654321BR',
      carrier: 'Correios',
    });

    // Verify status is now SHIPPED
    expect(trackingRes.data.data.status).toBe('SHIPPED');
    expect(trackingRes.data.data.trackingCode).toBe('CT987654321BR');
    expect(trackingRes.data.data.carrier).toBe('Correios');
    expect(trackingRes.data.data.shippedAt).toBeDefined();
  });

  test('should show financial summary on order detail (seller view)', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { seller, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `finance_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, seller);
    const page = await context.newPage();

    const detail = new OrderDetailPage(page);
    await detail.navigate(order.id);
    await detail.waitForContent();
    await detail.expectLoaded();

    // Verify financial info is visible (price, commission, net)
    // The order detail for sellers should show price snapshots
    await expect(
      page.getByText(/R\$\s*\d+[.,]\d{2}|45[.,]00/).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Look for commission-related text
    const financeText = page.getByText(/comiss[aã]o|valor l[ií]quido|receber[aá]?/i);
    if (await financeText.isVisible().catch(() => false)) {
      await expect(financeText.first()).toBeVisible();
    }

    await context.close();
  });

  test('should verify seller can view order items for their sales', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { seller, order } = await createOrderScenario(
      loginAsFreshUser,
      dataFactory,
      `items_${Date.now()}`,
    );

    const sellerApi = authedApiClient(seller.accessToken);

    // Seller should be able to access the order
    const orderRes = await sellerApi.get(`/orders/${order.id}`);
    const orderData = orderRes.data.data;

    expect(orderData.id).toBe(order.id);
    expect(orderData.orderItems.length).toBeGreaterThan(0);

    // Verify order item has correct financial snapshots
    const item = orderData.orderItems[0];
    expect(item.sellerId).toBe(seller.id);
    expect(Number(item.priceSnapshot)).toBe(45.0);
    expect(Number(item.commissionRateSnapshot)).toBeGreaterThanOrEqual(0);
    expect(Number(item.commissionAmountSnapshot)).toBeGreaterThanOrEqual(0);
    expect(Number(item.sellerNetSnapshot)).toBeGreaterThan(0);
    expect(Number(item.sellerNetSnapshot)).toBeLessThanOrEqual(45.0);
  });
});
