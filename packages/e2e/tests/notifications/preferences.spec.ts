import { test, expect } from '../../fixtures';

/**
 * Notification Preferences tests.
 *
 * Verifies the /notifications/preferences page loads, displays
 * toggle switches for notification types, supports toggling,
 * and keeps PASSWORD_RESET locked (always on).
 */
test.describe('Notification Preferences', () => {
  test('should load notification preferences page with toggles', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/notifications/preferences');
    await authedPage.waitForLoadState('networkidle');

    const heading = authedPage
      .getByRole('heading', {
        name: /prefer[eê]ncias|preferences|configura[cç][oõ]es/i,
      })
      .or(
        authedPage
          .getByText(/prefer[eê]ncias de notifica|notification preferences/i)
          .first(),
      );
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have toggle switches
    const toggles = authedPage.locator(
      '[role="switch"], input[type="checkbox"], [data-testid*="toggle"], [data-testid*="switch"]',
    );
    const toggleCount = await toggles.count();
    expect(toggleCount).toBeGreaterThanOrEqual(1);
  });

  test('should toggle a notification type on and off', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/notifications/preferences');
    await authedPage.waitForLoadState('networkidle');

    // Find a toggle that is not the PASSWORD_RESET one (which should be locked)
    const toggles = authedPage.locator(
      '[role="switch"]:not([aria-disabled="true"]):not([disabled]), ' +
      'input[type="checkbox"]:not([disabled])',
    );
    const count = await toggles.count();

    if (count > 0) {
      const toggle = toggles.first();

      // Get initial state
      const initialChecked =
        (await toggle.getAttribute('aria-checked')) === 'true' ||
        (await toggle.getAttribute('data-state')) === 'checked' ||
        (await toggle.isChecked().catch(() => false));

      // Click to toggle
      await toggle.click();
      await authedPage.waitForTimeout(500);

      // State should have changed
      const afterChecked =
        (await toggle.getAttribute('aria-checked')) === 'true' ||
        (await toggle.getAttribute('data-state')) === 'checked' ||
        (await toggle.isChecked().catch(() => false));

      expect(afterChecked).not.toBe(initialChecked);

      // Toggle back to restore original state
      await toggle.click();
      await authedPage.waitForTimeout(500);
    } else {
      test.skip();
    }
  });

  test('should keep PASSWORD_RESET toggle locked (always on)', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/notifications/preferences');
    await authedPage.waitForLoadState('networkidle');

    // Look for PASSWORD_RESET or "Redefinicao de senha" preference
    const passwordResetLabel = authedPage
      .getByText(/password.?reset|redefini[cç][aã]o de senha|senha/i)
      .first();

    const hasLabel = await passwordResetLabel.isVisible().catch(() => false);

    if (hasLabel) {
      // Find the associated toggle — it should be disabled or locked
      const parentRow = passwordResetLabel.locator('..').or(
        passwordResetLabel.locator('xpath=ancestor::div[1]'),
      );

      const toggle = parentRow.locator(
        '[role="switch"], input[type="checkbox"]',
      ).first();

      const hasToggle = await toggle.isVisible().catch(() => false);
      if (hasToggle) {
        const isDisabled =
          (await toggle.getAttribute('aria-disabled')) === 'true' ||
          (await toggle.getAttribute('disabled')) !== null ||
          (await toggle.isDisabled().catch(() => false));

        // Toggle should be on and disabled/locked
        const isChecked =
          (await toggle.getAttribute('aria-checked')) === 'true' ||
          (await toggle.getAttribute('data-state')) === 'checked' ||
          (await toggle.isChecked().catch(() => false));

        expect(isChecked).toBeTruthy();
        expect(isDisabled).toBeTruthy();
      }
    } else {
      // Label might use different text — check for any disabled toggle
      const disabledToggles = authedPage.locator(
        '[role="switch"][aria-disabled="true"], input[type="checkbox"][disabled]',
      );
      const disabledCount = await disabledToggles.count();
      // Should have at least one locked toggle (PASSWORD_RESET)
      expect(disabledCount).toBeGreaterThanOrEqual(1);
    }
  });
});
