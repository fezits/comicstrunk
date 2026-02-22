import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - api routes
  // - Next.js internals (_next)
  // - Static files (images, fonts, etc.)
  matcher: ['/', '/(pt-BR)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
