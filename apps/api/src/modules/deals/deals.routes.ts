import { Router } from 'express';
import {
  createPartnerStoreSchema,
  updatePartnerStoreSchema,
  listPartnerStoresSchema,
  createDealSchema,
  updateDealSchema,
  listDealsSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate, optionalAuthenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { uploadSingle } from '../../shared/middleware/upload';
import { uploadImage } from '../../shared/lib/cloudinary';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as dealsService from './deals.service';
import * as clicksService from './clicks.service';
import * as partnerStoresService from './partner-stores.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// ============================================================================
// IMPORTANT: Admin and static routes MUST be defined BEFORE /:id to prevent
// Express from matching "admin" or "stores" as an id parameter.
// ============================================================================

// === Admin Deal Routes ===

// GET /admin/list — admin: list all deals with pagination
router.get(
  '/admin/list',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await dealsService.listAllDeals({ page, limit });
      sendPaginated(res, result.deals, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin — admin: create a deal
router.post(
  '/admin',
  authenticate,
  authorize('ADMIN'),
  validate(createDealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = await dealsService.createDeal(req.body);
      sendSuccess(res, deal, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/:id — admin: update a deal
router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateDealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = await dealsService.updateDeal(req.params.id as string, req.body);
      sendSuccess(res, deal);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/:id — admin: soft delete a deal
router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = await dealsService.softDeleteDeal(req.params.id as string);
      sendSuccess(res, deal);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/:id/banner — admin: upload deal banner
router.post(
  '/admin/:id/banner',
  authenticate,
  authorize('ADMIN'),
  uploadSingle('banner'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new BadRequestError('Imagem do banner é obrigatória');
      }
      const deal = await dealsService.uploadBanner(req.params.id as string, req.file.buffer);
      sendSuccess(res, deal);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin Click Analytics Routes ===

// GET /admin/analytics — admin: get click analytics
router.get(
  '/admin/analytics',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, storeId } = req.query;
      const analytics = await clicksService.getClickAnalytics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        storeId: storeId as string | undefined,
      });
      sendSuccess(res, analytics);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/analytics/export — admin: export click analytics as CSV
router.get(
  '/admin/analytics/export',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const csv = await clicksService.exportClicksCSV({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=clicks-analytics.csv');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);

// === Admin Partner Store Routes ===

// GET /stores/admin/list — admin: list all partner stores
router.get(
  '/stores/admin/list',
  authenticate,
  authorize('ADMIN'),
  validate(listPartnerStoresSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, isActive } = req.query as unknown as {
        page: number;
        limit: number;
        isActive?: boolean;
      };
      const result = await partnerStoresService.listAll({ page, limit, isActive });
      sendPaginated(res, result.stores, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /stores/admin — admin: create a partner store
router.post(
  '/stores/admin',
  authenticate,
  authorize('ADMIN'),
  validate(createPartnerStoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await partnerStoresService.create(req.body);
      sendSuccess(res, store, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /stores/admin/:id — admin: update a partner store
router.put(
  '/stores/admin/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updatePartnerStoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await partnerStoresService.update(req.params.id as string, req.body);
      sendSuccess(res, store);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /stores/admin/:id — admin: soft delete a partner store
router.delete(
  '/stores/admin/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await partnerStoresService.softDelete(req.params.id as string);
      sendSuccess(res, store);
    } catch (err) {
      next(err);
    }
  },
);

// === Public Partner Store Routes ===

// GET /stores — TEMPORARIAMENTE ADMIN-ONLY (feature "Em Breve" para usuarios comuns)
router.get('/stores', authenticate, authorize('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await partnerStoresService.listActive();
    sendSuccess(res, stores);
  } catch (err) {
    next(err);
  }
});

// === Click Tracking Routes ===

// GET /click/:dealId — public: track click and redirect to affiliate URL
router.get(
  '/click/:dealId',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealId = req.params.dealId as string;
      const userId = req.user?.userId ?? null;
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;
      const userAgent = (req.headers['user-agent'] as string) || null;

      const redirectUrl = await clicksService.trackClick(dealId, userId, ipAddress, userAgent);
      res.redirect(redirectUrl);
    } catch (err) {
      next(err);
    }
  },
);

// === Public Deal Routes (TEMPORARIAMENTE ADMIN-ONLY) ===
// Feature "Ofertas" esta marcada como "Em Breve" para usuarios comuns.
// Endpoints publicos exigem ADMIN ate liberacao geral.

// GET / — TEMPORARIAMENTE ADMIN-ONLY: list active deals
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(listDealsSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as {
        page: number;
        limit: number;
        storeId?: string;
        categoryId?: string;
        type?: 'COUPON' | 'PROMOTION';
        sort?: 'newest' | 'discount' | 'expiring';
      };
      const result = await dealsService.listActiveDeals(filters);
      sendPaginated(res, result.deals, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — TEMPORARIAMENTE ADMIN-ONLY: get a single deal
router.get('/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deal = await dealsService.getDeal(req.params.id as string);
    sendSuccess(res, deal);
  } catch (err) {
    next(err);
  }
});

export const dealsRoutes: Router = router;
