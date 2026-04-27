import { Router } from 'express';
import { z } from 'zod';
import {
  createCheckoutSchema,
  adminActivateSubscriptionSchema,
  adminSubscriptionListSchema,
  createPlanConfigSchema,
  updatePlanConfigSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as subscriptionsService from './subscriptions.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET /plans (public) -- list active plan configs
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await subscriptionsService.listActivePlans();
    sendSuccess(res, plans);
  } catch (err) {
    next(err);
  }
});

// GET /status (authenticated) -- get current user subscription status
router.get(
  '/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await subscriptionsService.getSubscriptionStatus(req.user!.userId);
      sendSuccess(res, status);
    } catch (err) {
      next(err);
    }
  },
);

// POST /checkout (authenticated) -- create Stripe Checkout Session
router.post(
  '/checkout',
  authenticate,
  validate(createCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.createCheckoutSession(
        req.user!.userId,
        req.body.planConfigId,
      );
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /portal (authenticated) -- create Stripe Customer Portal session
router.post(
  '/portal',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.createPortalSession(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /cancel (authenticated) -- cancel subscription at end of period
router.post(
  '/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.cancelSubscription(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// ADMIN ROUTES (authenticate + authorize('ADMIN'))
// =============================================================================

// GET /admin/list -- list all subscriptions with filters
router.get(
  '/admin/list',
  authenticate,
  authorize('ADMIN'),
  validate(adminSubscriptionListSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.adminListSubscriptions(req.query as never);
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

// POST /admin/activate -- manually activate subscription (dev mode)
router.post(
  '/admin/activate',
  authenticate,
  authorize('ADMIN'),
  validate(adminActivateSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = await subscriptionsService.adminActivateSubscription(req.body);
      sendSuccess(res, subscription);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/plans -- list all plan configs (including inactive)
router.get(
  '/admin/plans',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await subscriptionsService.adminListAllPlans();
      sendSuccess(res, plans);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/plans -- create plan config
router.post(
  '/admin/plans',
  authenticate,
  authorize('ADMIN'),
  validate(createPlanConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await subscriptionsService.adminCreatePlan(req.body);
      sendSuccess(res, plan, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/plans/:id -- update plan config
router.put(
  '/admin/plans/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updatePlanConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await subscriptionsService.adminUpdatePlan(req.params.id as string, req.body);
      sendSuccess(res, plan);
    } catch (err) {
      next(err);
    }
  },
);

// POST /pix — create PIX subscription (authenticated)
router.post(
  '/pix',
  authenticate,
  validate(z.object({ planConfigId: z.string().min(1) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.createPixSubscription(
        req.user!.userId,
        req.body.planConfigId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /pix/:paymentId/confirm — admin confirms PIX subscription payment
router.post(
  '/pix/:paymentId/confirm',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionsService.confirmPixSubscriptionPayment(
        req.params.paymentId as string,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const subscriptionRoutes: Router = router;
