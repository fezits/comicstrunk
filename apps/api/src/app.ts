import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import http from 'http';
import { CONTRACT_VERSION } from '@comicstrunk/contracts';
import { prisma } from './shared/lib/prisma';

const app: Express = express();

// Security
app.set('trust proxy', 1); // Trust first proxy (Apache/Passenger)
app.use(helmet());
app.use(
  cors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  }),
);

// Parsing
app.use(express.json());
app.use(cookieParser());
app.use(morgan('combined'));

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

// API v1 routes (will be registered by feature modules in future plans)
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', usersRoutes);

// Start server - Passenger will capture this listen() call in production
const port = process.env.PORT || 3001;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

export default app;
