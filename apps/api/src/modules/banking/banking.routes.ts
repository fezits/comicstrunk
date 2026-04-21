import { Router } from 'express';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  adminBankAccountListSchema,
} from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as bankingService from './banking.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// STATIC ROUTES FIRST (before parameterized /:id routes)
// =============================================================================

// GET /admin/list — admin only, list all sellers' bank accounts (paginated)
router.get(
  '/admin/list',
  authorize('ADMIN'),
  validate(adminBankAccountListSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accounts, total, page, limit } = await bankingService.adminListBankAccounts(
        req.query as unknown as { page: number; limit: number; userId?: string },
      );
      sendPaginated(res, accounts, { page, limit, total });
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// SELLER BANK ACCOUNT CRUD
// =============================================================================

// POST / — create a new bank account
router.post(
  '/',
  validate(createBankAccountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await bankingService.createBankAccount(req.user!.userId, req.body);
      sendSuccess(res, account, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — list my bank accounts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await bankingService.listUserBankAccounts(req.user!.userId);
    sendSuccess(res, accounts);
  } catch (err) {
    next(err);
  }
});

// GET /:id — get single bank account
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await bankingService.getBankAccount(
      req.user!.userId,
      req.params.id as string,
    );
    sendSuccess(res, account);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update bank account
router.put(
  '/:id',
  validate(updateBankAccountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await bankingService.updateBankAccount(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      sendSuccess(res, account);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — delete bank account
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await bankingService.deleteBankAccount(req.user!.userId, req.params.id as string);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/primary — set bank account as primary
router.patch('/:id/primary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await bankingService.setPrimaryBankAccount(
      req.user!.userId,
      req.params.id as string,
    );
    sendSuccess(res, account);
  } catch (err) {
    next(err);
  }
});

export const bankingRoutes: Router = router;
