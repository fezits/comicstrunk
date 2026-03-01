import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';
import { UnauthorizedError } from '../utils/api-error';

// Extend Express Request with user payload
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}

/**
 * Optional authentication — attaches user if valid token present, otherwise continues without user.
 * Useful for public endpoints that enhance responses for authenticated users (e.g., like status).
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
  } catch {
    // Invalid token — continue without user (it's optional)
  }

  next();
}
