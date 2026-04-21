import { test, expect } from '../../fixtures';

const TEST_PREFIX = '_test_';

/**
 * Helper: generate a unique test name with the _test_ prefix.
 */
function uniqueName(base: string): string {
  return `${TEST_PREFIX}${base}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Admin Taxonomy Management tests.
 *
 * The /admin/content page is a hub with 4 cards linking to sub-pages:
 *   - /admin/content/categories
 *   - /admin/content/tags
 *   - /admin/content/characters
 *   - /admin/content/series
 *
 * Each sub-page has its own CRUD table with create/edit/delete.
 * The create/edit forms use shadcn Dialog. Buttons use i18n translations:
 *   - Create button text from t('create')
 *   - Edit button text "Editar" (tCommon('edit'))
 *   - Delete button text "Excluir" (tCommon('delete'))
 */
test.describe('Admin Taxonomy Management', () => {
  test('should navigate to /admin/content and see taxonomy hub cards', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content');
    await adminPage.waitForLoadState('domcontentloaded');

    // The admin content page shows an h1 heading
    const heading = adminPage.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // The hub page has 4 cards linking to sub-pages: Categorias, Series, Tags, Personagens
    // These are CardTitle elements (rendered as divs by shadcn) inside link cards
    const categoriesCard = adminPage.getByText(/Categorias/i).first();
    const seriesCard = adminPage.getByText(/Series/i).first();
    const tagsCard = adminPage.getByText(/Tags/i).first();
    const charactersCard = adminPage.getByText(/Personagens/i).first();

    await expect(categoriesCard).toBeVisible({ timeout: 5_000 });
    await expect(seriesCard).toBeVisible({ timeout: 5_000 });
    await expect(tagsCard).toBeVisible({ timeout: 5_000 });
    await expect(charactersCard).toBeVisible({ timeout: 5_000 });
  });

  test('should CRUD a category', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/categories');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    // --- CREATE ---
    const categoryName = uniqueName('Categoria');

    // Click the create button (text from i18n t('create'))
    const createButton = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton.click();

    // Dialog opens with a name input
    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.locator('input').first();
    await nameInput.fill(categoryName);

    // Submit (button with create/save text)
    const submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    // Verify creation success
    const successToast = adminPage.locator('[data-sonner-toaster]').getByText(/criad[oa]|salv[oa]|sucesso|success/i);
    await expect(successToast).toBeVisible({ timeout: 5_000 });

    // Verify the category appears in the table
    await expect(adminPage.getByText(categoryName)).toBeVisible({ timeout: 5_000 });

    // --- EDIT ---
    const editedName = uniqueName('CategoriaEditada');

    // Find the row with the category name and click edit (button text "Editar")
    const categoryRow = adminPage.locator('tr').filter({ hasText: categoryName });
    const editButton = categoryRow.getByRole('button', { name: /editar|edit/i });
    await editButton.first().click();

    // Dialog should open
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const editInput = dialog.locator('input').first();
    await editInput.fill(editedName);

    const saveButton = dialog.getByRole('button', { name: /salvar|atualizar|confirmar|save/i }).last();
    await saveButton.click();

    // Verify update success
    const updateToast = adminPage.locator('[data-sonner-toaster]').getByText(/atualizad[oa]|salv[oa]|sucesso|success/i);
    await expect(updateToast).toBeVisible({ timeout: 5_000 });

    // Verify the edited name appears
    await expect(adminPage.getByText(editedName)).toBeVisible({ timeout: 5_000 });

    // --- DELETE ---
    const editedRow = adminPage.locator('tr').filter({ hasText: editedName });
    const deleteButton = editedRow.getByRole('button', { name: /excluir|remover|deletar|delete/i });
    await deleteButton.first().click();

    // Confirm deletion (dialog appears)
    const confirmDialog = adminPage.locator('[role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', { name: /confirmar|sim|excluir|remover|delete/i }).last();
    await confirmButton.click();

    // Verify deletion success
    const deleteToast = adminPage.locator('[data-sonner-toaster]').getByText(/exclu[ií]d[oa]|removid[oa]|sucesso|success/i);
    await expect(deleteToast).toBeVisible({ timeout: 5_000 });

    // Verify the category is gone
    await expect(adminPage.getByText(editedName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('should CRUD a tag', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/tags');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    // --- CREATE ---
    const tagName = uniqueName('Tag');

    const createButton = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton.click();

    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.locator('input').first();
    await nameInput.fill(tagName);

    const submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    const successToast = adminPage.locator('[data-sonner-toaster]').getByText(/criad[oa]|salv[oa]|sucesso|success/i);
    await expect(successToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(tagName)).toBeVisible({ timeout: 5_000 });

    // --- EDIT ---
    const editedTagName = uniqueName('TagEditada');

    const tagRow = adminPage.locator('tr').filter({ hasText: tagName });
    const editButton = tagRow.getByRole('button', { name: /editar|edit/i });
    await editButton.first().click();

    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const editInput = dialog.locator('input').first();
    await editInput.fill(editedTagName);

    const saveButton = dialog.getByRole('button', { name: /salvar|atualizar|confirmar|save/i }).last();
    await saveButton.click();

    const updateToast = adminPage.locator('[data-sonner-toaster]').getByText(/atualizad[oa]|salv[oa]|sucesso|success/i);
    await expect(updateToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedTagName)).toBeVisible({ timeout: 5_000 });

    // --- DELETE ---
    const editedRow = adminPage.locator('tr').filter({ hasText: editedTagName });
    const deleteButton = editedRow.getByRole('button', { name: /excluir|remover|deletar|delete/i });
    await deleteButton.first().click();

    const confirmDialog = adminPage.locator('[role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', { name: /confirmar|sim|excluir|remover|delete/i }).last();
    await confirmButton.click();

    const deleteToast = adminPage.locator('[data-sonner-toaster]').getByText(/exclu[ií]d[oa]|removid[oa]|sucesso|success/i);
    await expect(deleteToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedTagName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('should CRUD a character', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/characters');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    // --- CREATE ---
    const characterName = uniqueName('Personagem');

    const createButton = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton.click();

    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.locator('input').first();
    await nameInput.fill(characterName);

    const submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    const successToast = adminPage.locator('[data-sonner-toaster]').getByText(/criad[oa]|salv[oa]|sucesso|success/i);
    await expect(successToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(characterName)).toBeVisible({ timeout: 5_000 });

    // --- EDIT ---
    const editedCharacterName = uniqueName('PersonagemEditado');

    const characterRow = adminPage.locator('tr').filter({ hasText: characterName });
    const editButton = characterRow.getByRole('button', { name: /editar|edit/i });
    await editButton.first().click();

    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const editInput = dialog.locator('input').first();
    await editInput.fill(editedCharacterName);

    const saveButton = dialog.getByRole('button', { name: /salvar|atualizar|confirmar|save/i }).last();
    await saveButton.click();

    const updateToast = adminPage.locator('[data-sonner-toaster]').getByText(/atualizad[oa]|salv[oa]|sucesso|success/i);
    await expect(updateToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedCharacterName)).toBeVisible({ timeout: 5_000 });

    // --- DELETE ---
    const editedRow = adminPage.locator('tr').filter({ hasText: editedCharacterName });
    const deleteButton = editedRow.getByRole('button', { name: /excluir|remover|deletar|delete/i });
    await deleteButton.first().click();

    const confirmDialog = adminPage.locator('[role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', { name: /confirmar|sim|excluir|remover|delete/i }).last();
    await confirmButton.click();

    const deleteToast = adminPage.locator('[data-sonner-toaster]').getByText(/exclu[ií]d[oa]|removid[oa]|sucesso|success/i);
    await expect(deleteToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedCharacterName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('should CRUD a series', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/series');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    // --- CREATE ---
    const seriesName = uniqueName('Serie');

    const createButton = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton.click();

    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.locator('input').first();
    await nameInput.fill(seriesName);

    const submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    const successToast = adminPage.locator('[data-sonner-toaster]').getByText(/criad[oa]|salv[oa]|sucesso|success/i);
    await expect(successToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(seriesName)).toBeVisible({ timeout: 5_000 });

    // --- EDIT ---
    const editedSeriesName = uniqueName('SerieEditada');

    const seriesRow = adminPage.locator('tr').filter({ hasText: seriesName });
    const editButton = seriesRow.getByRole('button', { name: /editar|edit/i });
    await editButton.first().click();

    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const editInput = dialog.locator('input').first();
    await editInput.fill(editedSeriesName);

    const saveButton = dialog.getByRole('button', { name: /salvar|atualizar|confirmar|save/i }).last();
    await saveButton.click();

    const updateToast = adminPage.locator('[data-sonner-toaster]').getByText(/atualizad[oa]|salv[oa]|sucesso|success/i);
    await expect(updateToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedSeriesName)).toBeVisible({ timeout: 5_000 });

    // --- DELETE ---
    const editedRow = adminPage.locator('tr').filter({ hasText: editedSeriesName });
    const deleteButton = editedRow.getByRole('button', { name: /excluir|remover|deletar|delete/i });
    await deleteButton.first().click();

    const confirmDialog = adminPage.locator('[role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', { name: /confirmar|sim|excluir|remover|delete/i }).last();
    await confirmButton.click();

    const deleteToast = adminPage.locator('[data-sonner-toaster]').getByText(/exclu[ií]d[oa]|removid[oa]|sucesso|success/i);
    await expect(deleteToast).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText(editedSeriesName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('should show error when creating taxonomy with duplicate name', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/categories');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    // Create a category
    const categoryName = uniqueName('DupCategoria');

    const createButton = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton.click();

    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    let nameInput = dialog.locator('input').first();
    await nameInput.fill(categoryName);

    let submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    // Wait for creation to succeed
    await expect(
      adminPage.locator('[data-sonner-toaster]').getByText(/criad[oa]|salv[oa]|sucesso|success/i),
    ).toBeVisible({ timeout: 5_000 });

    // Try to create another category with the same name
    const createButton2 = adminPage.getByRole('button', { name: /nov[oa]|criar|adicionar|create/i }).first();
    await createButton2.click();

    await expect(dialog).toBeVisible({ timeout: 5_000 });
    nameInput = dialog.locator('input').first();
    await nameInput.fill(categoryName);

    submitButton = dialog.getByRole('button', { name: /salvar|criar|confirmar|create|save/i }).last();
    await submitButton.click();

    // Should show a conflict/duplicate error
    const errorToast = adminPage.locator('[data-sonner-toaster]').getByText(
      /j[aá] existe|duplicad[oa]|conflito|erro|error/i,
    );

    const hasError = await errorToast.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasError).toBeTruthy();

    // Cleanup: delete the first category we created
    // Close dialog first if still open
    const cancelBtn = dialog.getByRole('button', { name: /cancelar|cancel/i });
    if (await cancelBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await cancelBtn.click();
    }

    const row = adminPage.locator('tr').filter({ hasText: categoryName });
    const deleteButton = row.getByRole('button', { name: /excluir|remover|deletar|delete/i });
    if (await deleteButton.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteButton.first().click();
      const confirmButton = adminPage.locator('[role="dialog"]')
        .getByRole('button', { name: /confirmar|sim|excluir|remover|delete/i }).last();
      if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }
  });

  test('should show seed data items for categories', async ({ adminPage }) => {
    // Navigate to categories sub-page and verify items from seed data exist
    await adminPage.goto('/pt-BR/admin/content/categories');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    // Seed: 5 categories
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should show seed data items for tags', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/tags');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    // Seed: 10 tags
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should show seed data items for characters', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/characters');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    // Seed: 8 characters
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should show seed data items for series', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/content/series');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_000);

    const rows = adminPage.locator('table tbody tr');
    const rowCount = await rows.count();
    // Seed: 5 series
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });
});
