import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';

/**
 * Seller Banking page tests.
 *
 * Verifies CRUD operations on bank accounts at /seller/banking.
 * Uses a valid CPF (529.982.247-25) for validation tests.
 */
test.describe('Seller Banking', () => {
  const VALID_CPF = '529.982.247-25';
  const INVALID_CPF = '000.000.000-00';

  test('should load banking page', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    const heading = authedPage
      .getByRole('heading', { name: /banc[aá]ri|bank|conta/i })
      .or(authedPage.getByText(/dados banc[aá]rios|contas banc[aá]rias/i).first());
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should add a new bank account', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    // Click add button
    const addButton = authedPage
      .getByRole('button', { name: /adicionar|nova conta|add/i })
      .or(authedPage.getByRole('link', { name: /adicionar|nova conta|add/i }));
    await addButton.click();

    // Fill the form
    const bankName = authedPage.getByLabel(/banco|bank/i).first();
    if (await bankName.isVisible().catch(() => false)) {
      await bankName.fill(`${TEST_PREFIX}Banco do Brasil`);
    }

    const agency = authedPage.getByLabel(/ag[eê]ncia|agency/i).first();
    if (await agency.isVisible().catch(() => false)) {
      await agency.fill('0001');
    }

    const account = authedPage.getByLabel(/conta|account/i).first();
    if (await account.isVisible().catch(() => false)) {
      await account.fill('123456-7');
    }

    // Account type
    const typeSelect = authedPage.getByLabel(/tipo|type/i).first();
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.click();
      const corrente = authedPage.getByText(/corrente|checking/i).first();
      if (await corrente.isVisible().catch(() => false)) {
        await corrente.click();
      }
    }

    const cpf = authedPage.getByLabel(/CPF|documento/i).first();
    if (await cpf.isVisible().catch(() => false)) {
      await cpf.fill(VALID_CPF);
    }

    const holderName = authedPage.getByLabel(/titular|holder/i).first();
    if (await holderName.isVisible().catch(() => false)) {
      await holderName.fill(`${TEST_PREFIX}Holder Name`);
    }

    // Submit
    const submitBtn = authedPage
      .getByRole('button', { name: /salvar|save|cadastrar|criar/i })
      .first();
    await submitBtn.click();

    // Success toast or the account appearing in the list
    const success = authedPage
      .locator('[data-sonner-toaster]')
      .getByText(/sucesso|salv|cria|success/i)
      .or(authedPage.getByText(`${TEST_PREFIX}Banco do Brasil`));
    await expect(success).toBeVisible({ timeout: 15_000 });
  });

  test('should edit an existing bank account', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    // Click edit on the first account
    const editBtn = authedPage
      .getByRole('button', { name: /editar|edit/i })
      .first();
    const hasEditBtn = await editBtn.isVisible().catch(() => false);

    if (hasEditBtn) {
      await editBtn.click();

      // Modify a field
      const holderName = authedPage.getByLabel(/titular|holder/i).first();
      if (await holderName.isVisible().catch(() => false)) {
        await holderName.clear();
        await holderName.fill(`${TEST_PREFIX}Updated Holder`);
      }

      const saveBtn = authedPage
        .getByRole('button', { name: /salvar|save|atualizar|update/i })
        .first();
      await saveBtn.click();

      const toast = authedPage
        .locator('[data-sonner-toaster]')
        .getByText(/sucesso|atualiz|success|updated/i);
      await expect(toast).toBeVisible({ timeout: 10_000 });
    } else {
      // No accounts to edit — skip gracefully
      test.skip();
    }
  });

  test('should set account as primary', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    const primaryBtn = authedPage
      .getByRole('button', { name: /principal|primary|padr[aã]o/i })
      .first();
    const visible = await primaryBtn.isVisible().catch(() => false);

    if (visible) {
      await primaryBtn.click();

      const confirmation = authedPage
        .locator('[data-sonner-toaster]')
        .getByText(/principal|primary|sucesso/i)
        .or(authedPage.getByText(/principal|primary/i));
      await expect(confirmation).toBeVisible({ timeout: 10_000 });
    } else {
      // Only one account or none — skip
      test.skip();
    }
  });

  test('should show validation error for invalid CPF', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    const addButton = authedPage
      .getByRole('button', { name: /adicionar|nova conta|add/i })
      .or(authedPage.getByRole('link', { name: /adicionar|nova conta|add/i }));
    await addButton.click();

    // Fill minimal data with invalid CPF
    const cpf = authedPage.getByLabel(/CPF|documento/i).first();
    if (await cpf.isVisible().catch(() => false)) {
      await cpf.fill(INVALID_CPF);
    }

    const submitBtn = authedPage
      .getByRole('button', { name: /salvar|save|cadastrar|criar/i })
      .first();
    await submitBtn.click();

    // Should show validation error
    const error = authedPage
      .getByText(/CPF inv[aá]lido|invalid CPF|documento inv[aá]lido/i)
      .or(authedPage.locator('[data-sonner-toaster]').getByText(/erro|error|inv[aá]lid/i));
    await expect(error).toBeVisible({ timeout: 10_000 });
  });

  test('should delete a bank account', async ({ authedPage }) => {
    await authedPage.goto('/pt-BR/seller/banking');
    await authedPage.waitForLoadState('networkidle');

    const deleteBtn = authedPage
      .getByRole('button', { name: /excluir|deletar|remover|delete|remove/i })
      .first();
    const visible = await deleteBtn.isVisible().catch(() => false);

    if (visible) {
      await deleteBtn.click();

      // Confirm dialog if present
      const confirmBtn = authedPage
        .getByRole('button', { name: /confirmar|sim|yes|confirm|excluir/i })
        .first();
      const hasConfirm = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
      }

      const toast = authedPage
        .locator('[data-sonner-toaster]')
        .getByText(/sucesso|remov|delet|exclu/i);
      await expect(toast).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
    }
  });
});
