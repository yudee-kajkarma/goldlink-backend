import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
const router = express.Router();
router.use(protect);
router.use(authorize('ADMIN'));
// User Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/approve', adminController.approveUser);
router.patch('/users/:id/deactivate', adminController.deactivateUser);
router.patch('/users/:id/reset-password', adminController.resetPassword);
// Order Management
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.patch('/orders/:id/reassign', adminController.reassignOrder);
// Analytics
router.get('/analytics/overview', adminController.getOverview);
router.get('/analytics/orders-by-karigar', adminController.getOrdersByKarigar);
router.get('/analytics/monthly-trend', adminController.getMonthlyTrend);
router.get('/analytics/overdue', adminController.getOverdue);
// Export
router.get('/export/orders', adminController.exportOrders);
// Chats and Calls (MF4, MF5)
router.get('/chats', adminController.getAllChats);
router.get('/chats/:orderId', adminController.getOrderChats);
router.patch('/chats/:id/flag', adminController.flagChat);
router.patch('/calls/:id/flag', adminController.flagCall);
export default router;
//# sourceMappingURL=admin.routes.js.map