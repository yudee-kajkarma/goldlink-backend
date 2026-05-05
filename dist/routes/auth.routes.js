import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
const router = express.Router();
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.patch('/language', protect, authController.updateLanguage);
router.post('/fcm-token', protect, authController.updateFCMToken);
router.patch('/pin', protect, authController.updatePIN);
export default router;
//# sourceMappingURL=auth.routes.js.map