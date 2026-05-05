import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import sanitize from 'mongo-sanitize';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { globalLimiter } from './middlewares/rateLimiter.middleware.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import staffRoutes from './routes/staff.routes.js';
import karigarRoutes from './routes/karigar.routes.js';
import chatRoutes from './routes/chat.routes.js';
import callRoutes from './routes/call.routes.js';
const app = express();
// Security Middlewares
app.use(helmet());
app.use(cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    if (req.body)
        sanitize(req.body);
    if (req.params)
        sanitize(req.params);
    if (req.query)
        sanitize(req.query);
    next();
});
// Trust proxy
app.set('trust proxy', 1);
// Global Rate Limiter
app.use(globalLimiter);
// Health Check
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => res.status(200).send('READY'));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/karigar', karigarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calls', callRoutes);
// Error Handling
app.use(errorHandler);
export { app };
//# sourceMappingURL=app.js.map