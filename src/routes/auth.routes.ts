import express from 'express';
import { register, login, logout, getMe, registerFcmToken, updateLanguage } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { registerSchema, loginSchema, fcmTokenSchema, updateLanguageSchema } from '../validators/schemas.js';

const router = express.Router();

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/language', protect, validateBody(updateLanguageSchema), updateLanguage);
router.patch('/fcm-token', protect, validateBody(fcmTokenSchema), registerFcmToken);

export default router;
