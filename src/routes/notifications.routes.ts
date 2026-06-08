import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
  registerPushToken,
  unreadCount,
  unregisterPushToken,
} from '../controllers/notifications.controller.js';
import { registerPushTokenSchema } from '../validators/schemas.js';

const router = express.Router();

router.get('/', protect, listNotifications);
router.get('/unread-count', protect, unreadCount);
router.patch('/read-all', protect, markAllRead);
router.patch('/:id/read', protect, markRead);
router.post('/register-token', protect, validateBody(registerPushTokenSchema), registerPushToken);
router.delete('/register-token', protect, validateBody(registerPushTokenSchema), unregisterPushToken);
router.delete('/:id', protect, deleteNotification);

export default router;
