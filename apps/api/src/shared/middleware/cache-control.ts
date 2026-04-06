import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that sets Cache-Control for public read-only endpoints.
 * @param maxAgeSeconds - how long browsers/CDNs may cache the response
 * @param staleWhileRevalidateSeconds - allow serving stale while revalidating (default 1 hour)
 */
export function cachePublic(maxAgeSeconds: number, staleWhileRevalidateSeconds = 3600) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set(
      'Cache-Control',
      `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
    );
    next();
  };
}
