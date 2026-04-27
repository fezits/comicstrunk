import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as payoutsService from './payouts.service';

const router = Router();
router.use(authenticate);

// =========================================================================
// Seller endpoints
// =========================================================================

// GET /payouts/balance
router.get('/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await payoutsService.getMyBalance(req.user!.userId);
    sendSuccess(res, balance);
  } catch (err) {
    next(err);
  }
});

// GET /payouts/balance/entries
router.get(
  '/balance/entries',
  validate(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await payoutsService.listMyBalanceEntries(req.user!.userId, page, limit);
      sendPaginated(res, result.data, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// POST /payouts/request
const requestPayoutSchema = z.object({ amount: z.number().positive() });
router.post(
  '/request',
  validate(requestPayoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount } = req.body as { amount: number };
      const result = await payoutsService.requestPayout(req.user!.userId, amount);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /payouts/me
router.get(
  '/me',
  validate(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await payoutsService.listMyPayouts(req.user!.userId, page, limit);
      sendPaginated(res, result.data, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// =========================================================================
// Admin endpoints
// =========================================================================

router.get(
  '/admin',
  authorize('ADMIN'),
  validate(
    z.object({
      status: z.enum(['REQUESTED', 'APPROVED', 'PAID', 'REJECTED']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    'query',
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
        page: number;
        limit: number;
      };
      const result = await payoutsService.adminListPayouts({ status, page, limit });
      sendPaginated(res, result.data, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/admin/:id/approve',
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await payoutsService.adminApprovePayout(req.params.id as string, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/admin/:id/paid',
  authorize('ADMIN'),
  validate(z.object({ externalReceipt: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { externalReceipt } = req.body as { externalReceipt?: string };
      const result = await payoutsService.adminMarkPaid(req.params.id as string, req.user!.userId, externalReceipt);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/admin/:id/reject',
  authorize('ADMIN'),
  validate(z.object({ reason: z.string().min(3) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason: string };
      const result = await payoutsService.adminRejectPayout(req.params.id as string, req.user!.userId, reason);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const payoutsRoutes: Router = router;
