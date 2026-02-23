import { type Request, type Response, type NextFunction } from 'express';
import { type UserRole } from '@comicstrunk/contracts';
import { ForbiddenError, UnauthorizedError } from '../utils/api-error';

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
