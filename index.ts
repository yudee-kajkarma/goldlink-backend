import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import helmet from 'helmet';
import { getCorsOrigin } from './config/cors.js';
import { globalLimiter } from './middlewares/rateLimiter.middleware.js';
import { startScheduledJobs } from './jobs/reminders.job.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import staffRoutes from './routes/staff.routes.js';
import karigarRoutes from './routes/karigar.routes.js';
import chatRoutes from './routes/chat.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { initializeSocket, io } from './sockets/index.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

const PORT = process.env.PORT || '3000';
const MONGO_URI = process.env.MONGO_URI as string;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    startScheduledJobs();
  })
  .catch((err) => console.error('Failed to connect to MongoDB', err));

app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.status(200).json({ success: true });
});

app.get('/readyz', (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1; // connected
  if (!mongoReady) {
    return res.status(503).json({ success: false, message: 'Mongo not ready' });
  }
  res.status(200).json({ success: true });
});

// Trust proxy is needed if you are behind a reverse proxy (e.g., Nginx, Heroku, AWS ELB)
app.set('trust proxy', 1);

// Apply global rate limiter to all routes
app.use(globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/karigar', karigarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', uploadRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorCode: 'GL_SRV_001',
  });
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  try {
    // Close Socket.IO first so clients stop receiving events.
    if (io) {
      await io.close();
    }
  } catch (e) {
    // best-effort
  }
  try {
    await mongoose.connection.close();
  } catch (e) {
    // best-effort
  }
  httpServer.close(() => {
    process.exit(0);
  });

  // Hard stop to avoid hanging forever.
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

httpServer.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});