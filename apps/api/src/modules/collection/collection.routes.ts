import { Router } from 'express';
import {
  createCollectionItemSchema,
  updateCollectionItemSchema,
  markForSaleSchema,
  markAsReadSchema,
  collectionSearchSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { uploadCSV, uploadSingle } from '../../shared/middleware/upload';
import { uploadImage } from '../../shared/lib/cloudinary';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as collectionService from './collection.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All collection routes require authentication
router.use(authenticate);

// ============================================================================
// Static routes MUST be defined BEFORE /:id to prevent Express
// from matching "stats", "export", etc. as an id parameter.
// ============================================================================

// GET /stats — collection statistics
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await collectionService.getStats(req.user!.userId);
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

// GET /series-progress — progress per series
router.get(
  '/series-progress',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seriesId = req.query.seriesId as string | undefined;
      const progress = await collectionService.getSeriesProgress(req.user!.userId, seriesId);
      sendSuccess(res, progress);
    } catch (err) {
      next(err);
    }
  },
);

// GET /export — export collection as CSV
router.get(
  '/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csvString = await collectionService.exportCSV(req.user!.userId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="collection-export-${Date.now()}.csv"`,
      );
      res.send(csvString);
    } catch (err) {
      next(err);
    }
  },
);

// GET /csv-template — download empty CSV template
router.get(
  '/csv-template',
  (_req: Request, res: Response, next: NextFunction) => {
    try {
      const csvString = collectionService.getCSVTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="collection-import-template.csv"',
      );
      res.send(csvString);
    } catch (err) {
      next(err);
    }
  },
);

// POST /import — import collection from CSV
router.post(
  '/import',
  uploadCSV('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No CSV file provided');
      }
      const result = await collectionService.importCSV(req.user!.userId, req.file.buffer);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /missing-editions/:seriesId — editions the user does NOT own
router.get(
  '/missing-editions/:seriesId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const editions = await collectionService.getMissingEditions(
        req.user!.userId,
        req.params.seriesId as string,
      );
      sendSuccess(res, editions);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// List + Create
// ============================================================================

// GET / — list collection items with filters
router.get(
  '/',
  validate(collectionSearchSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await collectionService.getItems(req.user!.userId, req.query as never);
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

// POST / — add item to collection
router.post(
  '/',
  validate(createCollectionItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await collectionService.addItem(req.user!.userId, req.body);
      sendSuccess(res, item, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// Item-specific routes (/:id)
// Photo routes MUST be defined BEFORE GET /:id to prevent path collision.
// ============================================================================

// POST /:id/photos — upload a photo for a collection item
router.post(
  '/:id/photos',
  uploadSingle('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No photo file provided');
      }
      const { url } = await uploadImage(req.file.buffer, 'comicstrunk/collection');
      const item = await collectionService.addPhoto(
        req.user!.userId,
        req.params.id as string,
        url,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id/photos/:photoIndex — remove a photo by index
router.delete(
  '/:id/photos/:photoIndex',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const photoIndex = parseInt(req.params.photoIndex as string, 10);
      if (isNaN(photoIndex)) {
        throw new BadRequestError('Invalid photo index');
      }
      const item = await collectionService.removePhoto(
        req.user!.userId,
        req.params.id as string,
        photoIndex,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — get single collection item
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await collectionService.getItem(req.user!.userId, req.params.id as string);
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — update collection item
router.put(
  '/:id',
  validate(updateCollectionItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await collectionService.updateItem(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — delete collection item
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await collectionService.deleteItem(req.user!.userId, req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/photos — upload a photo for a collection item
router.post(
  '/:id/photos',
  uploadSingle('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No photo file provided');
      }
      const { url } = await uploadImage(req.file.buffer, 'comicstrunk/collection');
      const item = await collectionService.addPhoto(
        req.user!.userId,
        req.params.id as string,
        url,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id/photos/:photoIndex — remove a photo by index
router.delete(
  '/:id/photos/:photoIndex',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const photoIndex = parseInt(req.params.photoIndex as string, 10);
      if (isNaN(photoIndex)) {
        throw new BadRequestError('Invalid photo index');
      }
      const item = await collectionService.removePhoto(
        req.user!.userId,
        req.params.id as string,
        photoIndex,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/read — toggle read status
router.patch(
  '/:id/read',
  validate(markAsReadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await collectionService.markAsRead(
        req.user!.userId,
        req.params.id as string,
        req.body.isRead,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/sale — toggle for sale
router.patch(
  '/:id/sale',
  validate(markForSaleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await collectionService.markForSale(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

export const collectionRoutes: Router = router;
