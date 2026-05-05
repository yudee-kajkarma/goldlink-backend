import { Order } from '../models/order.model.js';
import { Message } from '../models/message.model.js';
import { sendNotification } from '../services/notification.service.js';
import { getSignedS3Url } from '../services/s3.service.js';
export default function registerChatHandlers(io, socket) {
    const user = socket.user;
    // Helper to validate order access
    const validateOrderAccess = async (orderId) => {
        const order = await Order.findById(orderId);
        if (!order)
            throw new Error(`Order ${orderId} not found`);
        const userId = user._id.toString();
        const createdBy = order.createdBy.toString();
        const assignedTo = order.assignedTo.toString();
        if (userId !== createdBy && userId !== assignedTo && user.role !== 'ADMIN') {
            throw new Error('Unauthorized to access this order chat');
        }
        return order;
    };
    // Join Order Room
    socket.on('join_order', async ({ orderId }, callback) => {
        try {
            await validateOrderAccess(orderId);
            await socket.join(orderId);
            if (typeof callback === 'function')
                callback({ success: true });
        }
        catch (error) {
            socket.emit('error', { message: error.message });
            if (typeof callback === 'function')
                callback({ success: false, error: error.message });
        }
    });
    // Send Message
    socket.on('message:send', async (payload, callback) => {
        try {
            const { orderId, content, messageType = 'text', mediaKey, duration } = payload;
            const order = await validateOrderAccess(orderId);
            const newMessage = await Message.create({
                orderId,
                senderId: user._id,
                messageType,
                content: content || '',
                mediaKey,
                duration,
                isSent: true
            });
            const messageObj = newMessage.toObject();
            if (mediaKey) {
                messageObj.mediaUrl = (await getSignedS3Url(mediaKey)) ?? undefined;
            }
            // Broadcast to room
            io.to(orderId).emit('message:new', messageObj);
            if (typeof callback === 'function')
                callback({ success: true, data: messageObj });
            // Notify recipient
            const recipientId = user._id.toString() === order.createdBy.toString() ? order.assignedTo : order.createdBy;
            await sendNotification(recipientId.toString(), 'New Message', content || `New ${messageType} message`);
        }
        catch (error) {
            socket.emit('error', { message: error.message });
            if (typeof callback === 'function')
                callback({ success: false, error: error.message });
        }
    });
    // Read Receipt
    socket.on('message:read', async ({ messageId }, callback) => {
        try {
            const message = await Message.findById(messageId);
            if (!message)
                return;
            await validateOrderAccess(message.orderId.toString());
            message.isRead = true;
            message.readAt = new Date();
            await message.save();
            io.to(message.orderId.toString()).emit('message:read', { messageId, readAt: message.readAt });
            if (typeof callback === 'function')
                callback({ success: true });
        }
        catch (error) {
            if (typeof callback === 'function')
                callback({ success: false, error: error.message });
        }
    });
}
//# sourceMappingURL=chat.socket.js.map