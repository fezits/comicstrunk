import { Router } from 'express';
import { z } from 'zod';
import {
  createCatalogEntrySchema,
  updateCatalogEntrySchema,
  catalogSearchSchema,
  paginationSchema,
  approvalStatusSchema,
} from '@comicstrunk/contracts';
import type { CatalogSearchInput } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { uploadSingle, uploadCSV } from '../../shared/middleware/upload';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as catalogService from './catalog.service';
import { importFromJSON } from './catalog-import.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Admin list schema (pagination + optional status filter) ===

const adminListSchema = paginationSchema.extend({
  approvalStatus: approvalStatusSchema.optional(),
});

// === Rejection body schema ===

const rejectionBodySchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required').max(2000),
});

// ============================================================================
// IMPORTANT: Admin routes MUST be defined BEFORE /:id to prevent Express
// from matching "admin" as an id parameter.
// ============================================================================

// GET /admin/list — admin only, list entries with optional status filter
router.get(
  '/admin/list',
  authenticate,
  authorize('ADMIN'),
  validate(adminListSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, approvalStatus } = req.query as unknown as {
        page: number;
        limit: number;
        approvalStatus?: string;
      };
      const result = await catalogService.listCatalogEntries({
        page,
        limit,
        approvalStatus,
      });
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

// GET /admin/:id — admin only, get any entry regardless of approval status
router.get(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.getCatalogEntryById(
        req.params.id as string,
        false, // publicOnly = false → returns any status
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// Public endpoints (no auth)
// ============================================================================

// GET / — public browse with combined filters: only APPROVED entries
router.get(
  '/',
  validate(catalogSearchSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as CatalogSearchInput;
      const result = await catalogService.searchCatalog(filters);
      sendPaginated(res, result.entries, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// Admin CSV import/export (MUST be before /:id)
// ============================================================================

// GET /export — admin only, download all APPROVED entries as CSV
router.get(
  '/export',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const csvString = await catalogService.exportToCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="catalog-export-${Date.now()}.csv"`,
      );
      res.send(csvString);
    } catch (err) {
      next(err);
    }
  },
);

// POST /import — admin only, bulk import from CSV with row-level validation
router.post(
  '/import',
  authenticate,
  authorize('ADMIN'),
  uploadCSV('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No CSV file provided');
      }
      const result = await catalogService.importFromCSV(req.file.buffer, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /import-json — admin only, bulk import from JSON
router.post(
  '/import-json',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows, options } = req.body;

      if (!Array.isArray(rows)) {
        throw new BadRequestError('Request body must contain a "rows" JSON array');
      }

      const result = await importFromJSON(rows, req.user!.userId, options);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /stats — catalog statistics (counts by source, covers, etc.)
router.get(
  '/stats',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await catalogService.getCatalogStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

// POST /by-source-key/:sourceKey/cover — upload cover by sourceKey (for sync)
router.post(
  '/by-source-key/:sourceKey/cover',
  authenticate,
  authorize('ADMIN'),
  uploadSingle('cover'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No file provided');
      }
      const entry = await catalogService.uploadCoverBySourceKey(
        req.params.sourceKey as string,
        req.file.buffer,
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — public, only returns APPROVED entries
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await catalogService.getCatalogEntryById(
      req.params.id as string,
      true,
    );
    sendSuccess(res, entry);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Admin CRUD endpoints
// ============================================================================

// POST / — admin only, create catalog entry
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCatalogEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.createCatalogEntry({
        ...req.body,
        createdById: req.user!.userId,
      });
      sendSuccess(res, entry, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — admin only, update catalog entry
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCatalogEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.updateCatalogEntry(
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — admin only, delete catalog entry
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await catalogService.deleteCatalogEntry(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// Admin approval endpoints
// ============================================================================

// PATCH /:id/submit — admin only, submit for review (DRAFT -> PENDING)
router.patch(
  '/:id/submit',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.updateApprovalStatus(
        req.params.id as string,
        'submit',
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/approve — admin only, approve entry (PENDING -> APPROVED)
router.patch(
  '/:id/approve',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.updateApprovalStatus(
        req.params.id as string,
        'approve',
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/reject — admin only, reject entry (PENDING -> REJECTED)
router.patch(
  '/:id/reject',
  authenticate,
  authorize('ADMIN'),
  validate(rejectionBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await catalogService.updateApprovalStatus(
        req.params.id as string,
        'reject',
        req.body.rejectionReason,
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// Admin image upload
// ============================================================================

// POST /:id/cover — admin only, upload cover image
router.post(
  '/:id/cover',
  authenticate,
  authorize('ADMIN'),
  uploadSingle('cover'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('No file provided');
      }
      const entry = await catalogService.uploadCoverImage(
        req.params.id as string,
        req.file.buffer,
      );
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },
);

export const catalogRoutes: Router = router;
