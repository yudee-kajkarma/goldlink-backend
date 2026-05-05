import { asyncHandler } from '../utils/asyncHandler.js';
import { Message } from '../models/message.model.js';
import { Order } from '../models/order.model.js';
import { AppError } from '../utils/AppError.js';
import { getSignedS3Url, uploadToS3 } from '../services/s3.service.js';
import { io } from '../sockets/index.js';
export const getMessages = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { beforeId, limit = 50 } = req.query;
    const order = await Order.findById(orderId);
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    // Authorization check
    if (req.user?.role !== 'ADMIN') {
        const userId = req.user?._id.toString();
        if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
            throw new AppError('Unauthorized access to this chat', 403, 'GL_403');
        }
    }
    let query = { orderId };
    if (beforeId) {
        query._id = { $lt: beforeId };
    }
    const messages = await Message.find(query)
        .sort({ _id: -1 }) // Cursor pagination usually uses ID sort
        .limit(Number(limit));
    const messagesWithUrls = await Promise.all(messages.map(async (msg) => {
        const msgObj = msg.toObject();
        if (msg.mediaKey) {
            msgObj.mediaUrl = (await getSignedS3Url(msg.mediaKey)) ?? undefined;
        }
        return msgObj;
    }));
    res.status(200).json({
        success: true,
        count: messages.length,
        data: messagesWithUrls,
        nextCursor: messages.length > 0 ? messages[messages.length - 1]._id : null
    });
});
export const sendMessage = asyncHandler(async (req, res) => {
    const { orderId, content, messageType = 'text', mediaKey, duration } = req.body;
    const order = await Order.findById(orderId);
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    const userId = req.user?._id.toString();
    if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
        throw new AppError('Unauthorized access to this chat', 403, 'GL_403');
    }
    const newMessage = await Message.create({
        orderId,
        senderId: req.user?._id,
        messageType,
        content: content || '',
        mediaKey,
        duration,
        isSent: true
    });
    const msgObj = newMessage.toObject();
    if (mediaKey) {
        msgObj.mediaUrl = (await getSignedS3Url(mediaKey)) ?? undefined;
    }
    // Socket Fix: Emit event for REST API calls
    io.to(orderId).emit('message:new', msgObj);
    res.status(201).json({ success: true, data: msgObj });
});
export const uploadMedia = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!req.file)
        throw new AppError('No file uploaded', 400, 'GL_400');
    // M8: Chat Upload Access - Verify user belongs to order
    const order = await Order.findById(orderId);
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    const userId = req.user?._id.toString();
    if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
        throw new AppError('Unauthorized to upload to this chat', 403, 'GL_403');
    }
    const mediaKey = await uploadToS3(req.file, 'chat');
    const mediaUrl = await getSignedS3Url(mediaKey);
    res.status(200).json({
        success: true,
        data: {
            mediaKey,
            mediaUrl
        }
    });
});
//# sourceMappingURL=chat.controller.js.map