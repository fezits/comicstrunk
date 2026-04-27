import { Router, type Request, type Response, type NextFunction } from 'express';
import { coverScanSearchSchema } from '@comicstrunk/contracts';
import type { CoverScanSearchInput } from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as coverScanService from './cover-scan.service';

const router = Router();

router.post(
  '/search',
  authenticate,
  validate(coverScanSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanSearchInput;
      const result = await coverScanService.searchByText(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const coverScanRoutes = router;
