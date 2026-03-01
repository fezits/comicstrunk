import { Router } from 'express';
import {
  createHomepageSectionSchema,
  updateHomepageSectionSchema,
  reorderSectionsSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess } from '../../shared/utils/response';
import * as homepageService from './homepage.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// ============================================================================
// Public endpoint
// ============================================================================

// GET / — assemble and return full homepage data (no auth required)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await homepageService.getHomepageData();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Admin endpoints
// ============================================================================

// GET /admin/sections — list all sections (including hidden)
router.get(
  '/admin/sections',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sections = await homepageService.listSections();
      sendSuccess(res, sections);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/sections — create a new section
router.post(
  '/admin/sections',
  authenticate,
  authorize('ADMIN'),
  validate(createHomepageSectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await homepageService.createSection(req.body);
      sendSuccess(res, section, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/sections/reorder — bulk reorder sections (MUST be before :id)
router.post(
  '/admin/sections/reorder',
  authenticate,
  authorize('ADMIN'),
  validate(reorderSectionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sections = await homepageService.reorderSections(req.body.orderedIds);
      sendSuccess(res, sections);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/sections/:id — update a section
router.put(
  '/admin/sections/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateHomepageSectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await homepageService.updateSection(req.params.id as string, req.body);
      sendSuccess(res, section);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/sections/:id — delete a section
router.delete(
  '/admin/sections/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await homepageService.deleteSection(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

export const homepageRoutes: Router = router;
