import Order from '../models/order.model.js';
import { s3Service } from '../services/s3.service.js';
import { canTransitionOrderStatus } from '../services/orderStatusTransitions.service.js';
// Get assigned orders
export const getAssignedOrders = async (req, res) => {
    try {
        const orders = await Order.find({ assignedTo: req.user?._id })
            .populate('createdBy', 'name role')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: orders.length, data: orders });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
// Get order details
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id })
            .populate('createdBy', 'name role')
            .populate('statusLogs.updatedBy', 'name role')
            .populate('materialLogs.loggedBy', 'name role');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: order });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
// Accept order
export const acceptOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (!canTransitionOrderStatus(order.status, 'ACCEPTED')) {
            return res.status(400).json({ success: false, message: 'Order cannot transition to ACCEPTED' });
        }
        order.status = 'ACCEPTED';
        order.statusLogs.push({
            status: 'ACCEPTED',
            updatedBy: req.user._id,
            createdAt: new Date()
        });
        await order.save();
        res.status(200).json({ success: true, message: 'Order accepted', data: order });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
// Update order status
export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const nextStatus = status;
        if (!canTransitionOrderStatus(order.status, nextStatus)) {
            return res.status(400).json({ success: false, message: 'Illegal order status transition' });
        }
        order.status = nextStatus;
        order.statusLogs.push({
            status: nextStatus,
            updatedBy: req.user._id,
            createdAt: new Date()
        });
        await order.save();
        res.status(200).json({ success: true, data: order });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
// Mark complete (upload images)
export const completeOrder = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ success: false, message: 'Request body is missing' });
        }
        const { images, completionNote } = req.body; // Expecting an array of uploaded S3 keys
        // #region agent log
        fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '033cf0' }, body: JSON.stringify({ sessionId: '033cf0', runId: 'pre-fix', hypothesisId: 'H5', location: 'controllers/karigar.controller.ts:108', message: 'karigar completeOrder payload received', data: { hasImages: Array.isArray(images), imagesCount: Array.isArray(images) ? images.length : 0, firstImageType: Array.isArray(images) && images.length > 0 ? typeof images[0] : 'none' }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one completion image is required' });
        }
        const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (!canTransitionOrderStatus(order.status, 'COMPLETED')) {
            return res.status(400).json({ success: false, message: 'Illegal order status transition' });
        }
        order.status = 'COMPLETED';
        // PRD: completion notes must be stored in a dedicated field.
        if (completionNote)
            order.completionNote = completionNote;
        const invalidImageKeys = images.some((key) => typeof key !== 'string' || key.startsWith('http://') || key.startsWith('https://'));
        if (invalidImageKeys) {
            return res.status(400).json({ success: false, message: 'Invalid completion images. Use uploaded media keys only.' });
        }
        // Add completion image keys
        const completionImages = images.map((key) => ({ url: key, type: 'COMPLETION' }));
        order.images.push(...completionImages);
        order.statusLogs.push({
            status: 'COMPLETED',
            updatedBy: req.user._id,
            createdAt: new Date()
        });
        await order.save();
        res.status(200).json({ success: true, message: 'Order marked as completed', data: order });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
export const uploadCompletionMedia = async (req, res) => {
    try {
        const rawId = req.params.id;
        const orderId = typeof rawId === 'string' ? rawId : rawId?.[0];
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: 'No media file provided' });
        }
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order id is required' });
        }
        const order = await Order.findOne({ _id: orderId, assignedTo: req.user?._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const key = await s3Service.uploadFile(file.buffer, file.mimetype, 'orders', orderId, 'completion');
        return res.status(200).json({ success: true, mediaKey: key });
    }
    catch (_error) {
        res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
    }
};
//# sourceMappingURL=karigar.controller.js.map