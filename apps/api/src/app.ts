import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import http from 'http';
import { CONTRACT_VERSION } from '@comicstrunk/contracts';

const app: Express = express();

// Security
app.set('trust proxy', 1);
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

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    contractVersion: CONTRACT_VERSION,
  });
});

// Start server - Passenger will capture this listen() call in production
const port = process.env.PORT || 3001;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

export default app;
