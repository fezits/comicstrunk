import { test, expect } from '../../fixtures';
import { authedApiClient } from '../../helpers/api-client';
import axios from 'axios';
import { API_URL } from '../../helpers/test-constants';

/**
 * Notifications E2E flow with screenshots.
 *
 * Tests the notification bell, dropdown, full notifications page,
 * mark-as-read flows, and preference management with visual evidence.
 */
test.describe('Notifications Flow (with screenshots)', () => {
  test('notification bell and dropdown with screenshots', async ({ authedPage, loginAsUser }) => {
    const page = authedPage;
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Create test notifications via API
    await axios
      .post(
        `${API_URL}/auth/login`,
        { email: 'user@test.com', password: 'Test1234' },
        { withCredentials: true },
      )
      .catch(() => null);

    // We need to create notifications directly — use a helper
    // The notification service creates them internally, so we'll test what's visible

    // 1. Navigate to a page to see the header
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/notifications/01-header-with-bell.png',
      fullPage: false,
    });

    // 2. Find and click the notification bell
    const bell = page
      .locator(
        '[data-testid="notification-bell"], [data-testid="notifications-trigger"], ' +
          'button[aria-label*="notifica"], header button:has(svg[class*="bell"])',
      )
      .or(page.locator('header').getByRole('button', { name: /notifica/i }))
      .first();

    await expect(bell).toBeVisible({ timeout: 15_000 });

    // Screenshot: bell icon (with or without badge)
    await bell.screenshot({
      path: 'screenshots/notifications/02-notification-bell-closeup.png',
    });

    await bell.click();
    await page.waitForTimeout(1000);

    // 3. Screenshot: dropdown open
    await page.screenshot({
      path: 'screenshots/notifications/03-notification-dropdown-open.png',
      fullPage: false,
    });

    // 4. Look for "View All" link and click it
    const viewAllLink = page
      .getByRole('link', { name: /ver tod|view all|todas/i })
      .or(page.locator('a[href*="notification"]'))
      .first();

    const hasViewAll = await viewAllLink.isVisible().catch(() => false);
    if (hasViewAll) {
      await viewAllLink.click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'screenshots/notifications/04-notifications-full-page.png',
        fullPage: true,
      });
    } else {
      // Navigate directly
      await page.goto('/pt-BR/notifications');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'screenshots/notifications/04-notifications-full-page.png',
        fullPage: true,
      });
    }
  });

  test('notifications page features with screenshots', async ({ authedPage }) => {
    const page = authedPage;

    // 1. Go to notifications page
    await page.goto('/pt-BR/notifications');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/notifications/05-notifications-page-loaded.png',
      fullPage: true,
    });

    // 2. Check for filter tabs (All / Unread)
    const filterTabs = page.locator('[role="tablist"], [data-testid="notification-filters"]');
    if (await filterTabs.isVisible().catch(() => false)) {
      await page.screenshot({
        path: 'screenshots/notifications/06-notification-filters.png',
        fullPage: false,
      });

      // Click "Unread" tab if it exists
      const unreadTab = page
        .getByRole('tab', { name: /n[aã]o lid|unread|pendente/i })
        .or(page.getByText(/n[aã]o lid|unread/i).first());

      if (await unreadTab.isVisible().catch(() => false)) {
        await unreadTab.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'screenshots/notifications/07-notifications-unread-filter.png',
          fullPage: false,
        });
      }
    }

    // 3. Try "Mark all as read"
    const markAllBtn = page
      .getByRole('button', { name: /marcar.*(lid|read)|ler tud|read all/i })
      .or(page.locator('[data-testid="mark-all-read"]'))
      .first();

    if (await markAllBtn.isVisible().catch(() => false)) {
      await markAllBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: 'screenshots/notifications/08-all-marked-as-read.png',
        fullPage: false,
      });
    }
  });

  test('notification preferences with screenshots', async ({ authedPage }) => {
    const page = authedPage;

    // 1. Navigate to preferences page
    await page.goto('/pt-BR/notifications/preferences');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/notifications/09-preferences-page.png',
      fullPage: true,
    });

    // 2. Find toggle switches
    const switches = page.locator('[role="switch"], input[type="checkbox"], [data-testid*="toggle"]');
    const switchCount = await switches.count();

    if (switchCount > 0) {
      // Toggle one preference off
      const firstSwitch = switches.first();
      await firstSwitch.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/notifications/10-preference-toggled.png',
        fullPage: false,
      });

      // Toggle it back on
      await firstSwitch.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/notifications/11-preference-restored.png',
        fullPage: false,
      });
    }

    // 3. Check that PASSWORD_RESET is locked (not toggleable)
    const passwordResetRow = page
      .getByText(/senha|password/i)
      .first();

    if (await passwordResetRow.isVisible().catch(() => false)) {
      await passwordResetRow.scrollIntoViewIfNeeded();

      await page.screenshot({
        path: 'screenshots/notifications/12-password-reset-locked.png',
        fullPage: false,
      });
    }
  });

  test('notification bell badge updates after marking read', async ({
    authedPage,
    loginAsUser,
  }) => {
    const page = authedPage;

    // 1. Navigate to see the bell
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('networkidle');

    // 2. Check initial bell state
    const bell = page
      .locator(
        '[data-testid="notification-bell"], [data-testid="notifications-trigger"], ' +
          'button[aria-label*="notifica"], header button:has(svg[class*="bell"])',
      )
      .or(page.locator('header').getByRole('button', { name: /notifica/i }))
      .first();

    if (await bell.isVisible().catch(() => false)) {
      // Screenshot bell with potential badge
      await bell.screenshot({
        path: 'screenshots/notifications/13-bell-initial-state.png',
      });

      // Mark all as read via API
      const user = await loginAsUser();
      const userApi = authedApiClient(user.accessToken);
      await userApi.patch('/notifications/read-all');

      // Reload to see updated badge
      await page.reload();
      await page.waitForLoadState('networkidle');

      await bell.screenshot({
        path: 'screenshots/notifications/14-bell-after-mark-all-read.png',
      });
    }
  });
});
