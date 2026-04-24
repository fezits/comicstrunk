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
import { prisma } from '../../shared/lib/prisma';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';
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

// === Cover Review ===

// GET /covers/review — list covers for review (suspected placeholders)
router.get('/covers/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = (req.query.filter as string) || 'all'; // 'all' | 'rika' | 'panini' | 'openlibrary'
    const skip = (page - 1) * limit;

    const sort = (req.query.sort as string) || 'title';
    const titleSearch = req.query.title as string | undefined;
    const where: Record<string, unknown> = {
      coverFileName: { not: null },
    };

    if (titleSearch) {
      where.title = { contains: titleSearch };
    }

    if (filter === 'rika') where.coverFileName = { startsWith: 'rika-' };
    else if (filter === 'panini') where.coverFileName = { startsWith: 'panini-' };
    else if (filter === 'openlibrary') where.coverImageUrl = { contains: 'openlibrary' };
    else if (filter === 'placeholder_rika') {
      // Placeholder Rika: coverFileName starts with rika- (sorted by filename to group similar sizes)
      where.coverFileName = { startsWith: 'rika-' };
    }

    const orderBy = sort === 'filename'
      ? { coverFileName: 'asc' as const }
      : { title: 'asc' as const };

    const [entries, total] = await Promise.all([
      prisma.catalogEntry.findMany({
        where,
        select: { id: true, title: true, slug: true, coverImageUrl: true, coverFileName: true, publisher: true },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.catalogEntry.count({ where }),
    ]);

    const resolved = entries.map(resolveCoverUrl);
    sendPaginated(res, resolved, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

// POST /covers/remove — remove covers (set to NULL) for selected entry IDs
router.post('/covers/remove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!ids?.length) {
      sendSuccess(res, { removed: 0 });
      return;
    }

    const result = await prisma.catalogEntry.updateMany({
      where: { id: { in: ids } },
      data: { coverImageUrl: null, coverFileName: null },
    });

    sendSuccess(res, { removed: result.count });
  } catch (err) {
    next(err);
  }
});

export const adminRoutes: Router = router;
