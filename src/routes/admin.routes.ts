import express from 'express';
import {
  getUsers,
  getUserById,
  approveUser,
  deactivateUser,
  reactivateUser,
  adminCreateUser,
  getOrders,
  getOrderById,
  reassignOrder,
  exportOrders,
  getOrderAnalytics,
  getAdminAnalytics,
} from '../controllers/admin.controller.js';
import { createOrder } from '../controllers/staff.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  adminCreateUserSchema,
  createOrderBodySchema,
  reassignOrderSchema,
} from '../validators/schemas.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.post('/users', validateBody(adminCreateUserSchema), adminCreateUser);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/deactivate', deactivateUser);
router.patch('/users/:id/reactivate', reactivateUser);

router.get('/analytics', getAdminAnalytics);
router.get('/analytics/orders', getOrderAnalytics);

// Order creation reuses the staff controller — it is role-agnostic
// (createdBy comes from the authenticated user).
router.post(
  '/orders',
  uploadMiddleware.array('images', 5),
  validateMediaSize,
  validateBody(createOrderBodySchema),
  createOrder
);
router.get('/orders', getOrders);
router.get('/orders/export', exportOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/reassign', validateBody(reassignOrderSchema), reassignOrder);

export default router;
