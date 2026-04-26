import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import staffRoutes from './routes/staff.routes.js';
import karigarRoutes from './routes/karigar.routes.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || '3000';
const MONGO_URI = process.env.MONGO_URI as string;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/karigar', karigarRoutes);

httpServer.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});