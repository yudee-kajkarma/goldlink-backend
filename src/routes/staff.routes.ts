import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createOrderBodySchema,
  staffOrderStatusSchema,
  // MONEY-DISABLED: addPaymentSchema,
  addIssuedMaterialSchema,
  updateReturnedMaterialSchema,
} from '../validators/schemas.js';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  requestRevision,
  // MONEY-DISABLED: addPayment,
  // MONEY-DISABLED: getPayments,
  addIssuedMaterial,
  updateReturnedMaterial,
  getKarigars,
} from '../controllers/staff.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('STAFF'));

// Karigar lookup (for assignment dropdowns)
router.get('/karigars', getKarigars);

// Order routes
router.post(
  '/orders',
  uploadMiddleware.array('images', 5),
  validateMediaSize,
  validateBody(createOrderBodySchema),
  createOrder
);
router.get('/orders', getMyOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id', updateOrder);
router.patch('/orders/:id/status', validateBody(staffOrderStatusSchema), updateOrderStatus);
router.patch('/orders/:id/revision', requestRevision);

// MONEY-DISABLED: Payment routes
// router.post('/orders/:id/payments', validateBody(addPaymentSchema), addPayment);
// router.get('/orders/:id/payments', getPayments);

// Material routes
router.post('/orders/:id/material', validateBody(addIssuedMaterialSchema), addIssuedMaterial);
router.patch('/orders/:id/material', validateBody(updateReturnedMaterialSchema), updateReturnedMaterial);

export default router;
