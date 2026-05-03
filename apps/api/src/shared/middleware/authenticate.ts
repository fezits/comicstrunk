import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/api-error';
import { prisma } from '../lib/prisma';

// Extend Express Request with user payload
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new UnauthorizedError('Invalid or expired access token'));
  }

  // Check suspension status. Cheap query (PK lookup, indexed bool returned).
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { suspended: true },
  });

  if (!user) {
    return next(new UnauthorizedError('User no longer exists'));
  }

  if (user.suspended) {
    return next(new ForbiddenError('Conta suspensa. Entre em contato com o suporte.'));
  }

  req.user = payload;
  next();
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
