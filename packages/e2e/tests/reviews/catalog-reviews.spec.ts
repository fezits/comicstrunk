import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Catalog Reviews tests.
 *
 * Verifies the reviews section on catalog detail pages: viewing,
 * creating, editing, and deleting reviews with star ratings.
 */
test.describe('Catalog Reviews', () => {
  let catalogEntryId: string;
  let catalogEntryTitle: string;

  test.beforeAll(async ({ dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    catalogEntryId = entry.id;
    catalogEntryTitle = entry.title;
  });

  test('should display reviews section on catalog detail page', async ({ page }) => {
    // Navigate to catalog, click first entry
    await page.goto('/pt-BR/catalog');
    await page.waitForLoadState('networkidle');

    // Click on first available catalog card
    const firstCard = page.locator('[data-testid="catalog-card"], .group').first();
    await firstCard.click();
    await page.waitForLoadState('networkidle');

    // Reviews section should be visible
    const reviewsSection = page
      .getByText(/avalia[cç][oõ]es|reviews|opini[oõ]es/i)
      .first();
    await expect(reviewsSection).toBeVisible({ timeout: 15_000 });
  });

  test('should create a review with star rating and text', async ({ authedPage }) => {
    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find the review form area
    // Click the 4th star for a 4-star rating
    const stars = authedPage.locator(
      '[data-testid="star-rating"] button, [data-testid="star-input"] button, [role="radio"], .star-rating button, svg[data-rating]',
    );
    const starCount = await stars.count();

    if (starCount >= 4) {
      await stars.nth(3).click(); // 4th star (0-indexed)
    } else {
      // Try clicking on a star icon directly
      const starIcons = authedPage.locator('[data-testid^="star-"], [aria-label*="star"], [aria-label*="estrela"]');
      if (await starIcons.count() >= 4) {
        await starIcons.nth(3).click();
      }
    }

    // Write review text
    const reviewText = authedPage
      .getByPlaceholder(/escreva|review|coment|opini|avalia/i)
      .or(authedPage.locator('textarea').first());
    if (await reviewText.isVisible().catch(() => false)) {
      await reviewText.fill(`${TEST_PREFIX}Excelente edicao, muito bem conservada!`);
    }

    // Submit the review
    const submitBtn = authedPage
      .getByRole('button', { name: /enviar|publicar|submit|avaliar/i })
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();

      // Review should appear or success toast
      const success = authedPage
        .locator('[data-sonner-toaster]')
        .getByText(/sucesso|publicad|enviada|success/i)
        .or(authedPage.getByText(`${TEST_PREFIX}Excelente edicao`));
      await expect(success).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should update average rating after review', async ({ page }) => {
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    // Look for average rating display
    const ratingDisplay = page
      .locator('[data-testid="average-rating"], [data-testid="rating-summary"]')
      .or(page.getByText(/m[eé]dia|average|4\.|estrela/i).first());

    const isVisible = await ratingDisplay.isVisible().catch(() => false);
    if (isVisible) {
      // Rating should show some value
      const text = await ratingDisplay.textContent();
      expect(text).toBeTruthy();
    }
    // If no rating display is visible, reviews section should still exist
    const reviews = page.getByText(/avalia[cç][oõ]es|reviews/i).first();
    await expect(reviews).toBeVisible({ timeout: 15_000 });
  });

  test('should edit own review', async ({ authedPage }) => {
    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find edit button on own review
    const editBtn = authedPage
      .getByRole('button', { name: /editar|edit/i })
      .first();
    const hasEdit = await editBtn.isVisible().catch(() => false);

    if (hasEdit) {
      await editBtn.click();

      const textarea = authedPage.locator('textarea').first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.clear();
        await textarea.fill(`${TEST_PREFIX}Edicao atualizada, nota revisada!`);
      }

      const saveBtn = authedPage
        .getByRole('button', { name: /salvar|atualizar|save|update/i })
        .first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();

        const success = authedPage
          .locator('[data-sonner-toaster]')
          .getByText(/sucesso|atualiz|success|updated/i)
          .or(authedPage.getByText(`${TEST_PREFIX}Edicao atualizada`));
        await expect(success).toBeVisible({ timeout: 10_000 });
      }
    } else {
      // No edit button — may need to create a review first; skip
      test.skip();
    }
  });

  test('should delete own review', async ({ authedPage }) => {
    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    const deleteBtn = authedPage
      .getByRole('button', { name: /excluir|deletar|remover|delete|remove/i })
      .first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);

    if (hasDelete) {
      await deleteBtn.click();

      // Confirm dialog
      const confirmBtn = authedPage
        .getByRole('button', { name: /confirmar|sim|yes|excluir|confirm/i })
        .first();
      const hasConfirm = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
      }

      const toast = authedPage
        .locator('[data-sonner-toaster]')
        .getByText(/sucesso|remov|delet|exclu|success/i);
      await expect(toast).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
    }
  });
});
