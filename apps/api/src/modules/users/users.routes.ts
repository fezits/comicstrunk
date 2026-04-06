import { Router } from 'express';
import { updateProfileSchema } from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as usersService from './users.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET /:id/public — no auth, returns safe public profile
router.get(
  '/:id/public',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await usersService.getPublicProfile(req.params.id as string);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  },
);

// GET /profile
router.get(
  '/profile',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await usersService.getProfile(req.user!.userId);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /profile
router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await usersService.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  },
);

export const usersRoutes: Router = router;
