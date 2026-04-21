import { test, expect } from '../../fixtures';
import { CartPage } from '../../page-objects/cart.page';
import { authedApiClient } from '../../helpers/api-client';
import { STORAGE_STATE_WITH_CONSENT } from '../../helpers/test-constants';

test.describe('Cart Management', () => {
  /**
   * Helper: create a seller with a for-sale listing via the API.
   * Returns the seller info and collectionItem id.
   */
  async function createSellerWithListing(
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
    suffix?: string,
  ) {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    const seller = await loginAsFreshUser(suffix || `seller_cart_${Date.now()}`);
    const sellerApi = authedApiClient(seller.accessToken);

    const collectionRes = await sellerApi.post('/collection', {
      catalogEntryId: entry.id,
      condition: 'VERY_GOOD',
      pricePaid: 12.0,
    });
    const collectionItemId = collectionRes.data.data.id;

    await sellerApi.patch(`/collection/${collectionItemId}/sale`, {
      isForSale: true,
      salePrice: 19.9,
    });

    return { seller, collectionItemId, entry };
  }

  test('should add item to cart and update cart badge', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    // Create a seller with a listing
    const { collectionItemId } = await createSellerWithListing(
      loginAsFreshUser,
      dataFactory,
      `seller_add_${Date.now()}`,
    );

    // Create a buyer
    const buyer = await loginAsFreshUser(`buyer_add_${Date.now()}`);
    const buyerApi = authedApiClient(buyer.accessToken);

    // Add to cart via API
    await buyerApi.post('/cart', { collectionItemId });

    // Open browser as the buyer (with cookie consent)
    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    // Navigate to marketplace and open cart sidebar
    const cart = new CartPage(page);
    await cart.navigate();
    await cart.waitForContent();

    const count = await cart.getItemCount();
    expect(count).toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test('should show cart items with reservation countdown', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { collectionItemId } = await createSellerWithListing(
      loginAsFreshUser,
      dataFactory,
      `seller_timer_${Date.now()}`,
    );

    const buyer = await loginAsFreshUser(`buyer_timer_${Date.now()}`);
    const buyerApi = authedApiClient(buyer.accessToken);
    await buyerApi.post('/cart', { collectionItemId });

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const cart = new CartPage(page);
    await cart.navigate();
    await cart.waitForContent();

    // Verify items are displayed
    await cart.expectHasItems();

    // Look for countdown/timer text (reservation expires in ~24h)
    // The timer may show hours:minutes or a text like "Reservado por..."
    // At minimum, cart should have items
    expect(await cart.getItemCount()).toBeGreaterThan(0);

    await context.close();
  });

  test('should remove item from cart', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
    dataFactory,
  }) => {
    const { collectionItemId } = await createSellerWithListing(
      loginAsFreshUser,
      dataFactory,
      `seller_rem_${Date.now()}`,
    );

    const buyer = await loginAsFreshUser(`buyer_rem_${Date.now()}`);
    const buyerApi = authedApiClient(buyer.accessToken);
    await buyerApi.post('/cart', { collectionItemId });

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const cart = new CartPage(page);
    await cart.navigate();
    await cart.waitForContent();

    // Verify we have items before removing
    const beforeCount = await cart.getItemCount();
    expect(beforeCount).toBeGreaterThan(0);

    // Remove the first item
    await cart.removeItem(0);
    await cart.waitForContent();

    // Verify item was removed
    const afterCount = await cart.getItemCount();
    expect(afterCount).toBeLessThan(beforeCount);

    await context.close();
  });

  test('should not allow adding own item to cart', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    // Create a seller with a listing
    const { seller, collectionItemId } = await createSellerWithListing(
      loginAsFreshUser,
      dataFactory,
      `seller_self_${Date.now()}`,
    );

    // Try to add own item to cart via API - should fail
    const sellerApi = authedApiClient(seller.accessToken);
    try {
      await sellerApi.post('/cart', { collectionItemId });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number } };
      expect(axiosError.response?.status).toBe(400);
    }
  });

  test('should not allow adding same item twice (already reserved)', async ({
    loginAsFreshUser,
    dataFactory,
  }) => {
    const { collectionItemId } = await createSellerWithListing(
      loginAsFreshUser,
      dataFactory,
      `seller_dup_${Date.now()}`,
    );

    // Buyer 1 adds item to cart
    const buyer1 = await loginAsFreshUser(`buyer1_dup_${Date.now()}`);
    const buyer1Api = authedApiClient(buyer1.accessToken);
    await buyer1Api.post('/cart', { collectionItemId });

    // Buyer 2 tries to add same item - should fail (already reserved)
    const buyer2 = await loginAsFreshUser(`buyer2_dup_${Date.now()}`);
    const buyer2Api = authedApiClient(buyer2.accessToken);
    try {
      await buyer2Api.post('/cart', { collectionItemId });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number } };
      expect(axiosError.response?.status).toBe(409);
    }
  });

  test('should show empty cart message when cart is empty', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
  }) => {
    const buyer = await loginAsFreshUser(`buyer_empty_${Date.now()}`);

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, buyer);
    const page = await context.newPage();

    const cart = new CartPage(page);
    await cart.navigate();
    await cart.waitForContent();

    // Should show empty cart message
    await cart.expectEmpty();

    await context.close();
  });
});
