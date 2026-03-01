import { Router } from 'express';
import {
  createDataRequestSchema,
  listDataRequestsSchema,
  rejectDataRequestSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as lgpdService from './lgpd.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All LGPD routes require authentication
router.use(authenticate);

// ============================================================================
// USER ROUTES
// ============================================================================

// POST /requests — create a new data request
router.post(
  '/requests',
  validate(createDataRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await lgpdService.createDataRequest(req.user!.userId, req.body);
      sendSuccess(res, request, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /requests — list user's own data requests
router.get(
  '/requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await lgpdService.listUserRequests(req.user!.userId, page, limit);
      sendPaginated(res, result.requests, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /export — export all user data as JSON
router.get(
  '/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await lgpdService.exportUserData(req.user!.userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="meus-dados-comicstrunk-${new Date().toISOString().slice(0, 10)}.json"`,
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /delete-account — schedule account deletion (30-day grace period)
router.post(
  '/delete-account',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await lgpdService.scheduleAccountDeletion(req.user!.userId);
      sendSuccess(res, request, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// GET /admin/requests — list all data requests (admin only)
router.get(
  '/admin/requests',
  authorize('ADMIN'),
  validate(listDataRequestsSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, type, page, limit } = req.query as unknown as {
        status?: string;
        type?: string;
        page: number;
        limit: number;
      };
      const result = await lgpdService.listAllRequests(
        {
          status: status as import('@prisma/client').DataRequestStatus | undefined,
          type: type as import('@prisma/client').DataRequestType | undefined,
        },
        page,
        limit,
      );
      sendPaginated(res, result.requests, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/requests/:id/process — mark request as processing (admin only)
router.put(
  '/admin/requests/:id/process',
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await lgpdService.processRequest(req.params.id as string);
      sendSuccess(res, request);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/requests/:id/complete — mark request as completed (admin only)
router.put(
  '/admin/requests/:id/complete',
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await lgpdService.completeRequest(req.params.id as string);
      sendSuccess(res, request);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/requests/:id/reject — reject request (admin only)
router.put(
  '/admin/requests/:id/reject',
  authorize('ADMIN'),
  validate(rejectDataRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason: string };
      const request = await lgpdService.rejectRequest(req.params.id as string, reason);
      sendSuccess(res, request);
    } catch (err) {
      next(err);
    }
  },
);

export const lgpdRoutes: Router = router;
