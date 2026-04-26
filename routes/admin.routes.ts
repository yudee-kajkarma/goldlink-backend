import express from 'express';
import { getUsers, getUserById, approveUser, deactivateUser } from '../controllers/admin.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Apply auth and admin role check to all routes in this file
router.use(protect);
router.use(authorize('ADMIN'));

router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/deactivate', deactivateUser);

import { getOrders, getOrderById, reassignOrder, exportOrders } from '../controllers/admin.controller.js';

router.get('/orders', getOrders);
router.get('/orders/export', exportOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/reassign', reassignOrder);

export default router;
