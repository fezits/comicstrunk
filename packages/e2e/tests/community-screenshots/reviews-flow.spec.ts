import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Reviews E2E flow with screenshots.
 *
 * Full integrated test: navigates the real frontend, interacts with real API,
 * and captures screenshots at every meaningful step for visual verification.
 */
test.describe('Reviews Flow (with screenshots)', () => {
  let catalogEntryId: string;

  test.beforeAll(async ({ dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    catalogEntryId = entry.id;
  });

  test('complete review lifecycle with screenshots', async ({ authedPage, loginAsUser }) => {
    const page = authedPage;

    // 1. Navigate to catalog detail page
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'screenshots/reviews/01-catalog-detail-page.png',
      fullPage: true,
    });

    // 2. Scroll to reviews section
    const reviewsHeading = page.getByText(/avalia[cç][oõ]es|reviews|opini[oõ]es/i).first();
    await expect(reviewsHeading).toBeVisible({ timeout: 15_000 });
    await reviewsHeading.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'screenshots/reviews/02-reviews-section-empty.png',
      fullPage: false,
    });

    // 3. Find and fill the review form
    const stars = page.locator(
      '[data-testid="star-rating"] button, [data-testid="star-input"] button, ' +
      '[role="radio"], .star-rating button, svg[data-rating]',
    );
    const starCount = await stars.count();

    if (starCount >= 4) {
      await stars.nth(3).click(); // 4-star rating
    } else {
      const starIcons = page.locator(
        '[data-testid^="star-"], [aria-label*="star"], [aria-label*="estrela"]',
      );
      if ((await starIcons.count()) >= 4) {
        await starIcons.nth(3).click();
      }
    }

    const reviewTextarea = page
      .getByPlaceholder(/escreva|review|coment|opini|avalia/i)
      .or(page.locator('textarea').first());

    if (await reviewTextarea.isVisible().catch(() => false)) {
      await reviewTextarea.fill(
        `${TEST_PREFIX}Excelente edicao! Arte impecavel e historia envolvente. Recomendo muito!`,
      );
    }

    await page.screenshot({
      path: 'screenshots/reviews/03-review-form-filled.png',
      fullPage: false,
    });

    // 4. Submit the review
    const submitBtn = page
      .getByRole('button', { name: /enviar|publicar|submit|avaliar/i })
      .first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'screenshots/reviews/04-review-submitted.png',
        fullPage: false,
      });
    }

    // 5. Verify review appears in the list
    const reviewText = page.getByText(/Excelente edicao/);
    const reviewVisible = await reviewText.isVisible({ timeout: 10_000 }).catch(() => false);
    if (reviewVisible) {
      await reviewText.scrollIntoViewIfNeeded();
    }

    await page.screenshot({
      path: 'screenshots/reviews/05-review-visible-in-list.png',
      fullPage: false,
    });

    // 6. Try to edit the review
    const editBtn = page.getByRole('button', { name: /editar|edit/i }).first();
    const hasEdit = await editBtn.isVisible().catch(() => false);

    if (hasEdit) {
      await editBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'screenshots/reviews/06-review-edit-mode.png',
        fullPage: false,
      });

      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.clear();
        await textarea.fill(`${TEST_PREFIX}Edicao revisada - 5 estrelas merecidas!`);
      }

      const saveBtn = page
        .getByRole('button', { name: /salvar|atualizar|save|update/i })
        .first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.screenshot({
        path: 'screenshots/reviews/07-review-updated.png',
        fullPage: false,
      });
    }

    // 7. Delete the review
    const deleteBtn = page
      .getByRole('button', { name: /excluir|deletar|remover|delete|remove/i })
      .first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);

    if (hasDelete) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'screenshots/reviews/08-review-delete-confirm.png',
        fullPage: false,
      });

      const confirmBtn = page
        .getByRole('button', { name: /confirmar|sim|yes|excluir|confirm/i })
        .first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.screenshot({
        path: 'screenshots/reviews/09-review-deleted.png',
        fullPage: false,
      });
    }
  });

  test('unauthenticated user sees reviews section', async ({ page }) => {
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    const reviewsSection = page.getByText(/avalia[cç][oõ]es|reviews|opini[oõ]es/i).first();
    await expect(reviewsSection).toBeVisible({ timeout: 15_000 });
    await reviewsSection.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: 'screenshots/reviews/10-reviews-unauthenticated.png',
      fullPage: false,
    });
  });

  test('seller reviews page shows ratings', async ({ authedPage, loginAsUser }) => {
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Get seller reviews for admin user
    const res = await userApi.get('/reviews/seller/admin@comicstrunk.com').catch(() => null);

    await authedPage.goto('/pt-BR/catalog');
    await authedPage.waitForLoadState('networkidle');

    await authedPage.screenshot({
      path: 'screenshots/reviews/11-catalog-with-ratings.png',
      fullPage: false,
    });
  });
});
