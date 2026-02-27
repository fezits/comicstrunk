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

  // Register cron jobs for background tasks
  registerCronJobs();

  // Error handler (must be registered LAST)
  app.use(errorHandler);

  return app;
}
