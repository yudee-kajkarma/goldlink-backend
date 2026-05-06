import { Message } from '../models/message.model.js';
import Order from '../models/order.model.js';
import { s3Service } from '../services/s3.service.js';
import { io } from '../sockets/index.js';
export const getMessages = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (req.user?.role !== 'ADMIN') {
            const userId = req.user?._id.toString();
            if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
            }
        }
        let messages;
        let nextCursor = null;
        // Cursor-based pagination on _id to avoid skip() shifting under concurrent inserts.
        if (cursor) {
            const docs = await Message.find({ orderId, _id: { $lt: cursor } })
                .sort({ _id: -1 })
                .limit(limit);
            messages = docs;
            const last = docs[docs.length - 1];
            nextCursor = docs.length === limit && last ? last._id.toString() : null;
        }
        else {
            const effectiveCount = page * limit;
            const docs = await Message.find({ orderId })
                .sort({ _id: -1 })
                .limit(effectiveCount);
            const start = (page - 1) * limit;
            messages = docs.slice(start, start + limit);
            const last = messages[messages.length - 1];
            nextCursor = messages.length === limit && last ? last._id.toString() : null;
        }
        return res
            .status(200)
            .json({ success: true, count: messages.length, data: messages, nextCursor });
    }
    catch (error) {
        next(error);
    }
};
export const sendMessage = async (req, res, next) => {
    try {
        const { orderId, content, messageType, mediaUrl, duration } = req.body;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const userId = req.user?._id.toString();
        if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
        }
        const newMessage = await Message.create({
            orderId,
            senderId: req.user?._id,
            messageType: (messageType || 'text'),
            content,
            mediaUrl,
            duration,
        });
        // PRD 3.2.x — When sending via REST, also broadcast over Socket.IO.
        const clients = await io.in(orderId).fetchSockets();
        const recipientId = userId === order.createdBy.toString() ? order.assignedTo.toString() : order.createdBy.toString();
        const recipientOnline = clients.some((s) => {
            const user = s.user;
            const onlineUserId = user?._id?.toString?.();
            return onlineUserId === recipientId;
        });
        if (recipientOnline) {
            newMessage.isDelivered = true;
            newMessage.deliveredAt = new Date();
            await newMessage.save();
        }
        io.to(orderId).emit('receive_message', newMessage);
        if (recipientOnline) {
            io.to(orderId).emit('message_delivered', { messageId: newMessage._id });
        }
        return res.status(201).json({ success: true, data: newMessage });
    }
    catch (error) {
        next(error);
    }
};
export const uploadMedia = async (req, res, next) => {
    try {
        const { orderId } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const userId = req.user?._id.toString();
        if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
        }
        // #region agent log
        fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '033cf0' }, body: JSON.stringify({ sessionId: '033cf0', runId: 'pre-fix', hypothesisId: 'H5', location: 'controllers/chat.controller.ts:73', message: 'chat upload uses local storage service', data: { filename: req.file.filename || null, mimetype: req.file.mimetype, size: req.file.size }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
        const subFolder = req.file.mimetype.startsWith('video/')
            ? 'videos'
            : req.file.mimetype.startsWith('audio/')
                ? 'voice'
                : 'images';
        const mediaKey = await s3Service.uploadFile(req.file.buffer, req.file.mimetype, 'chat', orderId, subFolder);
        return res.status(200).json({
            success: true,
            mediaKey,
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=chat.controller.js.map