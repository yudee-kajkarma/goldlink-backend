import cron from 'node-cron';
import Order from '../models/order.model.js';
import { dispatchNotifications, listActiveAdminIds } from '../services/notification.service.js';

const ACTIVE_FOR_DEADLINE = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'REVISION_REQUESTED',
];
const IDLE_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'QUALITY_CHECK', 'REVISION_REQUESTED'];

const MS_DAY = 86400000;

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600000);
}

async function run24hReminders(): Promise<void> {
  const now = new Date();
  const windowStart = addHours(now, 24 - 0.25);
  const windowEnd = addHours(now, 24 + 0.25);

  const orders = await Order.find({
    expectedDeliveryDate: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ACTIVE_FOR_DEADLINE },
    reminder24hSentAt: { $exists: false },
  });

  const admins = await listActiveAdminIds();

  for (const order of orders) {
    const staffId = order.createdBy.toString();
    const karigarId = order.assignedTo.toString();
    const msg = `Order ${order.orderCode}: delivery in ~24h`;

    console.log('[notify][cron] DEADLINE_24H recipients order=', order.orderCode, staffId, karigarId, 'admins=', admins.length);
    await dispatchNotifications({
      recipientIds: [karigarId, staffId, ...admins],
      title: 'Deadline reminder',
      body: msg,
      type: 'DEADLINE_24H',
      entityType: 'order',
      entityId: order._id.toString(),
      data: { orderCode: order.orderCode },
    });

    order.reminder24hSentAt = new Date();
    await order.save();
  }
}

async function runOverdueAlerts(): Promise<void> {
  const now = new Date();
  const orders = await Order.find({
    expectedDeliveryDate: { $lt: now },
    status: { $in: ACTIVE_FOR_DEADLINE },
    overdueNotifiedAt: { $exists: false },
  });

  const admins = await listActiveAdminIds();

  for (const order of orders) {
    const staffId = order.createdBy.toString();
    const karigarId = order.assignedTo.toString();
    const msg = `Order ${order.orderCode} is past expected delivery`;

    console.log('[notify][cron] ORDER_OVERDUE order=', order.orderCode);
    await dispatchNotifications({
      recipientIds: [karigarId, staffId, ...admins],
      title: 'Order overdue',
      body: msg,
      type: 'ORDER_OVERDUE',
      entityType: 'order',
      entityId: order._id.toString(),
      data: { orderCode: order.orderCode },
    });

    order.overdueNotifiedAt = new Date();
    await order.save();
  }
}

async function runIdleFlags(): Promise<void> {
  const cutoff = new Date(Date.now() - 3 * MS_DAY);
  const orders = await Order.find({
    status: { $in: IDLE_STATUSES },
    updatedAt: { $lt: cutoff },
    idle3DayNotifiedAt: { $exists: false },
  });

  const admins = await listActiveAdminIds();

  for (const order of orders) {
    const staffId = order.createdBy.toString();
    const karigarId = order.assignedTo.toString();
    const msg = `Order ${order.orderCode} has had no updates for 3+ days`;

    console.log('[notify][cron] ORDER_IDLE_3D order=', order.orderCode);
    await dispatchNotifications({
      recipientIds: [karigarId, staffId, ...admins],
      title: 'Order idle',
      body: msg,
      type: 'ORDER_IDLE_3D',
      entityType: 'order',
      entityId: order._id.toString(),
      data: { orderCode: order.orderCode },
    });

    order.idle3DayNotifiedAt = new Date();
    await order.save();
  }
}

export function startScheduledJobs(): void {
  cron.schedule('*/15 * * * *', () => {
    void run24hReminders().catch((e) => console.error('[cron] 24h reminder', e));
  });
  cron.schedule('0 * * * *', () => {
    void runOverdueAlerts().catch((e) => console.error('[cron] overdue', e));
    void runIdleFlags().catch((e) => console.error('[cron] idle', e));
  });
}
