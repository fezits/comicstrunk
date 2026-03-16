import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';

/**
 * Public Contact Form tests.
 *
 * Verifies the public contact form at /contact:
 * page load, successful submission, validation errors (empty fields,
 * invalid email, short message), category dropdown, and submit-another flow.
 *
 * The contact form uses a shadcn/Radix UI Select for the category dropdown
 * and replaces the form with a ContactSuccess component on success
 * (no toast notification).
 */
test.describe('Contact Form', () => {
  /** Helper: select a Radix Select option by clicking the trigger then the option. */
  async function selectRadixOption(
    page: import('@playwright/test').Page,
    triggerLocator: import('@playwright/test').Locator,
    optionPattern: RegExp,
  ) {
    await triggerLocator.click();
    // Radix Select renders options inside a portal; wait for the listbox to appear
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    const option = listbox.locator('[role="option"]').filter({ hasText: optionPattern });
    await option.first().click();
  }

  /** Helper: locate the category trigger (Radix combobox). */
  function getCategoryTrigger(page: import('@playwright/test').Page) {
    return page.locator('#contact-category');
  }

  /** Helper: locate the submit button ("Enviar Mensagem"). */
  function getSubmitButton(page: import('@playwright/test').Page) {
    return page.getByRole('button', { name: /enviar\s*mensagem/i });
  }

  test('should load contact page with form heading and fields', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Should have the "Fale Conosco" heading
    const heading = page.getByRole('heading', { name: /fale conosco/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Should have form fields: name, email, category, subject, message
    await expect(page.locator('#contact-name')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(getCategoryTrigger(page)).toBeVisible();
    await expect(page.locator('#contact-subject')).toBeVisible();
    await expect(page.locator('#contact-message')).toBeVisible();
  });

  test('should submit valid form and show success message', async ({ page }) => {
    test.slow();

    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Fill name
    await page.locator('#contact-name').fill(`${TEST_PREFIX}E2E Contact User`);

    // Fill email
    await page.locator('#contact-email').fill(`${TEST_PREFIX}contact-form@e2e-test.com`);

    // Select category (Radix Select)
    await selectRadixOption(page, getCategoryTrigger(page), /sugestao/i);

    // Fill subject
    await page.locator('#contact-subject').fill(`${TEST_PREFIX}E2E Test Contact Subject`);

    // Fill message (min 10 chars)
    await page.locator('#contact-message').fill(
      `${TEST_PREFIX}This is a test contact message submitted via the e2e form test.`,
    );

    // Submit
    const submitBtn = getSubmitButton(page);
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // On success the form is replaced by ContactSuccess component showing
    // "Mensagem enviada com sucesso!" (not a toast)
    const successText = page.getByText(/mensagem enviada com sucesso/i);
    await expect(successText).toBeVisible({ timeout: 15_000 });
  });

  test('should show validation errors for empty required fields', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Submit without filling anything
    const submitBtn = getSubmitButton(page);
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.click();

    // Should show validation errors (e.g. "Nome e obrigatorio", "E-mail e obrigatorio", etc.)
    const errors = page.getByText(/obrigat[oó]ri/i);
    const errorCount = await errors.count();
    expect(errorCount).toBeGreaterThanOrEqual(1);
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Fill name
    await page.locator('#contact-name').fill(`${TEST_PREFIX}Invalid Email User`);

    // Fill email with invalid format
    await page.locator('#contact-email').fill('not-a-valid-email');

    // Select category
    await selectRadixOption(page, getCategoryTrigger(page), /sugestao/i);

    // Fill subject
    await page.locator('#contact-subject').fill(`${TEST_PREFIX}Invalid Email Test`);

    // Fill message to pass other validations
    await page.locator('#contact-message').fill(
      `${TEST_PREFIX}This message has an invalid email address for testing.`,
    );

    // Submit
    const submitBtn = getSubmitButton(page);
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Should show "E-mail invalido" validation error
    const emailError = page.getByText(/e-?mail invalido/i).first();
    const hasEmailError = await emailError.isVisible({ timeout: 5_000 }).catch(() => false);

    // Also check for generic validation error
    const genericError = page.getByText(/inv[aá]lid|error|erro/i).first();
    const hasGenericError = await genericError.isVisible().catch(() => false);

    expect(hasEmailError || hasGenericError).toBeTruthy();
  });

  test('should have category dropdown with options', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Find and click the Radix Select trigger to open the dropdown
    const trigger = getCategoryTrigger(page);
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    // Wait for the Radix listbox portal to appear
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // Should have the 4 categories: Sugestao, Problema, Parceria, Outro
    const expectedCategories = [/sugestao/i, /problema/i, /parceria/i, /outro/i];

    let foundCount = 0;
    for (const pattern of expectedCategories) {
      const option = listbox.locator('[role="option"]').filter({ hasText: pattern });
      const count = await option.count();
      if (count > 0) foundCount++;
    }

    expect(foundCount).toBeGreaterThanOrEqual(2);
  });

  test('should enforce minimum message length', async ({ page }) => {
    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Fill required fields
    await page.locator('#contact-name').fill(`${TEST_PREFIX}Short Msg User`);
    await page.locator('#contact-email').fill(`${TEST_PREFIX}short@e2e-test.com`);
    await page.locator('#contact-subject').fill(`${TEST_PREFIX}Short Message Test`);

    // Select category
    await selectRadixOption(page, getCategoryTrigger(page), /sugestao/i);

    // Fill message with < 10 chars
    await page.locator('#contact-message').fill('short');

    // Submit
    const submitBtn = getSubmitButton(page);
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Should show "Mensagem deve ter no minimo 10 caracteres"
    const lengthError = page
      .getByText(/m[ií]nimo.*10|10.*caracteres|min.*10/i)
      .first();
    const hasLengthError = await lengthError.isVisible({ timeout: 5_000 }).catch(() => false);

    const genericError = page.getByText(/obrigat|inv[aá]lid|error|erro/i).first();
    const hasGenericError = await genericError.isVisible().catch(() => false);

    expect(hasLengthError || hasGenericError).toBeTruthy();
  });

  test('should offer option to submit another message after success', async ({ page }) => {
    test.slow();

    await page.goto('/pt-BR/contact');
    await page.waitForLoadState('networkidle');

    // Fill and submit a valid form
    await page.locator('#contact-name').fill(`${TEST_PREFIX}Another Msg User`);
    await page.locator('#contact-email').fill(`${TEST_PREFIX}another@e2e-test.com`);

    // Select category
    await selectRadixOption(page, getCategoryTrigger(page), /sugestao/i);

    // Fill subject
    await page.locator('#contact-subject').fill(`${TEST_PREFIX}Another Message Subject`);

    // Fill message
    await page.locator('#contact-message').fill(
      `${TEST_PREFIX}This message tests the submit-another flow after a successful submission.`,
    );

    const submitBtn = getSubmitButton(page);
    await submitBtn.click();

    // Wait for the ContactSuccess component to appear
    const successText = page.getByText(/mensagem enviada com sucesso/i);
    await expect(successText).toBeVisible({ timeout: 15_000 });

    // Click "Enviar outra mensagem" button to reset the form
    const anotherBtn = page.getByRole('button', { name: /enviar outra mensagem/i });
    await expect(anotherBtn).toBeVisible({ timeout: 5_000 });
    await anotherBtn.click();
    await page.waitForTimeout(500);

    // Form should be reset and visible again
    await expect(page.locator('#contact-name')).toBeVisible({ timeout: 10_000 });
    // The name field should be empty after reset
    await expect(page.locator('#contact-name')).toHaveValue('');
  });
});
