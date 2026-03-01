import { Router } from 'express';
import {
  createShippingAddressSchema,
  updateShippingAddressSchema,
  createShippingMethodSchema,
  updateShippingMethodSchema,
  updateTrackingSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess } from '../../shared/utils/response';
import * as shippingService from './shipping.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// =============================================================================
// ADDRESS ROUTES (all authenticated)
// =============================================================================

// POST /addresses — create a new shipping address
router.post(
  '/addresses',
  authenticate,
  validate(createShippingAddressSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await shippingService.createAddress(req.user!.userId, req.body);
      sendSuccess(res, address, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /addresses — list user's addresses
router.get(
  '/addresses',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const addresses = await shippingService.listAddresses(req.user!.userId);
      sendSuccess(res, addresses);
    } catch (err) {
      next(err);
    }
  },
);

// GET /addresses/:id — get single address
router.get(
  '/addresses/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await shippingService.getAddress(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, address);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /addresses/:id — update address
router.put(
  '/addresses/:id',
  authenticate,
  validate(updateShippingAddressSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await shippingService.updateAddress(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, address);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /addresses/:id — delete address
router.delete(
  '/addresses/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await shippingService.deleteAddress(req.user!.userId, req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /addresses/:id/default — set address as default
router.patch(
  '/addresses/:id/default',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await shippingService.setDefaultAddress(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, address);
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// SHIPPING METHOD ROUTES
// =============================================================================

// Static routes BEFORE parameterized routes

// GET /methods — public, list active shipping methods
router.get(
  '/methods',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const methods = await shippingService.listActiveShippingMethods();
      sendSuccess(res, methods);
    } catch (err) {
      next(err);
    }
  },
);

// GET /methods/all — admin only, list all methods (including inactive)
router.get(
  '/methods/all',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const methods = await shippingService.listShippingMethods();
      sendSuccess(res, methods);
    } catch (err) {
      next(err);
    }
  },
);

// POST /methods — admin only, create shipping method
router.post(
  '/methods',
  authenticate,
  authorize('ADMIN'),
  validate(createShippingMethodSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = await shippingService.createShippingMethod(req.body);
      sendSuccess(res, method, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /methods/:id — admin only, update shipping method
router.put(
  '/methods/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateShippingMethodSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = await shippingService.updateShippingMethod(
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, method);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /methods/:id — admin only, delete shipping method
router.delete(
  '/methods/:id',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await shippingService.deleteShippingMethod(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// TRACKING ROUTE (SHIP-04)
// =============================================================================

// PATCH /tracking/:orderItemId — authenticated seller updates tracking
router.patch(
  '/tracking/:orderItemId',
  authenticate,
  validate(updateTrackingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await shippingService.updateTracking(
        req.user!.userId,
        req.params.orderItemId as string,
        req.body,
      );
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

export const shippingRoutes: Router = router;
