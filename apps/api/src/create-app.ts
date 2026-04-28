import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { CONTRACT_VERSION } from '@comicstrunk/contracts';
import { prisma } from './shared/lib/prisma';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { seriesRoutes } from './modules/series/series.routes';
import { categoriesRoutes } from './modules/categories/categories.routes';
import { tagsRoutes } from './modules/tags/tags.routes';
import { charactersRoutes } from './modules/characters/characters.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { collectionRoutes } from './modules/collection/collection.routes';
import { commissionRoutes } from './modules/commission/commission.routes';
import { marketplaceRoutes } from './modules/marketplace/marketplace.routes';
import { cartRoutes } from './modules/cart/cart.routes';
import { shippingRoutes } from './modules/shipping/shipping.routes';
import { ordersRoutes } from './modules/orders/orders.routes';
import { bankingRoutes } from './modules/banking/banking.routes';
import { payoutsRoutes } from './modules/payouts/payouts.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { webhookRoutes } from './modules/payments/webhook.routes';
import { subscriptionRoutes } from './modules/subscriptions/subscriptions.routes';
import { stripeWebhookRoutes } from './modules/subscriptions/stripe-webhook.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { commentsRoutes } from './modules/comments/comments.routes';
import { favoritesRoutes } from './modules/favorites/favorites.routes';
import { reviewsRoutes } from './modules/reviews/reviews.routes';
import { disputesRoutes } from './modules/disputes/disputes.routes';
import { dealsRoutes } from './modules/deals/deals.routes';
import { homepageRoutes } from './modules/homepage/homepage.routes';
import { contactRoutes } from './modules/contact/contact.routes';
import { legalRoutes } from './modules/legal/legal.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { coverSubmissionsUserRoutes, coverSubmissionsAdminRoutes } from './modules/cover-submissions/cover-submissions.routes';
import { coverScanRoutes } from './modules/cover-scan/cover-scan.routes';
import { lgpdRoutes } from './modules/lgpd/lgpd.routes';
// sync module unified into catalog — see /catalog/import-json, /catalog/stats, /catalog/by-source-key/:sk/cover
import { errorHandler } from './shared/middleware/error-handler';
import { UPLOADS_PATH } from './shared/lib/cloudinary';
import { registerCronJobs } from './shared/cron';

