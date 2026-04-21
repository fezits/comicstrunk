import { Router } from 'express';
import {
  initiatePaymentSchema,
  adminApprovePaymentSchema,
  refundPaymentSchema,
  listPaymentsSchema,
  paginationSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as paymentsService from './payments.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// =============================================================================
// STATIC ROUTES FIRST (before parameterized routes)
// =============================================================================

// GET /history -- user's payment history
router.get(
  '/history',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await paymentsService.getUserPaymentHistory(
        req.user!.userId,
        page,
        limit,
      );
      sendPaginated(res, result.payments, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/approve -- admin: approve a pending payment
router.post(
  '/admin/approve',
  authorize('ADMIN'),
  validate(adminApprovePaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await paymentsService.adminApprovePayment(req.body.orderId);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/reject -- admin: reject a pending payment
router.post(
  '/admin/reject',
  authorize('ADMIN'),
  validate(adminApprovePaymentSchema), // same schema: { orderId: string }
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await paymentsService.adminRejectPayment(req.body.orderId);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/pending -- admin: list pending payments
router.get(
  '/admin/pending',
  authorize('ADMIN'),
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await paymentsService.adminListPendingPayments(page, limit);
      sendPaginated(res, result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/list -- admin: list all payments with optional status filter
router.get(
  '/admin/list',
  authorize('ADMIN'),
  validate(listPaymentsSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await paymentsService.adminListAllPayments({ status, page, limit });
      sendPaginated(res, result.payments, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// PARAMETERIZED ROUTES
// =============================================================================

// POST /initiate -- initiate PIX payment for an order
router.post(
  '/initiate',
  validate(initiatePaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentsService.initiatePixPayment(
        req.body.orderId,
        req.user!.userId,
      );
      sendSuccess(res, payment, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:paymentId/refund -- admin: refund a payment (total or partial)
router.post(
  '/:paymentId/refund',
  authorize('ADMIN'),
  validate(refundPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentsService.refundPayment(
        req.params.paymentId as string,
        req.body.amount,
      );
      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:orderId/status -- check payment status for an order
router.get(
  '/:orderId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentsService.getPaymentStatus(
        req.params.orderId as string,
        req.user!.userId,
      );
      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  },
);

export const paymentsRoutes: Router = router;
