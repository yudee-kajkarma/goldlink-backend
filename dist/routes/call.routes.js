import express from 'express';
import * as callController from '../controllers/call.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
const router = express.Router();
router.post('/initiate', protect, callController.initiateCall);
router.post('/bridge', callController.callBridge); // Twilio Webhook (no protect, should use Twilio signature validation in prod)
router.get('/admin', protect, authorize('ADMIN'), callController.getAdminCalls);
export default router;
//# sourceMappingURL=call.routes.js.map