import { Router } from 'express';
import { notificationsQuerySchema, updatePreferencesSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as notificationsService from './notifications.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /unread-count — returns unread notification count
router.get(
  '/unread-count',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await notificationsService.getUnreadCount(req.user!.userId);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  },
);

// GET /recent — recent notifications for dropdown
router.get(
  '/recent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notifications = await notificationsService.getRecentNotifications(
        req.user!.userId,
      );
      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  },
);

// GET /preferences — get notification preferences
router.get(
  '/preferences',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preferences = await notificationsService.getPreferences(req.user!.userId);
      sendSuccess(res, preferences);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /preferences — update notification preferences
router.put(
  '/preferences',
  validate(updatePreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preferences = await notificationsService.updatePreferences(
        req.user!.userId,
        req.body.preferences,
      );
      sendSuccess(res, preferences);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /read-all — mark all notifications as read
router.patch(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationsService.markAllAsRead(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — list all notifications (paginated)
router.get(
  '/',
  validate(notificationsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, unreadOnly } = req.query as unknown as {
        page: number;
        limit: number;
        unreadOnly?: boolean;
      };
      const result = await notificationsService.getUserNotifications(
        req.user!.userId,
        page,
        limit,
        unreadOnly,
      );
      sendPaginated(res, result.notifications, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/read — mark single notification as read
router.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await notificationsService.markAsRead(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, notification);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/unread — mark single notification as unread
router.patch(
  '/:id/unread',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await notificationsService.markAsUnread(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, notification);
    } catch (err) {
      next(err);
    }
  },
);

export const notificationsRoutes: Router = router;
