import { Router } from 'express';
import { marketplaceSearchSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as marketplaceService from './marketplace.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Public: Search marketplace listings (NO auth required) ===

router.get(
  '/',
  validate(marketplaceSearchSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await marketplaceService.searchListings(req.query as never);
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

// === Public: Get single listing by ID (NO auth required) ===

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const listing = await marketplaceService.getListingById(req.params.id as string);
      sendSuccess(res, listing);
    } catch (err) {
      next(err);
    }
  },
);

export const marketplaceRoutes: Router = router;
