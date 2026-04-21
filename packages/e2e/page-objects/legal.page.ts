import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for public legal/policy pages (terms, privacy, seller terms, etc.).
 *
 * Covers navigation to different legal document pages and
 * verification of document content rendering.
 */
export class LegalPoliciesPage extends BasePage {
  readonly heading: Locator;
  readonly documentContent: Locator;
  readonly versionInfo: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.documentContent = page.locator(
      '[data-testid="document-content"], article, .prose, [class*="content"]',
    ).first();
    this.versionInfo = page.getByText(/vers[aã]o|atualizado em|[uú]ltima atualiza[cç][aã]o/i);
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Navigate to the Terms of Use page */
  async navigateToTerms(): Promise<void> {
    await this.goto('/terms');
  }

  /** Navigate to the Privacy Policy page */
  async navigateToPrivacy(): Promise<void> {
    await this.goto('/privacy');
  }

  /** Navigate to the Seller Terms page */
  async navigateToSellerTerms(): Promise<void> {
    await this.goto('/seller-terms');
  }

  /** Navigate to the general Policies page */
  async navigateToPolicies(): Promise<void> {
    await this.goto('/policies');
  }

  /** Navigate to the Cookies Policy page */
  async navigateToCookiesPolicy(): Promise<void> {
    await this.goto('/cookies');
  }

  /** Assert that the document content section is visible and has text */
  async expectDocumentContent(): Promise<void> {
    await expect(this.documentContent).toBeVisible({ timeout: 10_000 });
    const text = await this.documentContent.textContent();
    expect(text?.length).toBeGreaterThan(0);
  }

  /** Get the document title from the heading */
  async getDocumentTitle(): Promise<string> {
    return (await this.heading.textContent()) ?? '';
  }
}

/**
 * Component object for the Cookie Consent Banner.
 *
 * Covers the fixed-bottom cookie consent banner with accept button
 * and cookie policy link. Does not extend BasePage because it is
 * a component that appears on any page.
 */
export class CookieConsentBanner {
  readonly page: Page;
  readonly banner: Locator;
  readonly acceptButton: Locator;
  readonly cookiePolicyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.banner = page.locator(
      '[data-testid="cookie-consent"], [class*="cookie-consent"], [role="alert"]',
    ).or(
      page.locator('div[class*="fixed"][class*="bottom"]').filter({
        hasText: /cookie|lgpd|privacidade/i,
      }),
    );
    this.acceptButton = this.banner.getByRole('button', { name: /aceitar|concordo|ok/i });
    this.cookiePolicyLink = this.banner.getByRole('link', { name: /pol[ií]tica.*cookie|cookie.*pol[ií]tica|saiba mais/i });
  }

  /** Assert the cookie consent banner is visible */
  async expectVisible(): Promise<void> {
    await expect(this.banner).toBeVisible({ timeout: 5_000 });
  }

  /** Assert the cookie consent banner is hidden */
  async expectHidden(): Promise<void> {
    await expect(this.banner).not.toBeVisible({ timeout: 5_000 });
  }

  /** Accept cookies by clicking the accept button */
  async accept(): Promise<void> {
    await this.acceptButton.click();
    await this.page.waitForTimeout(300);
  }

  /** Click the cookie policy link */
  async clickPolicyLink(): Promise<void> {
    await this.cookiePolicyLink.click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