export function createApp(): Express {
  const app: Express = express();

  // Security
  app.set('trust proxy', 1); // Trust first proxy (Apache/Passenger)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  const allowedOrigins = (process.env.WEB_URL || 'http://localhost:3000').split(',').map(s => s.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, health checks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Bloqueado por CORS'));
      },
      credentials: true,
    }),
  );

  // Stripe webhook needs raw body for signature verification — must be BEFORE express.json()
  app.use(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    stripeWebhookRoutes,
  );

  // Increased JSON limit for bulk import endpoint — must be before general parser
  app.use('/api/v1/catalog/import-json', express.json({ limit: '50mb' }));

  // Cover scan endpoints recebem imagem em base64. Tipico apos compressao
  // (800px JPEG q=80) eh ~150-400 KB, mas usuarios em iOS as vezes mandam
  // a foto inteira sem compressao (HEIC/Live Photo edge cases). 10mb cobre
  // ate fotos de 7-8 MP cruas; payload ainda passa pelo schema (1.4 MB max).
  app.use('/api/v1/cover-scan/recognize', express.json({ limit: '10mb' }));
  app.use('/api/v1/cover-scan/import', express.json({ limit: '10mb' }));
  app.use('/api/v1/cover-scan/confirm', express.json({ limit: '10mb' }));

  // === Anti-Scraping: Block suspicious API access ===
  // Real browsers send Origin/Referer. Scripts (curl, python, etc.) usually don't.
  // We allow: authenticated requests, webhooks, auth endpoints, and requests with valid browser context.
  const SUSPICIOUS_UA = /^(curl|python|wget|httpie|postman|insomnia|axios|node-fetch|got|undici)/i;
  const BOT_UA = /bot|crawler|spider|scraper|headless/i;

  app.use('/api/v1', (req, res, next) => {
    const path = req.path;
    // Skip protection for auth, webhooks, health, and mutations
    if (path.startsWith('/auth') || path.startsWith('/webhooks') || path === '/homepage' || req.method !== 'GET') {
      return next();
    }
    // Authenticated users are fine
    if (req.headers.authorization) {
      return next();
    }
    // Internal SSR requests from our Next.js server
    if (req.headers['x-internal-key'] === (process.env.INTERNAL_API_KEY || 'comicstrunk-ssr-2026')) {
      return next();
    }
    // Check if request comes from our site (browser or SSR)
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const isFromSite = allowedOrigins.some(o => origin.includes(o) || referer.includes(o));
    if (isFromSite) {
      return next(); // Valid Referer/Origin — allow regardless of User-Agent
    }
    // Block known scraping tools (no valid Referer)
    const ua = req.headers['user-agent'] || '';
    if (SUSPICIOUS_UA.test(ua) || BOT_UA.test(ua) || !ua) {
      res.status(403).json({
        success: false,
        error: { message: 'Acesso direto à API não permitido.', code: 'FORBIDDEN' },
      });
      return;
    }
    // Allow other requests (could be SSR, CDN, or browser without Referer)
    next();
  });

  // === Rate Limiting ===
  // Global: 500 requests per minute per IP (generous for normal browsing)
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Muitas requisições. Tente novamente em 1 minuto.', code: 'RATE_LIMIT' } },
    // Default keyGenerator uses req.ip which handles IPv4/IPv6 correctly
  });
  app.use('/api/', globalLimiter);

  // Catalog: 200 requests per minute (enough for heavy browsing, blocks mass scraping)
  const catalogLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Limite de consultas atingido. Tente novamente em 1 minuto.', code: 'RATE_LIMIT' } },
  });
  app.use('/api/v1/catalog', catalogLimiter);
  app.use('/api/v1/series', catalogLimiter);

  // === Honeypot: trap for bots ===
  // Hidden endpoint that only bots/crawlers find. Real users never hit it.
  // If accessed, the IP gets flagged.
  const honeypotIPs = new Set<string>();
  app.get('/api/v1/admin/export-all', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    honeypotIPs.add(ip);
    console.warn(`[HONEYPOT] Bot detected from IP: ${ip} — ${req.headers['user-agent']}`);
    // Return fake data to waste their time
    res.json({ success: true, data: [], message: 'Processing... please wait' });
  });
  app.get('/api/v1/database/dump', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    honeypotIPs.add(ip);
    console.warn(`[HONEYPOT] Bot detected from IP: ${ip} — ${req.headers['user-agent']}`);
    res.json({ success: true, data: [], message: 'Processing... please wait' });
  });
  // Block honeypot IPs from all future requests
  app.use('/api/', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (honeypotIPs.has(ip)) {
      res.status(429).json({ success: false, error: { message: 'Acesso bloqueado.', code: 'BLOCKED' } });
      return;
    }
    next();
  });

  // Parsing
  app.use(express.json());
  app.use(cookieParser());

  // Only use morgan in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Serve uploaded files (covers, etc.)
  app.use('/uploads', express.static(UPLOADS_PATH));

  // === Sitemap for Google (split into 50k chunks) ===
  const SITE_URL = 'https://comicstrunk.com';
  const API_HOST = 'https://api.comicstrunk.com';
  const SITEMAP_LIMIT = 49000; // Under 50k limit

  // Sitemap index
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const totalEntries = await prisma.catalogEntry.count({ where: { approvalStatus: 'APPROVED' } });
      const totalSeries = await prisma.series.count();
      const total = totalEntries + totalSeries;
      const numSitemaps = Math.ceil(total / SITEMAP_LIMIT);

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (let i = 0; i < numSitemaps; i++) {
        xml += `<sitemap><loc>${API_HOST}/sitemap-${i}.xml</loc></sitemap>\n`;
      }
      xml += '</sitemapindex>';

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(xml);
    } catch {
      res.status(500).send('Error generating sitemap index');
    }
  });

  // Individual sitemaps
  app.get('/sitemap-:id.xml', async (req, res) => {
    try {
      const sitemapId = parseInt(req.params.id);
      const skip = sitemapId * SITEMAP_LIMIT;

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // First sitemap includes static pages
      if (sitemapId === 0) {
        for (const p of ['', '/catalog', '/marketplace', '/deals', '/contact']) {
          xml += `<url><loc>${SITE_URL}/pt-BR${p}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
        }
      }

      // Catalog entries
      const totalEntries = await prisma.catalogEntry.count({ where: { approvalStatus: 'APPROVED' } });

      if (skip < totalEntries) {
        const entries = await prisma.catalogEntry.findMany({
          where: { approvalStatus: 'APPROVED' },
          select: { slug: true, id: true },
          orderBy: { title: 'asc' },
          skip,
          take: SITEMAP_LIMIT,
        });
        for (const e of entries) {
          xml += `<url><loc>${SITE_URL}/pt-BR/catalog/${e.slug || e.id}</loc></url>\n`;
        }
      } else {
        // This sitemap is for series
        const seriesSkip = skip - totalEntries;
        const series = await prisma.series.findMany({
          select: { slug: true, id: true },
          skip: seriesSkip,
          take: SITEMAP_LIMIT,
        });
        for (const s of series) {
          xml += `<url><loc>${SITE_URL}/pt-BR/series/${s.slug || s.id}</loc></url>\n`;
        }
      }

      xml += '</urlset>';

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(xml);
    } catch {
      res.status(500).send('Error generating sitemap');
    }
  });

  // Health check (outside /api/v1 prefix for simple uptime monitoring)
  app.get('/health', async (_req, res) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const payload = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      contractVersion: CONTRACT_VERSION,
      database: dbStatus,
    };

    const statusCode = dbStatus === 'ok' ? 200 : 503;
    res.status(statusCode).json(payload);
  });

  // API v1 routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/series', seriesRoutes);
  app.use('/api/v1/categories', categoriesRoutes);
  app.use('/api/v1/tags', tagsRoutes);
  app.use('/api/v1/characters', charactersRoutes);
  app.use('/api/v1/catalog', catalogRoutes);
  app.use('/api/v1/cover-scan', coverScanRoutes);
  app.use('/api/v1/collection', collectionRoutes);
  app.use('/api/v1/commission', commissionRoutes);
  app.use('/api/v1/marketplace', marketplaceRoutes);
  app.use('/api/v1/cart', cartRoutes);
  app.use('/api/v1/shipping', shippingRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/banking', bankingRoutes);
  app.use('/api/v1/payouts', payoutsRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/webhooks/mercadopago', webhookRoutes);
  app.use('/api/v1/subscriptions', subscriptionRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/comments', commentsRoutes);
  app.use('/api/v1/favorites', favoritesRoutes);
  app.use('/api/v1/reviews', reviewsRoutes);
  app.use('/api/v1/disputes', disputesRoutes);
  app.use('/api/v1/deals', dealsRoutes);
  app.use('/api/v1/homepage', homepageRoutes);
  app.use('/api/v1/contact', contactRoutes);
  app.use('/api/v1/legal', legalRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/admin', coverSubmissionsAdminRoutes);
  app.use('/api/v1', coverSubmissionsUserRoutes);
  app.use('/api/v1/lgpd', lgpdRoutes);
  // sync routes removed — unified into /catalog

  // Register cron jobs for background tasks
  registerCronJobs();

  // Error handler (must be registered LAST)
  app.use(errorHandler);

  return app;
}
