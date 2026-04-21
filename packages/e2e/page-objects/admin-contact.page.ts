import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the Admin Contact Messages management page (/admin/contact).
 *
 * Real UI structure (admin-contact-messages.tsx):
 * - Table with expandable rows (click to see full message)
 * - 3 filter Select dropdowns: Categoria, Leitura, Resolucao
 * - Action buttons per row (icon-only):
 *   - MailOpen icon → mark as read
 *   - CheckCheck icon → mark as resolved
 *   - Trash2 icon → delete (uses AlertDialog, not Dialog)
 * - Delete confirmation uses AlertDialog
 */
export class AdminContactPage extends BasePage {
  readonly heading: Locator;
  readonly categoryFilter: Locator;
  readonly readFilter: Locator;
  readonly resolvedFilter: Locator;
  readonly messagesTable: Locator;
  readonly messageRows: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    // The three Select combobox filters
    // They appear in order: Categoria, Leitura, Resolucao
    const comboboxes = page.locator('button[role="combobox"]');
    this.categoryFilter = comboboxes.first();
    this.readFilter = comboboxes.nth(1);
    this.resolvedFilter = comboboxes.nth(2);
    this.messagesTable = page.locator('table').first();
    this.messageRows = page.locator('table tbody tr');
    this.loadingSpinner = page.locator('.animate-spin');
    this.emptyState = page.getByText(/nenhuma mensagem|sem mensagens/i);
  }

  /** Navigate to /admin/contact */
  async navigate(): Promise<void> {
    await this.goto('/admin/contact');
  }

  /** Filter messages by category */
  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.getByRole('option', { name: new RegExp(category, 'i') }).click();
    await this.waitForLoaded();
  }

  /** Filter messages by read status */
  async filterByRead(isRead: boolean): Promise<void> {
    await this.readFilter.click();
    const label = isRead ? /lid[oa]s?/i : /n[aã]o lid[oa]s?/i;
    await this.page.getByRole('option', { name: label }).click();
    await this.waitForLoaded();
  }

  /** Filter messages by resolved status */
  async filterByResolved(isResolved: boolean): Promise<void> {
    await this.resolvedFilter.click();
    const label = isResolved ? /resolvid[oa]s?/i : /n[aã]o resolvid[oa]s?|pendentes?/i;
    await this.page.getByRole('option', { name: label }).click();
    await this.waitForLoaded();
  }

  /** Get the message rows locator */
  getMessageRows(): Locator {
    return this.messageRows;
  }

  /**
   * Mark a message as read (MailOpen icon button).
   * @param index - zero-based index of the message row
   */
  async markAsRead(index: number): Promise<void> {
    const row = this.messageRows.nth(index);
    const readButton = row.locator('button[title*="lido" i]').or(
      row.locator('button').filter({ has: this.page.locator('.lucide-mail-open') }),
    ).first();
    await readButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Resolve a message (CheckCheck icon button).
   * @param index - zero-based index of the message row
   */
  async resolveMessage(index: number): Promise<void> {
    const row = this.messageRows.nth(index);
    const resolveBtn = row.locator('button[title*="resolver" i]').or(
      row.locator('button').filter({ has: this.page.locator('.lucide-check-check') }),
    ).first();
    await resolveBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Delete a message (Trash2 icon button + AlertDialog confirmation).
   * @param index - zero-based index of the message row
   */
  async deleteMessage(index: number): Promise<void> {
    const row = this.messageRows.nth(index);
    const delButton = row.locator('button[title*="excluir" i]').or(
      row.locator('button').filter({ has: this.page.locator('.lucide-trash-2') }),
    ).first();
    await delButton.click();

    // Confirm deletion in AlertDialog
    const confirmButton = this.page
      .locator('[role="alertdialog"]')
      .getByRole('button', { name: /confirmar|sim|excluir/i })
      .or(
        this.page.getByRole('button', { name: /confirmar|sim|excluir/i }).last(),
      );
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await this.page.waitForTimeout(500);
  }
}
