import { Router } from 'express';
import { toggleFavoriteSchema, favoritesQuerySchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as favoritesService from './favorites.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All favorites routes require authentication
router.use(authenticate);

// GET /check/:catalogEntryId — check if a catalog entry is favorited
router.get(
  '/check/:catalogEntryId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await favoritesService.checkIsFavorited(
        req.user!.userId,
        req.params.catalogEntryId as string,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — list user's favorites (paginated)
router.get(
  '/',
  validate(favoritesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await favoritesService.getUserFavorites(req.user!.userId, page, limit);
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

// POST /toggle — toggle favorite status on a catalog entry
router.post(
  '/toggle',
  validate(toggleFavoriteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await favoritesService.toggleFavorite(
        req.user!.userId,
        req.body.catalogEntryId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const favoritesRoutes: Router = router;
