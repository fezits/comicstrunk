import { Router } from 'express';
import {
  createDisputeSchema,
  listDisputesSchema,
  submitDisputeResponseSchema,
  resolveDisputeSchema,
  addDisputeMessageSchema,
  addEvidenceSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { uploadSingle } from '../../shared/middleware/upload';
import { uploadImage } from '../../shared/lib/cloudinary';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as disputesService from './disputes.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All dispute routes require authentication
router.use(authenticate);

// --- Admin routes (static paths BEFORE parameterized /:id) ---

// GET /admin/list — list all disputes (admin only)
router.get(
  '/admin/list',
  authorize('ADMIN'),
  validate(listDisputesSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await disputesService.listAllDisputes({ status, page, limit });
      sendPaginated(res, result.disputes, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/stats — dispute statistics (admin only)
router.get(
  '/admin/stats',
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await disputesService.getDisputeStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

// --- User routes ---

// POST / — create a new dispute
router.post(
  '/',
  validate(createDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputesService.createDispute(req.user!.userId, req.body);
      sendSuccess(res, dispute, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /my/buyer — list disputes where user is buyer
router.get(
  '/my/buyer',
  validate(listDisputesSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await disputesService.listBuyerDisputes(req.user!.userId, {
        status,
        page,
        limit,
      });
      sendPaginated(res, result.disputes, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /my/seller — list disputes where user is seller
router.get(
  '/my/seller',
  validate(listDisputesSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await disputesService.listSellerDisputes(req.user!.userId, {
        status,
        page,
        limit,
      });
      sendPaginated(res, result.disputes, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — get a single dispute by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispute = await disputesService.getDispute(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
    );
    sendSuccess(res, dispute);
  } catch (err) {
    next(err);
  }
});

// POST /:id/evidence — add evidence (image upload)
router.post(
  '/:id/evidence',
  uploadSingle('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('Imagem é obrigatória');
      }

      // Validate description if provided
      const parsed = addEvidenceSchema.parse(req.body);

      // Upload image to cloudinary (or local storage)
      const { url } = await uploadImage(req.file.buffer, 'disputes/evidence');

      const evidence = await disputesService.addEvidence(
        req.params.id as string,
        req.user!.userId,
        url,
        parsed.description,
      );
      sendSuccess(res, evidence, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/respond — seller responds to a dispute
router.post(
  '/:id/respond',
  validate(submitDisputeResponseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputesService.respondToDispute(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, dispute);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/messages — add a message to a dispute
router.post(
  '/:id/messages',
  validate(addDisputeMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await disputesService.addMessage(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, message, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/resolve — admin resolves a dispute
router.post(
  '/:id/resolve',
  authorize('ADMIN'),
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputesService.resolveDispute(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, dispute);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/cancel — cancel a dispute (buyer only)
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispute = await disputesService.cancelDispute(
      req.params.id as string,
      req.user!.userId,
    );
    sendSuccess(res, dispute);
  } catch (err) {
    next(err);
  }
});

export const disputesRoutes: Router = router;
