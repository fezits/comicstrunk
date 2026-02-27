import { Router } from 'express';
import { createOrderSchema, updateOrderItemStatusSchema, listOrdersSchema } from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as ordersService from './orders.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// === Static routes BEFORE parameterized routes ===

// GET /buyer — list buyer's orders
router.get(
  '/buyer',
  validate(listOrdersSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await ordersService.listBuyerOrders(req.user!.userId, {
        status,
        page,
        limit,
      });
      sendPaginated(res, result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /seller — list seller's orders
router.get(
  '/seller',
  validate(listOrdersSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: string;
        page: number;
        limit: number;
      };
      const result = await ordersService.listSellerOrders(req.user!.userId, {
        status,
        page,
        limit,
      });
      sendPaginated(res, result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /number/:orderNumber — get order by order number
router.get(
  '/number/:orderNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await ordersService.getOrderByNumber(
        req.user!.userId,
        req.params.orderNumber as string,
      );
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },
);

// === Parameterized routes ===

// POST / — create order from cart
router.post(
  '/',
  validate(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await ordersService.createOrder(
        req.user!.userId,
        req.body.shippingAddressId,
      );
      sendSuccess(res, order, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — get single order by ID
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await ordersService.getOrder(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/cancel — cancel order
router.patch(
  '/:id/cancel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await ordersService.cancelOrder(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /items/:itemId/status — update order item status
router.patch(
  '/items/:itemId/status',
  validate(updateOrderItemStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await ordersService.updateOrderItemStatus(
        req.user!.userId,
        req.params.itemId as string,
        req.body.status,
      );
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  },
);

export const ordersRoutes: Router = router;
