import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  coverScanSearchSchema,
  coverScanChooseSchema,
  coverScanRecognizeSchema,
  coverScanImportSchema,
} from '@comicstrunk/contracts';
import type {
  CoverScanSearchInput,
  CoverScanChooseInput,
  CoverScanRecognizeInput,
  CoverScanImportInput,
} from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as coverScanService from './cover-scan.service';
import * as coverRecognizeService from './cover-recognize.service';
import * as coverImportService from './cover-import.service';

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

router.post(
  '/choose',
  authenticate,
  validate(coverScanChooseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanChooseInput;
      await coverScanService.recordChoice(req.user!.userId, input);
      sendSuccess(res, { ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/recognize',
  authenticate,
  validate(coverScanRecognizeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanRecognizeInput;
      const result = await coverRecognizeService.recognizeFromImage(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/import',
  authenticate,
  validate(coverScanImportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanImportInput;
      const result = await coverImportService.importExternalCandidate(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const coverScanRoutes: Router = router;
