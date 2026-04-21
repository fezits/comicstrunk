import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class OrdersPage extends BasePage {
  readonly heading: Locator;
  readonly statusFilter: Locator;
  readonly emptyMessage: Locator;
  readonly loadingSpinner: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    // Status filter is a shadcn Select (combobox trigger button)
    this.statusFilter = page.locator('button[role="combobox"]').first();
    // Empty: "Voce ainda nao fez nenhum pedido"
    this.emptyMessage = page.getByText(/nenhum pedido|sem pedidos|ainda n[aã]o fez/i);
    this.loadingSpinner = page.locator('.animate-spin');
    this.prevPageButton = page.getByRole('button', { name: /anterior/i });
    this.nextPageButton = page.getByRole('button', { name: /pr[oó]xim/i });
  }

  /** Navigate to the buyer orders page */
  async navigate(): Promise<void> {
    await this.goto('/orders');
  }

  /** Navigate to the seller orders page */
  async navigateToSellerOrders(): Promise<void> {
    await this.goto('/seller/orders');
  }

  /** Wait for the orders to finish loading */
  async waitForContent(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('h1, h2, [data-testid="orders-list"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Get all order row/card elements (Link > Card with order number) */
  getOrderRows(): Locator {
    return this.page.locator(
      '[data-testid="order-row"], [data-testid="order-card"]',
    ).or(
      this.page.locator('a.block:has([class*="card"])').filter({
        hasText: /#CT-|pedido/i,
      }),
    );
  }

  /** Get the count of visible orders */
  async getOrderCount(): Promise<number> {
    return this.getOrderRows().count();
  }

  /** Click on an order by index to navigate to its detail page */
  async clickOrder(index: number): Promise<void> {
    const rows = this.getOrderRows();
    await rows.nth(index).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Filter orders by status using the status dropdown */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForTimeout(500);
    await this.waitForContent();
  }

  /** Assert orders list has at least one order */
  async expectHasOrders(): Promise<void> {
    const count = await this.getOrderCount();
    expect(count).toBeGreaterThan(0);
  }

  /** Assert no orders are shown */
  async expectNoOrders(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible({ timeout: 10_000 });
  }

  /** Assert page heading contains expected text */
  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.heading).toContainText(text);
  }
}

export class OrderDetailPage extends BasePage {
  readonly heading: Locator;
  readonly orderNumber: Locator;
  readonly statusBadge: Locator;
  readonly timeline: Locator;
  readonly cancelButton: Locator;
  readonly trackingCode: Locator;
  readonly trackingCodeInput: Locator;
  readonly carrierInput: Locator;
  readonly addTrackingButton: Locator;
  readonly financialSummary: Locator;
  readonly backToOrdersLink: Locator;
  readonly loadingSpinner: Locator;
  readonly orderItems: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.orderNumber = page.getByText(/#CT-\d+/i);
    this.statusBadge = page.locator(
      '[data-testid="order-status"], .badge, [class*="badge"]',
    ).first();
    this.timeline = page.locator(
      '[data-testid="order-timeline"], .timeline, [class*="timeline"]',
    );
    // "Cancelar Pedido" button (from orders.cancelOrder)
    this.cancelButton = page.getByRole('button', { name: /cancelar pedido/i });
    // "Codigo de Rastreio" text (from orders.trackingCode)
    this.trackingCode = page.getByText(/c[oó]digo de rastreio|rastreio|tracking/i);
    // Tracking form inputs (from seller translations)
    this.trackingCodeInput = page.getByLabel(/c[oó]digo de rastreio/i).or(
      page.getByPlaceholder(/rastreio|tracking/i),
    );
    this.carrierInput = page.getByLabel(/transportadora/i).or(
      page.getByPlaceholder(/transportadora/i),
    );
    // "Enviar Codigo de Rastreio" button (from seller.submitTracking)
    this.addTrackingButton = page.getByRole('button', { name: /enviar.*rastreio|informar rastreio|marcar como enviado/i });
    // "Resumo Financeiro" section (from seller.financialSummary)
    this.financialSummary = page.getByText(/resumo financeiro|comiss[aã]o|valor l[ií]quido/i).locator('..');
    this.backToOrdersLink = page.getByRole('link', { name: /voltar.*pedidos|voltar/i });
    this.loadingSpinner = page.locator('.animate-spin');
    this.orderItems = page.locator(
      '[data-testid="order-item"], .order-item, article, tr:has(td)',
    );
  }

  /** Navigate directly to an order detail page by ID */
  async navigate(orderId: string): Promise<void> {
    await this.goto(`/orders/${orderId}`);
  }

  /** Wait for the detail page to load */
  async waitForContent(): Promise<void> {
    await this.waitForLoaded();
    await this.page
      .locator('h1, h2, [data-testid="order-detail"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  /** Assert order detail page is loaded */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the order status badge shows the expected status */
  async expectStatus(status: string | RegExp): Promise<void> {
    await expect(this.statusBadge).toContainText(status);
  }

  /** Cancel the order */
  async cancelOrder(): Promise<void> {
    await this.cancelButton.click();
    // May have a confirmation dialog
    const confirmBtn = this.page.getByRole('button', { name: /confirmar|sim/i });
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.page.waitForTimeout(500);
  }

  /** Fill in tracking info and submit */
  async addTracking(trackingCode: string, carrier: string): Promise<void> {
    await this.trackingCodeInput.fill(trackingCode);
    await this.carrierInput.fill(carrier);
    await this.addTrackingButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Get the order number text */
  async getOrderNumber(): Promise<string> {
    return (await this.orderNumber.first().textContent()) ?? '';
  }

  /** Assert the financial summary section is visible (seller view) */
  async expectFinancialSummaryVisible(): Promise<void> {
    await expect(this.financialSummary).toBeVisible();
  }

  /** Assert tracking code is visible */
  async expectTrackingVisible(): Promise<void> {
    await expect(this.trackingCode).toBeVisible();
  }

  /** Get the count of order items displayed */
  async getItemCount(): Promise<number> {
    return this.orderItems.count();
  }
}
