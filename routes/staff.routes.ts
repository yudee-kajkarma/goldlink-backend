import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  requestRevision,
  addPayment,
  getPayments,
  addIssuedMaterial,
  updateReturnedMaterial
} from '../controllers/staff.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('STAFF'));

// Order routes
router.post('/orders', createOrder);
router.get('/orders', getMyOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id', updateOrder);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/revision', requestRevision);

// Payment routes
router.post('/orders/:id/payments', addPayment);
router.get('/orders/:id/payments', getPayments);

// Material routes
router.post('/orders/:id/material', addIssuedMaterial);
router.patch('/orders/:id/material', updateReturnedMaterial);

export default router;
