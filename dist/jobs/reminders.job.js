import cron from 'node-cron';
import Order from '../models/order.model.js';
import { sendNotification } from '../services/notification.service.js';
const TERMINAL = ['COMPLETED', 'RECEIVED'];
const ACTIVE_FOR_DEADLINE = [
    'PENDING',
    'ACCEPTED',
    'IN_PROGRESS',
    'QUALITY_CHECK',
    'REVISION_REQUESTED',
];
const IDLE_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'QUALITY_CHECK', 'REVISION_REQUESTED'];
const MS_DAY = 86400000;
function addHours(d, h) {
    return new Date(d.getTime() + h * 3600000);
}
async function run24hReminders() {
    const now = new Date();
    const windowStart = addHours(now, 24 - 0.25);
    const windowEnd = addHours(now, 24 + 0.25);
    const orders = await Order.find({
        expectedDeliveryDate: { $gte: windowStart, $lte: windowEnd },
        status: { $in: ACTIVE_FOR_DEADLINE },
        reminder24hSentAt: { $exists: false },
    });
    for (const order of orders) {
        const staffId = order.createdBy.toString();
        const karigarId = order.assignedTo.toString();
        const msg = `Order ${order.orderCode}: delivery in ~24h`;
        await sendNotification(karigarId, 'Deadline reminder', msg, {
            orderId: order._id.toString(),
            type: 'DEADLINE_24H',
        });
        await sendNotification(staffId, 'Deadline reminder', msg, {
            orderId: order._id.toString(),
            type: 'DEADLINE_24H',
        });
        order.reminder24hSentAt = new Date();
        await order.save();
    }
}
async function runOverdueAlerts() {
    const now = new Date();
    const orders = await Order.find({
        expectedDeliveryDate: { $lt: now },
        status: { $in: ACTIVE_FOR_DEADLINE },
        overdueNotifiedAt: { $exists: false },
    });
    for (const order of orders) {
        const staffId = order.createdBy.toString();
        const karigarId = order.assignedTo.toString();
        const msg = `Order ${order.orderCode} is past expected delivery`;
        await sendNotification(karigarId, 'Order overdue', msg, {
            orderId: order._id.toString(),
            type: 'ORDER_OVERDUE',
        });
        await sendNotification(staffId, 'Order overdue', msg, {
            orderId: order._id.toString(),
            type: 'ORDER_OVERDUE',
        });
        order.overdueNotifiedAt = new Date();
        await order.save();
    }
}
async function runIdleFlags() {
    const cutoff = new Date(Date.now() - 3 * MS_DAY);
    const orders = await Order.find({
        status: { $in: IDLE_STATUSES },
        updatedAt: { $lt: cutoff },
        idle3DayNotifiedAt: { $exists: false },
    });
    for (const order of orders) {
        const staffId = order.createdBy.toString();
        const karigarId = order.assignedTo.toString();
        const msg = `Order ${order.orderCode} has had no updates for 3+ days`;
        await sendNotification(karigarId, 'Order idle', msg, {
            orderId: order._id.toString(),
            type: 'ORDER_IDLE_3D',
        });
        await sendNotification(staffId, 'Order idle', msg, {
            orderId: order._id.toString(),
            type: 'ORDER_IDLE_3D',
        });
        order.idle3DayNotifiedAt = new Date();
        await order.save();
    }
}
export function startScheduledJobs() {
    cron.schedule('*/15 * * * *', () => {
        void run24hReminders().catch((e) => console.error('[cron] 24h reminder', e));
    });
    cron.schedule('0 * * * *', () => {
        void runOverdueAlerts().catch((e) => console.error('[cron] overdue', e));
        void runIdleFlags().catch((e) => console.error('[cron] idle', e));
    });
}
//# sourceMappingURL=reminders.job.js.map