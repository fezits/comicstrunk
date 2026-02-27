import { type Request, type Response, type NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../utils/api-error';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      // Use instanceof check or duck-type for ZodError (handles module deduplication edge cases)
      if (error instanceof ZodError || (error as unknown as Record<string, unknown>)?.constructor?.name === 'ZodError') {
        const zodErr = error as ZodError;
        const details = zodErr.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const err = new BadRequestError('Validation failed', details);
        return next(err);
      }
      next(error);
    }
  };
}
