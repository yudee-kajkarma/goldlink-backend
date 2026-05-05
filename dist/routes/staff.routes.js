import express from 'express';
import * as staffController from '../controllers/staff.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { upload, validateMedia } from '../middlewares/multer.js';
const router = express.Router();
router.use(protect);
router.use(authorize('STAFF'));
router.post('/orders', upload.array('images', 5), validateMedia, staffController.createOrder);
router.get('/orders', staffController.getMyOrders);
router.get('/orders/:id', staffController.getOrderById);
router.patch('/orders/:id', staffController.updateOrder);
router.patch('/orders/:id/status', staffController.updateOrderStatus);
router.post('/orders/:id/payments', staffController.addPayment);
router.post('/orders/:id/materials', staffController.addIssuedMaterial);
router.patch('/orders/:id/materials', staffController.updateReturnedMaterial);
router.post('/sync-drafts', staffController.syncDrafts);
export default router;
//# sourceMappingURL=staff.routes.js.map