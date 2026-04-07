import { Router } from 'express';
import { createCategorySchema, updateCategorySchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess } from '../../shared/utils/response';
import { cachePublic } from '../../shared/middleware/cache-control';
import * as categoriesService from './categories.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET / — public, list all categories
router.get('/', cachePublic(300), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoriesService.listCategories();
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});

// GET /:id — public, get category by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoriesService.getCategoryById(req.params.id as string);
    sendSuccess(res, category);
  } catch (err) {
    next(err);
  }
});

// POST / — admin only, create category
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoriesService.createCategory(req.body);
      sendSuccess(res, category, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — admin only, update category
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoriesService.updateCategory(req.params.id as string, req.body);
      sendSuccess(res, category);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — admin only, delete category
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await categoriesService.deleteCategory(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

export const categoriesRoutes: Router = router;
