import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CheckoutPage extends BasePage {
  readonly heading: Locator;
  readonly addressSection: Locator;
  readonly newAddressButton: Locator;
  readonly orderSummary: Locator;
  readonly subtotal: Locator;
  readonly shippingCost: Locator;
  readonly totalAmount: Locator;
  readonly confirmButton: Locator;
  readonly loadingSpinner: Locator;

  // New address form fields (labels from addresses i18n)
  readonly labelInput: Locator;
  readonly streetInput: Locator;
  readonly numberInput: Locator;
  readonly complementInput: Locator;
  readonly neighborhoodInput: Locator;
  readonly cityInput: Locator;
  readonly zipCodeInput: Locator;
  readonly saveAddressButton: Locator;

  constructor(page: Page) {
    super(page);
    // Heading: "Checkout" (from checkout.title)
    this.heading = page.getByRole('heading', { name: /[Cc]heckout/i });
    // Address section: "Endereco de Entrega" (from checkout.shippingAddress)
    this.addressSection = page.getByText(/endere[cç]o de entrega/i).locator('..');
    // "Adicionar novo endereco" button (from checkout.addNewAddress)
    this.newAddressButton = page.getByRole('button', { name: /adicionar novo endere[cç]o/i });
    // "Resumo do Pedido" section (from checkout.orderSummary)
    this.orderSummary = page.getByText(/resumo do pedido/i).locator('..');
    this.subtotal = page.getByText(/subtotal/i);
    this.shippingCost = page.getByText(/frete|envio/i);
    this.totalAmount = page.getByText(/total/i).last();
    // "Finalizar Pedido" button (from checkout.placeOrder)
    this.confirmButton = page.getByRole('button', { name: /finalizar pedido/i });
    this.loadingSpinner = page.locator('.animate-spin');

    // New address form (labels from addresses i18n namespace)
    this.labelInput = page.getByLabel(/r[oó]tulo/i);
    this.streetInput = page.getByLabel(/rua/i);
    this.numberInput = page.getByLabel(/n[uú]mero/i);
    this.complementInput = page.getByLabel(/complemento/i);
    this.neighborhoodInput = page.getByLabel(/bairro/i);
    this.cityInput = page.getByLabel(/cidade/i);
    // State is a Select component, not a text input
    this.zipCodeInput = page.getByLabel(/cep/i);
    // Save button: "Adicionar endereco" (from addresses.addAddress)
    this.saveAddressButton = page.getByRole('button', { name: /adicionar endere[cç]o/i });
  }

  /** Navigate to the checkout page */
  async navigate(): Promise<void> {
    await this.goto('/checkout');
  }

  /** Wait for checkout content to load */
  async waitForContent(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('h1, h2, [data-testid="checkout-content"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Select an existing address card by clicking it (cards are clickable) */
  async selectAddress(index: number): Promise<void> {
    // Address cards are Card components with cursor-pointer
    const addressCards = this.addressSection.locator('.cursor-pointer');
    if (await addressCards.count() > index) {
      await addressCards.nth(index).click();
    }
  }

  /** Fill in a new address form */
  async fillNewAddress(address: {
    label?: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  }): Promise<void> {
    await this.newAddressButton.click();
    await this.page.waitForTimeout(300);

    if (address.label) {
      await this.labelInput.fill(address.label);
    }
    await this.streetInput.fill(address.street);
    await this.numberInput.fill(address.number);
    if (address.complement) {
      await this.complementInput.fill(address.complement);
    }
    await this.neighborhoodInput.fill(address.neighborhood);
    await this.cityInput.fill(address.city);

    // State is a shadcn Select, click the trigger and select the option
    const stateTrigger = this.page.locator('button[role="combobox"]').last();
    await stateTrigger.click();
    await this.page
      .getByRole('option', { name: new RegExp(`^${address.state}$`, 'i') })
      .click();

    await this.zipCodeInput.fill(address.zipCode);

    await this.saveAddressButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Confirm the order */
  async confirmOrder(): Promise<void> {
    await this.confirmButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Assert checkout page is loaded with heading visible */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Assert address section is visible */
  async expectAddressSectionVisible(): Promise<void> {
    await expect(
      this.page.getByText(/endere[cç]o de entrega/i),
    ).toBeVisible();
  }

  /** Assert order summary section is visible */
  async expectOrderSummaryVisible(): Promise<void> {
    await expect(this.page.getByText(/resumo/i).first()).toBeVisible();
  }

  /** Assert the confirm button is visible and enabled */
  async expectConfirmAvailable(): Promise<void> {
    await expect(this.confirmButton).toBeVisible();
    await expect(this.confirmButton).toBeEnabled();
  }
}
