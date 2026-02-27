import { Router } from 'express';
import {
  commissionPreviewSchema,
  createCommissionConfigSchema,
  updateCommissionConfigSchema,
} from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as commissionService from './commission.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Preview commission (authenticated — any user) ===

router.get(
  '/preview',
  authenticate,
  validate(commissionPreviewSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { price } = req.query as unknown as { price: number };
      const result = await commissionService.previewCommission(price, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin: List all commission configs ===

router.get(
  '/configs',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const configs = await commissionService.listCommissionConfigs();
      sendSuccess(res, configs);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin: Create commission config ===

router.post(
  '/configs',
  authenticate,
  authorize('ADMIN'),
  validate(createCommissionConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await commissionService.createCommissionConfig(req.body);
      sendSuccess(res, config, 201);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin: Update commission config ===

router.put(
  '/configs/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCommissionConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await commissionService.updateCommissionConfig(
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, config);
    } catch (err) {
      next(err);
    }
  },
);

export const commissionRoutes: Router = router;
