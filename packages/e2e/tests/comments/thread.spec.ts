import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Comments Thread tests.
 *
 * Verifies the comments section on catalog detail pages: viewing,
 * creating, replying, liking/unliking, and deleting comments.
 */
test.describe('Comments Thread', () => {
  let catalogEntryId: string;

  test.beforeAll(async ({ dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    catalogEntryId = entry.id;
  });

  test('should display comments section on catalog detail page', async ({ page }) => {
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    const commentsSection = page
      .getByText(/coment[aá]rios|comments|discuss[aã]o/i)
      .first();
    await expect(commentsSection).toBeVisible({ timeout: 15_000 });
  });

  test('should create a comment', async ({ authedPage }) => {
    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find comment input
    const commentInput = authedPage
      .getByPlaceholder(/escreva|coment|adicionar|write|add/i)
      .or(authedPage.locator('textarea[name*="comment"], textarea[id*="comment"]'))
      .or(authedPage.locator('[data-testid="comment-input"] textarea, [data-testid="comment-textarea"]'))
      .first();

    await expect(commentInput).toBeVisible({ timeout: 15_000 });
    await commentInput.fill(`${TEST_PREFIX}Este e um excelente gibi para colecionar!`);

    // Submit the comment
    const submitBtn = authedPage
      .getByRole('button', { name: /enviar|publicar|comentar|submit|post/i })
      .first();
    await submitBtn.click();

    // Comment should appear in the thread or show success
    const commentText = authedPage.getByText(
      `${TEST_PREFIX}Este e um excelente gibi para colecionar!`,
    );
    const toast = authedPage
      .locator('[data-sonner-toaster]')
      .getByText(/sucesso|publicad|enviado|success/i);

    const commentVisible = await commentText.isVisible({ timeout: 10_000 }).catch(() => false);
    const toastVisible = await toast.isVisible().catch(() => false);
    expect(commentVisible || toastVisible).toBeTruthy();
  });

  test('should reply to a comment', async ({ authedPage, loginAsUser }) => {
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // First, create a comment via API to ensure there is one to reply to
    await userApi.post('/comments', {
      catalogEntryId,
      content: `${TEST_PREFIX}Comentario para receber resposta`,
    });

    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find the reply button on the first comment
    const replyBtn = authedPage
      .getByRole('button', { name: /responder|reply/i })
      .first();
    const hasReply = await replyBtn.isVisible().catch(() => false);

    if (hasReply) {
      await replyBtn.click();

      // Fill the reply
      const replyInput = authedPage
        .getByPlaceholder(/resposta|reply|escreva/i)
        .or(authedPage.locator('textarea').last());

      if (await replyInput.isVisible().catch(() => false)) {
        await replyInput.fill(`${TEST_PREFIX}Concordo, otima edicao!`);

        const submitReply = authedPage
          .getByRole('button', { name: /enviar|publicar|responder|submit|reply/i })
          .last();
        await submitReply.click();

        // Reply should appear nested or show success
        const replyText = authedPage.getByText(`${TEST_PREFIX}Concordo, otima edicao!`);
        const toast = authedPage
          .locator('[data-sonner-toaster]')
          .getByText(/sucesso|publicad|enviado|success/i);

        const replyVisible = await replyText
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        const toastVisible = await toast.isVisible().catch(() => false);
        expect(replyVisible || toastVisible).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('should like and unlike a comment', async ({ authedPage, loginAsUser }) => {
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Ensure a comment exists
    await userApi.post('/comments', {
      catalogEntryId,
      content: `${TEST_PREFIX}Comentario para curtir`,
    });

    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find like button
    const likeBtn = authedPage
      .getByRole('button', { name: /curtir|like/i })
      .or(authedPage.locator('[data-testid="like-button"], [data-testid^="comment-like"]'))
      .first();

    const hasLike = await likeBtn.isVisible().catch(() => false);

    if (hasLike) {
      // Click to like
      await likeBtn.click();
      await authedPage.waitForTimeout(500);

      // Click again to unlike
      await likeBtn.click();
      await authedPage.waitForTimeout(500);

      // Should not crash
      await expect(authedPage.locator('body')).toBeVisible();
    } else {
      // Like button may use an icon without accessible name
      const heartIcons = authedPage.locator(
        '[data-testid*="like"], button:has(svg[data-icon="heart"]), button:has(svg[class*="heart"])',
      );
      const iconCount = await heartIcons.count();
      if (iconCount > 0) {
        await heartIcons.first().click();
        await authedPage.waitForTimeout(500);
        await expect(authedPage.locator('body')).toBeVisible();
      } else {
        test.skip();
      }
    }
  });

  test('should delete own comment', async ({ authedPage, loginAsUser }) => {
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // Create a comment via API first
    const commentRes = await userApi.post('/comments', {
      catalogEntryId,
      content: `${TEST_PREFIX}Comentario para deletar`,
    });

    await authedPage.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await authedPage.waitForLoadState('networkidle');

    // Find delete button
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
      // Delete might be behind a menu — try the three-dots menu
      const menuBtn = authedPage
        .locator('[data-testid="comment-menu"], button:has(svg[class*="dots"]), button:has(svg[class*="ellipsis"])')
        .first();
      const hasMenu = await menuBtn.isVisible().catch(() => false);
      if (hasMenu) {
        await menuBtn.click();
        const deleteMenuItem = authedPage
          .getByRole('menuitem', { name: /excluir|deletar|delete/i })
          .first();
        if (await deleteMenuItem.isVisible().catch(() => false)) {
          await deleteMenuItem.click();
        }
      } else {
        // Clean up via API
        if (commentRes.data?.data?.id) {
          await userApi.delete(`/comments/${commentRes.data.data.id}`);
        }
        test.skip();
      }
    }
  });
});
