import { Router } from 'express';
import { addToCartSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess } from '../../shared/utils/response';
import * as cartService from './cart.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// === Static routes BEFORE parameterized routes ===

// GET /summary — cart summary (item count + total amount)
router.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await cartService.getCartSummary(req.user!.userId);
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — list active cart items
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await cartService.getCart(req.user!.userId);
      sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  },
);

// POST / — add item to cart
router.post(
  '/',
  validate(addToCartSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartItem = await cartService.addToCart(
        req.user!.userId,
        req.body.collectionItemId,
      );
      sendSuccess(res, cartItem, 201);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE / — clear entire cart
router.delete(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await cartService.clearCart(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// === Parameterized routes ===

// DELETE /:id — remove single item from cart
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cartService.removeFromCart(req.user!.userId, req.params.id as string);
      sendSuccess(res, { removed: true });
    } catch (err) {
      next(err);
    }
  },
);

export const cartRoutes: Router = router;
