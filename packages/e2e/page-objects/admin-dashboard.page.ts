import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Dashboard page (/admin).
 *
 * Covers the main dashboard with 8 KPI metric cards:
 * Usuarios totais, Novos este mes, Pedidos hoje, Receita do mes,
 * Catalogo aprovado, Aprovacoes pendentes, Disputas ativas, Mensagens nao lidas.
 *
 * Also has a "Acoes rapidas" section with quick action links.
 */
export class AdminDashboardPage extends BasePage {
  readonly heading: Locator;
  readonly metricCardsContainer: Locator;
  readonly loadingSpinner: Locator;

  // --- Individual metric cards ---

  readonly usersCard: Locator;
  readonly newUsersCard: Locator;
  readonly ordersTodayCard: Locator;
  readonly revenueCard: Locator;
  readonly catalogSizeCard: Locator;
  readonly pendingApprovalsCard: Locator;
  readonly activeDisputesCard: Locator;
  readonly unreadMessagesCard: Locator;

  constructor(page: Page) {
    super(page);
    // The h1 "Painel Administrativo" is the page heading
    this.heading = page.locator('h1', { hasText: /Painel Administrativo/i });
    // The KPI cards grid container
    this.metricCardsContainer = page.locator('.grid').first();
    this.loadingSpinner = page.locator('.animate-spin');

    // Individual KPI cards -- shadcn Card renders generic divs.
    // Match by exact label text from admin-dashboard.tsx.
    const grid = page.locator('.grid').first();
    this.usersCard = grid.locator('> div').filter({ hasText: /Usuarios totais/ });
    this.newUsersCard = grid.locator('> div').filter({ hasText: /Novos este mes/ });
    this.ordersTodayCard = grid.locator('> div').filter({ hasText: /Pedidos hoje/ });
    this.revenueCard = grid.locator('> div').filter({ hasText: /Receita do mes/ });
    this.catalogSizeCard = grid.locator('> div').filter({ hasText: /Catalogo aprovado/ });
    this.pendingApprovalsCard = grid.locator('> div').filter({ hasText: /Aprovacoes pendentes/ });
    this.activeDisputesCard = grid.locator('> div').filter({ hasText: /Disputas ativas/ });
    this.unreadMessagesCard = grid.locator('> div').filter({ hasText: /Mensagens nao lidas/ });
  }

  /** Navigate to /admin */
  async navigate(): Promise<void> {
    await this.goto('/admin');
  }

  /** Assert the dashboard page is loaded */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  /** Get all metric card locators */
  getMetricCards(): Locator {
    return this.metricCardsContainer.locator('> div');
  }

  /**
   * Get the displayed value of a metric card by its label text.
   * @param label - Regex or string matching the card label
   */
  async getMetricValue(label: string | RegExp): Promise<string> {
    const pattern = typeof label === 'string' ? new RegExp(label, 'i') : label;
    const card = this.metricCardsContainer.locator('> div').filter({ hasText: pattern });
    // The value is in a div.text-2xl.font-bold inside CardContent
    const valueElement = card.locator('.text-2xl.font-bold').first();
    return (await valueElement.textContent()) ?? '';
  }

  /** Assert all 8 KPI metric cards are visible */
  async expectAllMetricsVisible(): Promise<void> {
    await expect(this.usersCard).toBeVisible({ timeout: 10_000 });
    await expect(this.newUsersCard).toBeVisible();
    await expect(this.ordersTodayCard).toBeVisible();
    await expect(this.revenueCard).toBeVisible();
    await expect(this.catalogSizeCard).toBeVisible();
    await expect(this.pendingApprovalsCard).toBeVisible();
    await expect(this.activeDisputesCard).toBeVisible();
    await expect(this.unreadMessagesCard).toBeVisible();
  }
}
