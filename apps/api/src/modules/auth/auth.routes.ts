import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  signupSchema,
  loginSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { sendSuccess } from '../../shared/utils/response';
import * as authService from './auth.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// === Rate limiters ===

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 200 : 5, // generous in dev for e2e tests, strict in production
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts, please try again later' } },
  skip: () => process.env.NODE_ENV === 'test',
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 50 : 3, // generous in dev for e2e tests, strict in production
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many password reset attempts, please try again later' } },
  skip: () => process.env.NODE_ENV === 'test',
});

// === Refresh cookie config ===

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// === Routes ===

// POST /signup
router.post(
  '/signup',
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.signup(req.body);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: result.accessToken, user: result.user }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /login
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  },
);

// POST /refresh
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const oldRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      if (!oldRefreshToken) {
        res.status(401).json({
          success: false,
          error: { message: 'No refresh token provided' },
        });
        return;
      }
      const result = await authService.refreshTokens(oldRefreshToken);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  },
);

// POST /logout
router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/api/v1/auth/refresh',
      });
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /password-reset/request
router.post(
  '/password-reset/request',
  passwordResetLimiter,
  validate(resetPasswordRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.requestPasswordReset(req.body.email);
      sendSuccess(res, { message: 'If an account with that email exists, a reset link has been sent' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /password-reset/confirm
router.post(
  '/password-reset/confirm',
  validate(resetPasswordConfirmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.confirmPasswordReset(req.body.token, req.body.password);
      sendSuccess(res, { message: 'Password has been reset successfully' });
    } catch (err) {
      next(err);
    }
  },
);

export const authRoutes: Router = router;
