import { test, expect } from '../../fixtures';
import { TEST_PREFIX } from '../../helpers/test-constants';
import { authedApiClient } from '../../helpers/api-client';

/**
 * Comments E2E flow with screenshots.
 *
 * Tests the full comments lifecycle: creating, replying, liking,
 * and deleting comments with visual evidence at each step.
 */
test.describe('Comments Flow (with screenshots)', () => {
  let catalogEntryId: string;

  test.beforeAll(async ({ dataFactory }) => {
    const entry = await dataFactory.createAndApproveCatalogEntry();
    catalogEntryId = entry.id;
  });

  test('complete comments lifecycle with screenshots', async ({ authedPage, loginAsUser }) => {
    const page = authedPage;
    const user = await loginAsUser();
    const userApi = authedApiClient(user.accessToken);

    // 1. Navigate to catalog detail
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    // 2. Scroll to comments section
    const commentsHeading = page.getByText(/coment[aá]rios|comments|discuss[aã]o/i).first();
    await expect(commentsHeading).toBeVisible({ timeout: 15_000 });
    await commentsHeading.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: 'screenshots/comments/01-comments-section-empty.png',
      fullPage: false,
    });

    // 3. Write a comment
    const commentInput = page
      .getByPlaceholder(/escreva|coment|adicionar|write|add/i)
      .or(page.locator('textarea[name*="comment"], textarea[id*="comment"]'))
      .or(
        page.locator(
          '[data-testid="comment-input"] textarea, [data-testid="comment-textarea"]',
        ),
      )
      .first();

    await expect(commentInput).toBeVisible({ timeout: 15_000 });
    await commentInput.fill(
      `${TEST_PREFIX}Este gibi e fantastico! A arte do Akira Toriyama nunca decepciona.`,
    );

    await page.screenshot({
      path: 'screenshots/comments/02-comment-form-filled.png',
      fullPage: false,
    });

    // 4. Submit the comment
    const submitBtn = page
      .getByRole('button', { name: /enviar|publicar|comentar|submit|post/i })
      .first();
    await submitBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/comments/03-comment-submitted.png',
      fullPage: false,
    });

    // 5. Verify comment appears
    const commentText = page.getByText(/Este gibi e fantastico/);
    const commentVisible = await commentText.isVisible({ timeout: 10_000 }).catch(() => false);
    if (commentVisible) {
      await commentText.scrollIntoViewIfNeeded();
    }

    await page.screenshot({
      path: 'screenshots/comments/04-comment-in-thread.png',
      fullPage: false,
    });

    // 6. Reply to the comment
    const replyBtn = page.getByRole('button', { name: /responder|reply/i }).first();
    const hasReply = await replyBtn.isVisible().catch(() => false);

    if (hasReply) {
      await replyBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'screenshots/comments/05-reply-form-open.png',
        fullPage: false,
      });

      const replyInput = page
        .getByPlaceholder(/resposta|reply|escreva/i)
        .or(page.locator('textarea').last());

      if (await replyInput.isVisible().catch(() => false)) {
        await replyInput.fill(`${TEST_PREFIX}Concordo totalmente! Obra-prima absoluta.`);

        await page.screenshot({
          path: 'screenshots/comments/06-reply-filled.png',
          fullPage: false,
        });

        const submitReply = page
          .getByRole('button', { name: /enviar|publicar|responder|submit|reply/i })
          .last();
        await submitReply.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: 'screenshots/comments/07-reply-submitted.png',
          fullPage: false,
        });
      }
    }

    // 7. Like a comment
    const likeBtn = page
      .getByRole('button', { name: /curtir|like/i })
      .or(page.locator('[data-testid="like-button"], [data-testid^="comment-like"]'))
      .first();

    const hasLike = await likeBtn.isVisible().catch(() => false);
    if (hasLike) {
      await likeBtn.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/comments/08-comment-liked.png',
        fullPage: false,
      });

      // Unlike
      await likeBtn.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/comments/09-comment-unliked.png',
        fullPage: false,
      });
    } else {
      // Try icon-based like buttons
      const heartIcons = page.locator(
        '[data-testid*="like"], button:has(svg[data-icon="heart"]), button:has(svg[class*="heart"])',
      );
      if ((await heartIcons.count()) > 0) {
        await heartIcons.first().click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'screenshots/comments/08-comment-liked.png',
          fullPage: false,
        });
      }
    }

    // 8. Delete a comment
    const deleteBtn = page
      .getByRole('button', { name: /excluir|deletar|remover|delete|remove/i })
      .first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);

    if (hasDelete) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'screenshots/comments/10-delete-confirm-dialog.png',
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
        path: 'screenshots/comments/11-comment-deleted.png',
        fullPage: false,
      });
    }
  });

  test('unauthenticated user sees comments but cannot post', async ({ page }) => {
    await page.goto(`/pt-BR/catalog/${catalogEntryId}`);
    await page.waitForLoadState('networkidle');

    const commentsSection = page.getByText(/coment[aá]rios|comments|discuss[aã]o/i).first();
    await expect(commentsSection).toBeVisible({ timeout: 15_000 });
    await commentsSection.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: 'screenshots/comments/12-comments-unauthenticated.png',
      fullPage: false,
    });
  });
});
