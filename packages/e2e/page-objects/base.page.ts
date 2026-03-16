import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly locale = 'pt-BR';

  constructor(page: Page) {
    this.page = page;
  }

  protected url(path: string): string {
    return `/${this.locale}${path}`;
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(this.url(path));
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForLoaded(): Promise<void> {
    const spinner = this.page.locator('.animate-spin');
    await spinner.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }

  getToast(text: string | RegExp): Locator {
    return this.page.locator('[data-sonner-toaster]').getByText(text);
  }

  async expectToast(text: string | RegExp): Promise<void> {
    await expect(this.getToast(text)).toBeVisible({ timeout: 5_000 });
  }

  async currentPath(): Promise<string> {
    const url = new URL(this.page.url());
    return url.pathname.replace(`/${this.locale}`, '') || '/';
  }
}
