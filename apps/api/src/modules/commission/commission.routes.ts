import { Router } from 'express';
import { z } from 'zod';
import {
  commissionPreviewSchema,
  createCommissionConfigSchema,
  updateCommissionConfigSchema,
  paginationSchema,
} from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as commissionService from './commission.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Inline validation schemas for commission dashboard ===

const commissionDashboardSchema = z.object({
  periodStart: z.string().datetime({ offset: true }).or(z.string().date()),
  periodEnd: z.string().datetime({ offset: true }).or(z.string().date()),
});

const commissionTransactionsSchema = paginationSchema.extend({
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

// === Preview commission (authenticated -- any user) ===

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

// =============================================================================
// ADMIN ROUTES (static paths before parameterized)
// =============================================================================

// === Admin: Commission Dashboard ===

router.get(
  '/admin/dashboard',
  authenticate,
  authorize('ADMIN'),
  validate(commissionDashboardSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { periodStart, periodEnd } = req.query as unknown as {
        periodStart: string;
        periodEnd: string;
      };
      const result = await commissionService.getCommissionDashboard(
        new Date(periodStart),
        new Date(periodEnd),
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin: Commission Transactions ===

router.get(
  '/admin/transactions',
  authenticate,
  authorize('ADMIN'),
  validate(commissionTransactionsSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, periodStart, periodEnd } = req.query as unknown as {
        page: number;
        limit: number;
        periodStart?: string;
        periodEnd?: string;
      };
      const result = await commissionService.getCommissionTransactions(
        page,
        limit,
        periodStart ? new Date(periodStart) : undefined,
        periodEnd ? new Date(periodEnd) : undefined,
      );
      sendPaginated(res, result.transactions, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
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
