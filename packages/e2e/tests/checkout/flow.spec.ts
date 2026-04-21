import { test, expect } from '../../fixtures';
import { CartPage } from '../../page-objects/cart.page';
import { CheckoutPage } from '../../page-objects/checkout.page';
import { authedApiClient } from '../../helpers/api-client';
import { TEST_PREFIX, STORAGE_STATE_WITH_CONSENT } from '../../helpers/test-constants';

test.describe('Checkout Flow', () => {
  /**
   * Helper: set up a complete checkout scenario via API.
   * Creates a seller with a for-sale listing, a buyer with the item in cart and an address.
   */
  async function setupCheckoutScenario(
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
    // 1. Create and approve a catalog entry
    const entry = await dataFactory.createAndApproveCatalogEntry();

    // 2. Create seller, add to collection, mark for sale
    const seller = await loginAsFreshUser(`seller_chk_${suffix}`);
    const sellerApi = authedApiClient(seller.accessToken);

    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'NEW',
      pricePaid: 20.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 35.0,
    });

    // 3. Create buyer, add item to cart, create address
    const buyer = await loginAsFreshUser(`buyer_chk_${suffix}`);
    const buyerApi = authedApiClient(buyer.accessToken);

    await buyerApi.post('/cart', { collectionItemId });

    const addressRes = await buyerApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa`,
      street: `${TEST_PREFIX}Rua dos Testes`,
      number: '123',
      complement: 'Apto 42',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001-000',
      isDefault: true,
    });
    const addressId = addressRes.data.data.id;

    return { seller, buyer, collectionItemId, entry, addressId };
  }

  test('should complete full checkout flow: cart -> checkout -> confirm', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer, addressId } = await setupCheckoutScenario(
      loginAsFreshUser,
      dataFactory,
      `full_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    // Step 1: Visit cart sidebar — verify item is there
    const cart = new CartPage(page);
    await cart.navigate();
    await cart.waitForContent();
    await cart.expectHasItems();

    // Step 2: Proceed to checkout
    await cart.proceedToCheckout();

    // Step 3: Verify checkout page loaded
    const checkout = new CheckoutPage(page);
    await checkout.waitForContent();
    await expect(page).toHaveURL(/checkout/i);

    // Step 4: Address should already be selected (default address)
    await checkout.expectAddressSectionVisible();

    // Step 5: Order summary should be visible
    await checkout.expectOrderSummaryVisible();

    // Step 6: Confirm the order
    await checkout.confirmOrder();

    // Step 7: Should redirect to order confirmation or orders page
    await page.waitForURL(
      (url) => url.pathname.includes('/orders') || url.pathname.includes('/confirmation'),
      { timeout: 15_000 },
    );

    await context.close();
  });

  test('should create new address during checkout', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    // Set up scenario without a pre-existing address
    const entry = await dataFactory.createAndApproveCatalogEntry();

    const seller = await loginAsFreshUser(`seller_newaddr_${Date.now()}`);
    const sellerApi = authedApiClient(seller.accessToken);

    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'GOOD',
      pricePaid: 15.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 22.0,
    });

    const buyer = await loginAsFreshUser(`buyer_newaddr_${Date.now()}`);
    const buyerApi = authedApiClient(buyer.accessToken);
    await buyerApi.post('/cart', { collectionItemId });

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    // Go to checkout
    const checkout = new CheckoutPage(page);
    await checkout.navigate();
    await checkout.waitForContent();

    // Fill in a new address
    await checkout.fillNewAddress({
      label: `${TEST_PREFIX}Trabalho`,
      street: `${TEST_PREFIX}Av Paulista`,
      number: '1000',
      complement: 'Sala 501',
      neighborhood: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01310-100',
    });

    // Verify the new address appears as selected/available
    await expect(
      page.getByText(new RegExp(`${TEST_PREFIX}Av Paulista|${TEST_PREFIX}Trabalho`, 'i')).first(),
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('should show subtotal and shipping in order summary', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { buyer } = await setupCheckoutScenario(
      loginAsFreshUser,
      dataFactory,
      `summary_${Date.now()}`,
    );

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const checkout = new CheckoutPage(page);
    await checkout.navigate();
    await checkout.waitForContent();

    // Subtotal should be visible
    await expect(checkout.subtotal).toBeVisible({ timeout: 10_000 });

    // Total should be visible with a price
    await expect(
      page.getByText(/R\$\s*\d+[.,]\d{2}/).first(),
    ).toBeVisible();

    await context.close();
  });

  test('should have empty cart after order creation', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { buyer, addressId } = await setupCheckoutScenario(
      loginAsFreshUser,
      dataFactory,
      `emptycart_${Date.now()}`,
    );

    const buyerApi = authedApiClient(buyer.accessToken);

    // Create order via API
    await buyerApi.post('/orders', { shippingAddressId: addressId });

    // Check cart is now empty
    const cartRes = await buyerApi.get('/cart');
    expect(cartRes.data.data).toHaveLength(0);
  });

  test('should create order with PENDING status', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { buyer, addressId } = await setupCheckoutScenario(
      loginAsFreshUser,
      dataFactory,
      `pending_${Date.now()}`,
    );

    const buyerApi = authedApiClient(buyer.accessToken);

    // Create order via API
    const orderRes = await buyerApi.post('/orders', { shippingAddressId: addressId });
    const order = orderRes.data.data;

    // Order should exist with PENDING status
    expect(order.id).toBeDefined();
    expect(order.orderNumber).toMatch(/CT-/);
    expect(order.status).toBe('PENDING');
    expect(order.orderItems.length).toBeGreaterThan(0);

    // Verify the order appears in buyer's order list
    const ordersRes = await buyerApi.get('/orders/buyer');
    const orders = ordersRes.data.data;
    const found = orders.find((o: { id: string }) => o.id === order.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('PENDING');
  });
});
