import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { uploadSingle } from '../../shared/middleware/upload';
import { sendSuccess } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as service from './cover-submissions.service';

const userRouter: Router = Router();

// POST /catalog/:id/cover-submissions — user submits a cover for a catalog entry
userRouter.post(
  '/catalog/:id/cover-submissions',
  authenticate,
  uploadSingle('cover'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new BadRequestError('Arquivo de imagem é obrigatório');
      const result = await service.submit(req.user!.userId, req.params.id as string, req.file.buffer);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /catalog/:id/cover-submissions/mine — user sees their submissions for an entry
userRouter.get(
  '/catalog/:id/cover-submissions/mine',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await service.getMine(req.user!.userId, req.params.id as string);
      sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  },
);

const adminRouter: Router = Router();
adminRouter.use(authenticate, authorize('ADMIN'));

// GET /admin/cover-submissions — list pending submissions
adminRouter.get(
  '/cover-submissions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await service.listPending(page, limit);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-submissions/:id/approve
adminRouter.post(
  '/cover-submissions/:id/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.approve(req.params.id as string, req.user!.userId);
      sendSuccess(res, { approved: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-submissions/:id/reject
adminRouter.post(
  '/cover-submissions/:id/reject',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reason = (req.body?.reason as string) || undefined;
      await service.reject(req.params.id as string, req.user!.userId, reason);
      sendSuccess(res, { rejected: true });
    } catch (err) {
      next(err);
    }
  },
);

export const coverSubmissionsUserRoutes = userRouter;
export const coverSubmissionsAdminRoutes = adminRouter;
