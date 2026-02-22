import { Router } from 'express';
import { createTagSchema, updateTagSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess } from '../../shared/utils/response';
import * as tagsService from './tags.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET / — public, list all tags
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await tagsService.listTags();
    sendSuccess(res, tags);
  } catch (err) {
    next(err);
  }
});

// GET /:id — public, get tag by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tag = await tagsService.getTagById(req.params.id as string);
    sendSuccess(res, tag);
  } catch (err) {
    next(err);
  }
});

// POST / — admin only, create tag
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createTagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tag = await tagsService.createTag(req.body);
      sendSuccess(res, tag, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — admin only, update tag
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateTagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tag = await tagsService.updateTag(req.params.id as string, req.body);
      sendSuccess(res, tag);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — admin only, delete tag
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tagsService.deleteTag(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

export const tagsRoutes: Router = router;
