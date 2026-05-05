import cron from 'node-cron';
import { Order } from '../models/order.model.js';
import { sendNotification } from '../services/notification.service.js';
export const initJobs = () => {
    // Every day at 9 AM: Check for overdue orders
    cron.schedule('0 9 * * *', async () => {
        const overdueOrders = await Order.find({
            status: { $nin: ['COMPLETED', 'RECEIVED'] },
            expectedDeliveryDate: { $lt: new Date() }
        });
        for (const order of overdueOrders) {
            await sendNotification(order.assignedTo.toString(), 'Order Overdue!', `Order ${order.orderCode} is past its delivery date.`, { orderId: order._id.toString() });
        }
    });
    // Every 6 hours: Check for orders nearing deadline (24h)
    cron.schedule('0 */6 * * *', async () => {
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 24);
        const nearingOrders = await Order.find({
            status: { $nin: ['COMPLETED', 'RECEIVED'] },
            expectedDeliveryDate: { $lte: tomorrow, $gt: new Date() }
        });
        for (const order of nearingOrders) {
            await sendNotification(order.assignedTo.toString(), 'Deadline Approaching', `Order ${order.orderCode} is due within 24 hours.`, { orderId: order._id.toString() });
        }
    });
    console.log('Cron jobs initialized');
};
//# sourceMappingURL=reminders.job.js.map