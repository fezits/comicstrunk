import { Router } from 'express';
import { syncCatalogSchema, syncCoverSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess } from '../../shared/utils/response';
import * as syncService from './sync.service';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All sync routes require admin auth
router.use(authenticate);
router.use(authorize('ADMIN'));

// POST /catalog — upsert catalog entries in batch
router.post(
  '/catalog',
  validate(syncCatalogSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await syncService.syncCatalogItems(req.body.items);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /covers — upload a cover image linked to a sourceKey
router.post(
  '/covers',
  upload.single('cover'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceKey } = syncCoverSchema.parse(req.body);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No cover file provided' },
        });
      }

      const result = await syncService.syncCover(
        sourceKey,
        req.file.buffer,
        req.file.originalname,
      );

      if (result.status === 'entry_not_found') {
        return res.status(404).json({
          success: false,
          error: { message: `No catalog entry found for sourceKey: ${sourceKey}` },
        });
      }

      sendSuccess(res, result, result.status === 'created' ? 201 : 200);
    } catch (err) {
      next(err);
    }
  },
);

// GET /status — catalog sync status
router.get(
  '/status',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await syncService.getSyncStatus();
      sendSuccess(res, status);
    } catch (err) {
      next(err);
    }
  },
);

export const syncRoutes: Router = router;
