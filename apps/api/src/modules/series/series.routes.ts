import { Router } from 'express';
import { seriesSearchSchema, createSeriesSchema, updateSeriesSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { cachePublic } from '../../shared/middleware/cache-control';
import * as seriesService from './series.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET / — public, list series with search and pagination
router.get(
  '/',
  validate(seriesSearchSchema, 'query'),
  cachePublic(300),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await seriesService.listSeries(req.query as never);
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

// GET /:id — public, get series detail with approved editions
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const series = await seriesService.getSeriesById(req.params.id as string);
    sendSuccess(res, series);
  } catch (err) {
    next(err);
  }
});

// POST / — admin only, create series
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createSeriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const series = await seriesService.createSeries(req.body);
      sendSuccess(res, series, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — admin only, update series
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateSeriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const series = await seriesService.updateSeries(req.params.id as string, req.body);
      sendSuccess(res, series);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — admin only, delete series
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await seriesService.deleteSeries(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

export const seriesRoutes: Router = router;
