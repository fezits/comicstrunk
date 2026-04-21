import { Router } from 'express';
import { createCommentSchema, updateCommentSchema } from '@comicstrunk/contracts';
import { paginationSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate, optionalAuthenticate } from '../../shared/middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as commentsService from './comments.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// ============================================================================
// Static routes MUST be defined BEFORE /:id to prevent path collision.
// ============================================================================

// GET /catalog/:catalogEntryId — list comments for a catalog entry (public, optional auth for like status)
router.get(
  '/catalog/:catalogEntryId',
  optionalAuthenticate,
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const catalogEntryId = req.params.catalogEntryId as string;
      const result = await commentsService.getCatalogComments(
        catalogEntryId,
        page,
        limit,
        req.user?.userId,
      );
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST / — create a comment or reply (auth required)
router.post(
  '/',
  authenticate,
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await commentsService.createComment(req.user!.userId, req.body);
      sendSuccess(res, comment, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — update own comment (auth required)
router.put(
  '/:id',
  authenticate,
  validate(updateCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await commentsService.updateComment(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, comment);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — delete own comment (auth required)
router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await commentsService.deleteComment(req.user!.userId, req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/like — toggle like on a comment (auth required)
router.post(
  '/:id/like',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await commentsService.toggleCommentLike(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const commentsRoutes: Router = router;
