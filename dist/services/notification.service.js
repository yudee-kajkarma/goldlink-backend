import { User } from '../models/user.model.js';
// Initialize Firebase Admin (requires service account)
// admin.initializeApp({ ... });
export const sendNotification = async (userId, title, body, data) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken)
        return;
    const message = {
        notification: { title, body },
        data: data || {},
        token: user.fcmToken,
    };
    try {
        // await admin.messaging().send(message);
        console.log(`Notification sent to ${userId}: ${title}`);
    }
    catch (error) {
        console.error('Error sending notification:', error);
    }
};
export const notifyOrderUpdate = async (orderId, userId, status) => {
    await sendNotification(userId, 'Order Status Updated', `Order ${orderId} is now ${status}`, { orderId, type: 'order_status' });
};
export const notifyNewMessage = async (orderId, recipientId, senderName) => {
    await sendNotification(recipientId, 'New Message', `${senderName} sent a message in order ${orderId}`, { orderId, type: 'chat' });
};
//# sourceMappingURL=notification.service.js.map