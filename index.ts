import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { globalLimiter } from './middlewares/rateLimiter.middleware.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import staffRoutes from './routes/staff.routes.js';
import karigarRoutes from './routes/karigar.routes.js';
import chatRoutes from './routes/chat.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { initializeSocket } from './sockets/index.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

const PORT = process.env.PORT || '3000';
const MONGO_URI = process.env.MONGO_URI as string;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Serve static uploads
app.use('/uploads', express.static('uploads'));

httpServer.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});