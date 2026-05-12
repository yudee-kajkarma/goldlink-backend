import express from 'express';
import {
  getUsers,
  getUserById,
  approveUser,
  deactivateUser,
  adminCreateUser,
  getOrders,
  getOrderById,
  reassignOrder,
  exportOrders,
  getOrderAnalytics,
  getAdminAnalytics,
} from '../controllers/admin.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { adminCreateUserSchema, reassignOrderSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.post('/users', validateBody(adminCreateUserSchema), adminCreateUser);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/deactivate', deactivateUser);

router.get('/analytics', getAdminAnalytics);
router.get('/analytics/orders', getOrderAnalytics);

router.get('/orders', getOrders);
router.get('/orders/export', exportOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/reassign', validateBody(reassignOrderSchema), reassignOrder);

export default router;
