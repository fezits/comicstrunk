import { Router } from 'express';
import {
  listUsersSchema,
  updateUserRoleSchema,
  suspendUserSchema,
  type ListUsersInput,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as adminService from './admin.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /dashboard — aggregate platform metrics
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await adminService.getDashboardMetrics();
    sendSuccess(res, metrics);
  } catch (err) {
    next(err);
  }
});

// GET /users — paginated user list with search and role filter
router.get(
  '/users',
  validate(listUsersSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as ListUsersInput;
      const result = await adminService.listUsers(filters);
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

// GET /users/:id — full user detail
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await adminService.getUser(req.params.id as string);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id/role — change user role
router.put(
  '/users/:id/role',
  validate(updateUserRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminService.updateUserRole(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /users/:id/suspend — suspend user (force role to USER, cancel subscriptions)
router.post(
  '/users/:id/suspend',
  validate(suspendUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.suspendUser(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /users/:id/unsuspend — unsuspend user
router.post(
  '/users/:id/unsuspend',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.unsuspendUser(
        req.params.id as string,
        req.user!.userId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const adminRoutes: Router = router;
