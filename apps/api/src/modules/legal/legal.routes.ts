import { Router } from 'express';
import {
  createLegalDocumentSchema,
  updateLegalDocumentSchema,
  acceptDocumentSchema,
  listLegalDocumentsSchema,
  legalDocumentTypeEnum,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as legalService from './legal.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// ============================================================================
// ADMIN ROUTES (static paths BEFORE parameterized routes)
// ============================================================================

// GET /admin/list — List all documents (admin only, paginated)
router.get(
  '/admin/list',
  authenticate,
  authorize('ADMIN'),
  validate(listLegalDocumentsSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, type } = req.query as unknown as {
        page: number;
        limit: number;
        type?: string;
      };
      const result = await legalService.listDocuments({
        page,
        limit,
        type: type as import('@comicstrunk/contracts').LegalDocumentType | undefined,
      });
      sendPaginated(res, result.documents, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/history/:type — Get version history for a document type
router.get(
  '/admin/history/:type',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const typeParsed = legalDocumentTypeEnum.safeParse(req.params.type);
      if (!typeParsed.success) {
        throw new BadRequestError('Tipo de documento invalido');
      }
      const history = await legalService.getDocumentHistory(typeParsed.data);
      sendSuccess(res, history);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin — Create a new legal document
router.post(
  '/admin',
  authenticate,
  authorize('ADMIN'),
  validate(createLegalDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await legalService.createDocument(req.body);
      sendSuccess(res, doc, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/:id — Update an existing legal document
router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateLegalDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await legalService.updateDocument(req.params.id as string, req.body);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// AUTHENTICATED ROUTES (static paths BEFORE parameterized /:id)
// ============================================================================

// POST /accept — Accept a document
router.post(
  '/accept',
  authenticate,
  validate(acceptDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId } = req.body;
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const acceptance = await legalService.acceptDocument(
        req.user!.userId,
        documentId,
        ipAddress,
      );
      sendSuccess(res, acceptance, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /pending — Get mandatory documents the user hasn't accepted yet
router.get(
  '/pending',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pending = await legalService.getPendingAcceptances(req.user!.userId);
      sendSuccess(res, pending);
    } catch (err) {
      next(err);
    }
  },
);

// GET /my-acceptances — Get user's acceptance history (audit)
router.get(
  '/my-acceptances',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acceptances = await legalService.getUserAcceptances(req.user!.userId);
      sendSuccess(res, acceptances);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// PUBLIC ROUTES (parameterized routes LAST)
// ============================================================================

// GET /latest/:type — Get the latest version of a document by type
router.get(
  '/latest/:type',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const typeParsed = legalDocumentTypeEnum.safeParse(req.params.type);
      if (!typeParsed.success) {
        throw new BadRequestError('Tipo de documento invalido');
      }
      const doc = await legalService.getLatestByType(typeParsed.data);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — Get a specific document by ID
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await legalService.getDocumentById(req.params.id as string);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

export const legalRoutes: Router = router;
