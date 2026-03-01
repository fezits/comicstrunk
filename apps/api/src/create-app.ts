import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
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
import { paymentsRoutes } from './modules/payments/payments.routes';
import { webhookRoutes } from './modules/payments/webhook.routes';
import { subscriptionRoutes } from './modules/subscriptions/subscriptions.routes';
import { stripeWebhookRoutes } from './modules/subscriptions/stripe-webhook.routes';
import { errorHandler } from './shared/middleware/error-handler';
import { UPLOADS_PATH } from './shared/lib/cloudinary';
import { registerCronJobs } from './shared/cron';

export function createApp(): Express {
  const app: Express = express();

  // Security
  app.set('trust proxy', 1); // Trust first proxy (Apache/Passenger)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: process.env.WEB_URL || 'http://localhost:3000',
      credentials: true,
    }),
  );

  // Stripe webhook needs raw body for signature verification — must be BEFORE express.json()
  app.use(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    stripeWebhookRoutes,
  );

  // Parsing
  app.use(express.json());
  app.use(cookieParser());

  // Only use morgan in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Serve uploaded files (covers, etc.)
  app.use('/uploads', express.static(UPLOADS_PATH));

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
  app.use('/api/v1/collection', collectionRoutes);
  app.use('/api/v1/commission', commissionRoutes);
  app.use('/api/v1/marketplace', marketplaceRoutes);
  app.use('/api/v1/cart', cartRoutes);
  app.use('/api/v1/shipping', shippingRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/banking', bankingRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/webhooks/mercadopago', webhookRoutes);
  app.use('/api/v1/subscriptions', subscriptionRoutes);

  // Register cron jobs for background tasks
  registerCronJobs();

  // Error handler (must be registered LAST)
  app.use(errorHandler);

  return app;
}
