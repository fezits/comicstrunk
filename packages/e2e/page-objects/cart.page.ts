import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Cart sidebar (Sheet).
 *
 * The cart is NOT a separate page route (/cart does not exist).
 * It is a Sheet sidebar opened from the cart button in the header.
 * To interact with the cart, navigate to any authenticated page first,
 * then call openCart() to open the sidebar.
 */
export class CartPage extends BasePage {
  readonly heading: Locator;
  readonly emptyMessage: Locator;
  readonly checkoutButton: Locator;
  readonly clearCartButton: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    // The Sheet heading is a SheetTitle with "Carrinho"
    this.heading = page.getByRole('heading', { name: /[Cc]arrinho/i });
    // Empty state message: "Seu carrinho esta vazio"
    this.emptyMessage = page.getByText(/carrinho.*vazio/i);
    // Checkout link: "Finalizar Compra" — it's a link to /checkout
    this.checkoutButton = page.getByRole('link', { name: /finalizar compra/i }).or(
      page.getByRole('button', { name: /finalizar compra/i }),
    );
    // Clear cart button: "Limpar Carrinho"
    this.clearCartButton = page.getByRole('button', { name: /limpar carrinho/i });
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /**
   * Open the cart sidebar by navigating to the marketplace page
   * (or any authenticated page) and clicking the cart button in the header.
   */
  async navigate(): Promise<void> {
    // Navigate to any page first to ensure the header is rendered
    await this.goto('/marketplace');
    await this.openCart();
  }

  /** Open the cart sidebar by clicking the header cart button */
  async openCart(): Promise<void> {
    const cartButton = this.page.getByRole('button', { name: /[Cc]arrinho/ });
    await cartButton.click();
    // Wait for the Sheet to animate open
    await this.page.waitForTimeout(500);
  }

  /** Wait for the cart sidebar content to finish loading */
  async waitForContent(): Promise<void> {
    await this.waitForLoaded();
    // Wait for either the heading, empty state, or cart items to be visible
    await this.page
      .locator('[role="dialog"], [data-state="open"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /** Get all cart item elements within the sidebar */
  getCartItems(): Locator {
    return this.page.locator(
      '[data-testid="cart-item"]',
    ).or(
      this.page.getByRole('button', { name: /remover item/i }).locator('..').locator('..'),
    );
  }

  /** Get the count of items in cart */
  async getItemCount(): Promise<number> {
    // Count by the number of remove buttons present
    const removeButtons = this.page.getByRole('button', { name: /remover item/i });
    return removeButtons.count();
  }

  /** Get remove buttons for cart items */
  getRemoveButtons(): Locator {
    return this.page.getByRole('button', { name: /remover item/i });
  }

  /** Remove the cart item at a given index (0-based) */
  async removeItem(index: number): Promise<void> {
    await this.getRemoveButtons().nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /** Get the reservation countdown timer locators */
  getCountdownTimers(): Locator {
    return this.page.locator(
      '[data-testid="countdown"], .countdown, :text-matches("\\d+:\\d+", "i")',
    );
  }

  /** Assert the cart is empty */
  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the cart has items */
  async expectHasItems(): Promise<void> {
    const count = await this.getItemCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert checkout button is visible */
  async expectCheckoutAvailable(): Promise<void> {
    await expect(this.checkoutButton).toBeVisible();
  }

  /** Click the checkout button/link to go to /checkout */
  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Get total text from the summary section */
  async getTotalText(): Promise<string> {
    const totalLine = this.page.getByText(/total/i).first();
    const parentText = await totalLine.locator('..').textContent();
    return parentText ?? '';
  }
}
