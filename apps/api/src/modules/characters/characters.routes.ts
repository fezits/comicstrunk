import { Router } from 'express';
import { createCharacterSchema, updateCharacterSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { cachePublic } from '../../shared/middleware/cache-control';
import * as charactersService from './characters.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// GET / — public, list characters with pagination
router.get('/', cachePublic(300), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await charactersService.listCharacters(page, limit, search);
    sendPaginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id — public, get character by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const character = await charactersService.getCharacterById(req.params.id as string);
    sendSuccess(res, character);
  } catch (err) {
    next(err);
  }
});

// POST / — admin only, create character
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCharacterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const character = await charactersService.createCharacter(req.body);
      sendSuccess(res, character, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — admin only, update character
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCharacterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const character = await charactersService.updateCharacter(
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, character);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — admin only, delete character
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await charactersService.deleteCharacter(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

export const charactersRoutes: Router = router;
