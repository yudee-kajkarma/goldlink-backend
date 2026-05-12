import type { Server } from 'socket.io';
import Order from '../models/order.model.js';

function chatDebug(...args: unknown[]) {
  if (process.env.DEBUG_CHAT === '1') console.log('[chat]', ...args);
}

export type ChatEmitItem = { event: string; data: unknown };

/**
 * Delivers chat events to every socket owned by the order's staff/karigar.
 * Optional `includeAdmin` includes ADMIN sockets (live moderation dashboards).
 * Does not depend on Socket.IO room membership — fixes clients that POST without join_order.
 */
export async function emitToOrderParticipants(
  io: Server,
  orderId: string,
  items: ChatEmitItem[],
  options?: { includeAdmin?: boolean }
): Promise<void> {
  const includeAdmin = options?.includeAdmin === true;

  const order = await Order.findById(orderId).select('createdBy assignedTo').lean();
  if (!order?.createdBy || !order?.assignedTo) {
    chatDebug('emit skipped: order not found', orderId);
    return;
  }

  const allowed = new Set<string>([String(order.createdBy), String(order.assignedTo)]);

  const sockets = await io.fetchSockets();
  let delivered = 0;
  for (const sock of sockets) {
    const u = (sock as { user?: { _id?: { toString?: () => string }; role?: string } }).user;
    if (!u?._id) continue;
    const uid = String(u._id);
    const eligible = allowed.has(uid) || (includeAdmin && u.role === 'ADMIN');
    if (!eligible) continue;

    for (const { event, data } of items) {
      sock.emit(event, data);
    }
    delivered++;
  }

  chatDebug('fan-out', { orderId, events: items.map((i) => i.event), socketCount: delivered });
}

/** True when the user's socket instance has explicitly joined room `orderId` (join_order / order:join). */
export async function isUserInOrderChatRoom(io: Server, orderId: string, userId: string): Promise<boolean> {
  const room = orderId.trim();
  if (!room) {
    return false;
  }

  const clients = await io.in(room).fetchSockets();
  return clients.some((sock) => {
    const u = (sock as { user?: { _id?: unknown } }).user;
    if (!u?._id) {
      return false;
    }
    return String(u._id) === userId;
  });
}

export async function isOrderParticipantConnected(
  io: Server,
  orderId: string,
  userId: string
): Promise<boolean> {
  const order = await Order.findById(orderId).select('createdBy assignedTo').lean();
  if (!order?.createdBy || !order?.assignedTo) return false;

  const allowed = new Set<string>([String(order.createdBy), String(order.assignedTo)]);
  if (!allowed.has(userId)) return false;

  const sockets = await io.fetchSockets();
  return sockets.some((sock) => {
    const u = (sock as { user?: { _id?: unknown } }).user;
    if (!u?._id) return false;
    return String(u._id) === userId;
  });
}
