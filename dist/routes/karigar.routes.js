import express from 'express';
import * as karigarController from '../controllers/karigar.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { upload, validateMedia } from '../middlewares/multer.js';
const router = express.Router();
router.use(protect);
router.use(authorize('KARIGAR'));
router.get('/orders', karigarController.getAssignedOrders);
router.get('/orders/:id', karigarController.getOrderById);
router.patch('/orders/:id/status', karigarController.updateOrderStatus);
// C7: Karigar Completion Images Upload
router.post('/upload-completion-images', upload.array('images', 5), validateMedia, karigarController.uploadCompletionImages);
export default router;
//# sourceMappingURL=karigar.routes.js.map