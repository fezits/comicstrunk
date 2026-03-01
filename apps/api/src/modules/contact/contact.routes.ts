import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createContactMessageSchema, listContactMessagesSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as contactService from './contact.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Rate limiter for public contact form ===

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 mensagens por IP por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Muitas mensagens enviadas. Tente novamente em 1 hora.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test',
});

// === Public routes ===

// POST / — submit a contact message
router.post(
  '/',
  contactLimiter,
  validate(createContactMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await contactService.submitMessage(req.body);
      sendSuccess(res, message, 201);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin routes ===

// GET /admin/list — list all contact messages (paginated, filterable)
router.get(
  '/admin/list',
  authenticate,
  authorize('ADMIN'),
  validate(listContactMessagesSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, isRead, isResolved, category } = req.query as unknown as {
        page: number;
        limit: number;
        isRead?: boolean;
        isResolved?: boolean;
        category?: 'SUGGESTION' | 'PROBLEM' | 'PARTNERSHIP' | 'OTHER';
      };
      const result = await contactService.listMessages(
        { isRead, isResolved, category },
        { page, limit },
      );
      sendPaginated(res, result.messages, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/:id — get a single contact message
router.get(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await contactService.getMessage(req.params.id as string);
      sendSuccess(res, message);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/:id/read — mark message as read
router.put(
  '/admin/:id/read',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await contactService.markAsRead(req.params.id as string);
      sendSuccess(res, message);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/:id/resolve — mark message as resolved
router.put(
  '/admin/:id/resolve',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await contactService.markAsResolved(req.params.id as string);
      sendSuccess(res, message);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/:id — delete a contact message
router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await contactService.deleteMessage(req.params.id as string);
      sendSuccess(res, { message: 'Mensagem excluida com sucesso' });
    } catch (err) {
      next(err);
    }
  },
);

export const contactRoutes: Router = router;
