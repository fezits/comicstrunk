import { test, expect } from '../../fixtures';
import { API_URL, TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * PIX Payment Flow (dev-mode with mock).
 *
 * These tests exercise the PIX payment UI for a PENDING order.
 * A pending order is created via API in beforeAll, then each test
 * interacts with the checkout/payment page.
 */
test.describe('PIX Payment Flow', () => {
  let orderId: string;
  let orderNumber: string;
  let userToken: string;
  let adminToken: string;

  test.beforeAll(async ({ loginAsUser, loginAsAdmin, dataFactory }) => {
    // Get tokens
    const user = await loginAsUser();
    userToken = user.accessToken;
    const admin = await loginAsAdmin();
    adminToken = admin.accessToken;

    const userApi = authedApiClient(userToken);
    const adminApi = authedApiClient(adminToken);

    // Create a catalog entry and approve it
    const entry = await dataFactory.createAndApproveCatalogEntry();

    // Add to collection as a FOR_SALE item (using admin who can also be a seller)
    // Two-step: create collection item, then mark for sale
    const collRes = await adminApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'GOOD',
    });
    await adminApi.patch(`/collection/${collRes.data.data.id}/sale`, {
      isForSale: true,
      salePrice: 25.0,
    });

    // List marketplace to find the listing
    const marketRes = await userApi.get('/marketplace', {
      params: { limit: 50 },
    });
    const listings = marketRes.data.data || [];
    const listing = listings.find(
      (l: { catalogEntry?: { id: string } }) => l.catalogEntry?.id === entry.id,
    );

    if (!listing) {
      throw new Error('Could not find marketplace listing for test setup');
    }

    // Add to cart
    await userApi.post('/cart', { collectionItemId: listing.id });

    // Create a shipping address first
    const addrRes = await userApi.post('/shipping/addresses', {
      label: `${TEST_PREFIX}PIX Test Address`,
      recipientName: `${TEST_PREFIX}PIX Tester`,
      street: 'Rua Teste PIX',
      number: '100',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001-000',
      phone: '11999990000',
    });
    const addressId = addrRes.data.data.id;

    // Create the order
    const orderRes = await userApi.post('/orders', {
      shippingAddressId: addressId,
    });
    orderId = orderRes.data.data.id;
    orderNumber = orderRes.data.data.orderNumber;
  });

  test('should display PIX QR code on payment page', async ({ authedPage }) => {
    test.slow();
    await authedPage.goto(`/pt-BR/checkout/payment?orderId=${orderId}`);
    await authedPage.waitForLoadState('networkidle');

    // Should show PIX payment section with QR code or equivalent
    const pixSection = authedPage.locator('[data-testid="pix-payment"], [data-testid="payment-pix"]').or(
      authedPage.getByText(/PIX/i).first(),
    );
    await expect(pixSection).toBeVisible({ timeout: 15_000 });
  });

  test('should display copy-paste PIX string', async ({ authedPage }) => {
    test.slow();
    await authedPage.goto(`/pt-BR/checkout/payment?orderId=${orderId}`);
    await authedPage.waitForLoadState('networkidle');

    // Look for the copy-paste code field or a copy button
    const copyButton = authedPage
      .getByRole('button', { name: /copiar|copy/i })
      .or(authedPage.locator('[data-testid="pix-copy"]'));
    await expect(copyButton).toBeVisible({ timeout: 15_000 });
  });

  test('should display countdown timer', async ({ authedPage }) => {
    test.slow();
    await authedPage.goto(`/pt-BR/checkout/payment?orderId=${orderId}`);
    await authedPage.waitForLoadState('networkidle');

    // Timer or expiration indicator
    const timer = authedPage
      .locator('[data-testid="payment-timer"], [data-testid="pix-timer"]')
      .or(authedPage.getByText(/expira|validade|tempo/i).first());
    await expect(timer).toBeVisible({ timeout: 15_000 });
  });

  test('admin manual approval should mark order as PAID', async ({
    authedPage,
    adminPage,
  }) => {
    test.slow();

    // Admin navigates to payments page and approves
    await adminPage.goto('/pt-BR/admin/payments');
    await adminPage.waitForLoadState('networkidle');

    // Use API for the actual approval since it is a dev-mode operation
    const adminApi = authedApiClient(adminToken);
    await adminApi.post('/payments/admin/approve', { orderId });

    // Verify in the UI the order is now paid
    await authedPage.goto(`/pt-BR/orders/${orderId}`);
    await authedPage.waitForLoadState('networkidle');

    const statusBadge = authedPage
      .getByText(/pago|paid|confirmado/i)
      .first();
    await expect(statusBadge).toBeVisible({ timeout: 15_000 });
  });

  test('after payment, order detail shows paid status', async ({ authedPage }) => {
    await authedPage.goto(`/pt-BR/orders/${orderId}`);
    await authedPage.waitForLoadState('networkidle');

    // Order should show PAID or equivalent status
    const statusText = authedPage
      .getByText(/pago|paid|confirmado/i)
      .first();
    await expect(statusText).toBeVisible({ timeout: 15_000 });

    // Order number should be visible
    if (orderNumber) {
      await expect(authedPage.getByText(orderNumber)).toBeVisible();
    }
  });
});
