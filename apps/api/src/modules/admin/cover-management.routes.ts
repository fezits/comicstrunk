import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  adminListMissingCoversSchema,
  adminApplyCoverSchema,
  adminBulkFandomPreviewSchema,
  adminBulkPreviewSchema,
  adminBulkApplySchema,
  adminFandomFromUrlSchema,
  type AdminListMissingCoversInput,
  type AdminApplyCoverInput,
  type AdminBulkFandomPreviewInput,
  type AdminBulkPreviewInput,
  type AdminBulkApplyInput,
  type AdminFandomFromUrlInput,
} from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as service from './cover-management.service';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// IMPORTANTE: rotas com path ESTATICO devem vir ANTES das rotas com :id/...
// senao Express matcheia /bulk/apply contra /:id/apply (com :id="bulk").

// GET /admin/cover-management/missing — paginacao + filtro publisher
router.get(
  '/missing',
  validate(adminListMissingCoversSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.listMissingCovers(
        req.query as unknown as AdminListMissingCoversInput,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/cover-management/publishers — lista publishers com missing covers
router.get(
  '/publishers',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.listMissingCoverPublishers();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/cover-management/series — lista series com missing covers
router.get(
  '/series',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.listSeriesWithMissingCovers();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-management/bulk/fandom-preview — preview match Fandom
// (legacy: a pagina /admin/cover-management/bulk-fandom usa esse endpoint)
router.post(
  '/bulk/fandom-preview',
  validate(adminBulkFandomPreviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminBulkFandomPreviewInput;
      const result = await service.previewBulkFandomCovers(
        input.catalogSeriesId,
        input.fandomSeriesUrl,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-management/bulk/preview — preview generico Fandom OR Image
router.post(
  '/bulk/preview',
  validate(adminBulkPreviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminBulkPreviewInput;
      const result = await service.previewBulkSeriesCovers(
        input.catalogSeriesId,
        input.source,
        input.sourceUrl,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-management/fandom-from-url — resolve URL Fandom
// pra candidate (issue) ou info de serie (pra disparar bulk).
router.post(
  '/fandom-from-url',
  validate(adminFandomFromUrlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminFandomFromUrlInput;
      const result = await service.lookupFandomFromUrl(input.url);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-management/bulk/apply — aplica varias capas em batch
router.post(
  '/bulk/apply',
  validate(adminBulkApplySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminBulkApplyInput;
      const result = await service.bulkApplyCovers(input.items);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// === Rotas com :id devem vir DEPOIS das rotas estaticas ===

// POST /admin/cover-management/:id/search — cascata Amazon -> Rika -> Excelsior
router.post(
  '/:id/search',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.searchCoversForEntry(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/cover-management/:id/apply — baixa imagem (com guards) e aplica
router.post(
  '/:id/apply',
  validate(adminApplyCoverSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.applyCoverToEntry(
        req.params.id as string,
        req.body as AdminApplyCoverInput,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const coverManagementAdminRoutes: Router = router;
