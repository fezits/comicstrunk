import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Homepage section management page (/admin/homepage).
 *
 * Covers creating, reordering, toggling visibility, and deleting
 * dynamic homepage sections (banners, highlights, deals, coupons, etc.).
 */
export class AdminHomepagePage extends BasePage {
  readonly heading: Locator;
  readonly createSectionButton: Locator;
  readonly sectionCards: Locator;
  readonly sectionTypeLabels: Locator;
  readonly createDialog: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.createSectionButton = page.getByRole('button', { name: /nov[oa]|criar|adicionar/i });
    // Section items are rendered as rows/cards in the list
    this.sectionCards = page.locator('tr, div').filter({
      has: page.locator('button'),
      hasText: /destaques|cat[aá]logo|ofertas|cup[oõ]es|banner|BANNER|CATALOG/i,
    });
    this.sectionTypeLabels = page.locator('[class*="badge"]');
    this.createDialog = page.locator('[role="dialog"]');
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate to /admin/homepage */
  async navigate(): Promise<void> {
    await this.goto('/admin/homepage');
  }

  /** Get all section card locators */
  getSections(): Locator {
    return this.sectionCards;
  }

  /**
   * Create a new homepage section via the create dialog.
   * @param type - Section type to select (e.g., "BANNER", "CATALOG_HIGHLIGHTS")
   * @param title - Optional custom title for the section
   */
  async createSection(type: string, title?: string): Promise<void> {
    await this.createSectionButton.click();
    await expect(this.createDialog).toBeVisible({ timeout: 5_000 });

    // Select section type
    const typeSelect = this.createDialog.getByRole('combobox', { name: /tipo/i }).or(
      this.createDialog.getByLabel(/tipo/i),
    );
    await typeSelect.click();
    await this.page.getByRole('option', { name: new RegExp(type, 'i') }).click();

    // Fill optional title
    if (title) {
      const titleInput = this.createDialog.getByLabel(/t[ií]tulo/i);
      await titleInput.fill(title);
    }

    const submitButton = this.createDialog.getByRole('button', { name: /salvar|criar|confirmar/i });
    await submitButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle the visibility of a section card.
   * @param index - zero-based index of the section card
   */
  async toggleVisibility(index: number): Promise<void> {
    const card = this.sectionCards.nth(index);
    const toggleButton = card.getByRole('button', { name: /visibilidade|vis[ií]vel|ocultar|mostrar/i }).or(
      card.getByRole('switch'),
    ).or(
      card.locator('[aria-label*="visib" i]'),
    );
    await toggleButton.click();
  }

  /**
   * Move a section up in the order.
   * @param index - zero-based index of the section card
   */
  async moveUp(index: number): Promise<void> {
    const card = this.sectionCards.nth(index);
    const moveUpButton = card.getByRole('button', { name: /mover.*cima|subir|up/i }).or(
      card.locator('[aria-label*="cima" i], [aria-label*="up" i]'),
    );
    await moveUpButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Move a section down in the order.
   * @param index - zero-based index of the section card
   */
  async moveDown(index: number): Promise<void> {
    const card = this.sectionCards.nth(index);
    const moveDownButton = card.getByRole('button', { name: /mover.*baixo|descer|down/i }).or(
      card.locator('[aria-label*="baixo" i], [aria-label*="down" i]'),
    );
    await moveDownButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Delete a section.
   * @param index - zero-based index of the section card
   */
  async deleteSection(index: number): Promise<void> {
    const card = this.sectionCards.nth(index);
    const deleteButton = card.getByRole('button', { name: /excluir|remover|deletar/i }).or(
      card.locator('[aria-label*="excluir" i], [aria-label*="remover" i]'),
    );
    await deleteButton.click();

    // Confirm deletion dialog
    const confirmButton = this.page
      .getByRole('button', { name: /confirmar|sim|excluir/i })
      .last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }

  /** Get the count of section cards */
  async getSectionCount(): Promise<number> {
    return this.sectionCards.count();
  }
}
