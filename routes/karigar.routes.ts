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
import { validateBody } from '../middlewares/validate.middleware.js';
import { karigarOrderStatusSchema, completeOrderSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(protect);
router.use(authorize('KARIGAR'));

// Order routes
router.get('/orders', getAssignedOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/accept', acceptOrder);
router.patch('/orders/:id/status', validateBody(karigarOrderStatusSchema), updateOrderStatus);
router.post('/orders/:id/upload-completion-media', uploadMiddleware.single('media'), validateMediaSize, uploadCompletionMedia);
router.post('/orders/:id/complete', validateBody(completeOrderSchema), completeOrder);

export default router;
