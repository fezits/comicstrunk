import { type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { logger } from '../lib/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ApiError — use its status and message
  if (err instanceof ApiError) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        message: err.message,
      },
    };

    // Attach validation details if present
    if ('details' in err) {
      (response.error as Record<string, unknown>).details = (err as ApiError & { details: unknown }).details;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Prisma known request error — unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      res.status(409).json({
        success: false,
        error: {
          message: `A record with this ${target.join(', ')} already exists`,
          code: 'UNIQUE_CONSTRAINT',
        },
      });
      return;
    }
  }

  // Zod validation error (duck-type check handles module deduplication edge cases)
  if (err instanceof ZodError || (err as unknown as Record<string, unknown>)?.constructor?.name === 'ZodError') {
    const details = (err as ZodError).errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // body-parser PayloadTooLargeError (413) — surface as user-friendly message
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        message: 'Imagem muito grande. Tente uma foto menor (até ~8 MB).',
        code: 'PAYLOAD_TOO_LARGE',
      },
    });
    return;
  }

  // Unexpected error — log and return generic message
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    },
  });
}
