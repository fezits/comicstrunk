import { Router } from 'express';
import {
  createCatalogReviewSchema,
  createSellerReviewSchema,
  updateReviewSchema,
  paginationSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as reviewsService from './reviews.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Public routes (no auth required) ===

// GET /catalog/:catalogEntryId — list reviews for a catalog entry
router.get(
  '/catalog/:catalogEntryId',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await reviewsService.getCatalogReviews(
        req.params.catalogEntryId as string,
        page,
        limit,
      );
      sendPaginated(res, result.reviews, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /seller/:sellerId — list reviews for a seller with average rating
router.get(
  '/seller/:sellerId',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await reviewsService.getSellerReviews(
        req.params.sellerId as string,
        page,
        limit,
      );
      sendSuccess(res, {
        reviews: result.reviews,
        averageRating: result.averageRating,
        ratingCount: result.ratingCount,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// === Authenticated routes ===

// GET /catalog/:catalogEntryId/mine — get user's own review for a catalog entry
router.get(
  '/catalog/:catalogEntryId/mine',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await reviewsService.getUserReviewForCatalog(
        req.user!.userId,
        req.params.catalogEntryId as string,
      );
      sendSuccess(res, review);
    } catch (err) {
      next(err);
    }
  },
);

// POST /catalog — create a catalog review
router.post(
  '/catalog',
  authenticate,
  validate(createCatalogReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await reviewsService.createCatalogReview(
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, review, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /seller — create a seller review
router.post(
  '/seller',
  authenticate,
  validate(createSellerReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await reviewsService.createSellerReview(
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, review, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — update own review
router.put(
  '/:id',
  authenticate,
  validate(updateReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await reviewsService.updateReview(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, review);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — delete own review
router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await reviewsService.deleteReview(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, { message: 'Review deleted successfully' });
    } catch (err) {
      next(err);
    }
  },
);

export const reviewsRoutes: Router = router;
