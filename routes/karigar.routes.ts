import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import {
  getAssignedOrders,
  getOrderById,
  acceptOrder,
  updateOrderStatus,
  completeOrder,
  uploadCompletionMedia
} from '../controllers/karigar.controller.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';

const router = express.Router();

router.use(protect);
router.use(authorize('KARIGAR'));

// Order routes
router.get('/orders', getAssignedOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/accept', acceptOrder);
router.patch('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/upload-completion-media', uploadMiddleware.single('media'), validateMediaSize, uploadCompletionMedia);
router.post('/orders/:id/complete', completeOrder);

export default router;
