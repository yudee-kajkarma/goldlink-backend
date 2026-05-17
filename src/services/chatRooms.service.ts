import { Types } from 'mongoose';
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import { Message } from '../models/message.model.js';
import { resolveChatFullName } from '../utils/chatSender.util.js';

export type ChatRoomListRow = {
  orderId: string;
  orderNo: string;
  jewelleryType: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  lastMessage: { text: string; messageType: string; createdAt: Date } | null;
  unreadCount: number;
  otherParticipant: { _id: string; name: string; role: string; avatar: string };
};

function mapUserToParticipant(u: {
  _id: unknown;
  name?: string;
  email?: string;
  role?: string;
}): { _id: string; name: string; role: string; avatar: string } {
  return {
    _id: String(u._id),
    name: resolveChatFullName(u as Record<string, unknown>),
    role: typeof u.role === 'string' ? u.role : '',
    avatar: '',
  };
}

/** RBAC-safe match for orders the user may see in chat. */
export function chatOrdersMatchForRole(
  userId: string,
  role: string | undefined
): Record<string, unknown> | null {
  const uid = new Types.ObjectId(userId);
  if (role === 'ADMIN') return {};
  if (role === 'STAFF') return { createdBy: uid };
  if (role === 'KARIGAR') return { assignedTo: uid };
  return null;
}

export async function userMayAccessOrderChatOrder(
  orderId: string,
  userId: string | undefined,
  role: string | undefined
): Promise<boolean> {
  if (!userId) return false;
  const order = await Order.findById(orderId).select('createdBy assignedTo').lean();
  if (!order) return false;
  const uid = userId;
  if (role === 'ADMIN') return true;
  const cb = String(order.createdBy);
  const at = String(order.assignedTo);
  return uid === cb || uid === at;
}

/**
 * Who the "other" party is in the chat list/detail for the current viewer.
 * ADMIN: surface assigned karigar (assignedTo) as primary counterparty label.
 */
export function pickOtherUserId(
  role: string | undefined,
  createdById: string,
  assignedToId: string
): string {
  if (role === 'STAFF') return assignedToId;
  if (role === 'KARIGAR') return createdById;
  return assignedToId;
}

export async function aggregateChatRooms(
  userId: string,
  role: string | undefined,
  limit: number
): Promise<ChatRoomListRow[]> {
  const match = chatOrdersMatchForRole(userId, role);
  if (match === null) return [];

  const uidObj = new Types.ObjectId(userId);

  const rows = await Order.aggregate<{
    _id: Types.ObjectId;
    orderCode: string;
    jewelleryType: string;
    status: string;
    updatedAt: Date;
    createdAt: Date;
    createdBy: Types.ObjectId;
    assignedTo: Types.ObjectId;
    lastMsg: { content?: string; messageType?: string; createdAt?: Date } | null;
    unreadCount: number;
  }>([
    { $match: match },
    { $sort: { updatedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'messages',
        let: { oid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$orderId', '$$oid'] } } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 1 },
          { $project: { content: 1, messageType: 1, createdAt: 1 } },
        ],
        as: 'lm',
      },
    },
    {
      $lookup: {
        from: 'messages',
        let: { oid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$orderId', '$$oid'] },
                  { $ne: ['$senderId', uidObj] },
                  { $eq: ['$receiverId', uidObj] },
                  { $ne: ['$isRead', true] },
                  { $ne: ['$status', 'READ'] },
                ],
              },
            },
          },
          { $count: 'c' },
        ],
        as: 'uc',
      },
    },
    {
      $addFields: {
        lastMsg: { $arrayElemAt: ['$lm', 0] },
        unreadCount: {
          $let: {
            vars: { u0: { $arrayElemAt: ['$uc', 0] } },
            in: { $ifNull: ['$$u0.c', 0] },
          },
        },
      },
    },
    {
      $project: {
        lm: 0,
        uc: 0,
      },
    },
  ]).exec();

  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(pickOtherUserId(role, String(r.createdBy), String(r.assignedTo)));
  }

  const users = await User.find({ _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } })
    .select('name email role')
    .lean();

  const byId = new Map(users.map((u) => [String(u._id), u]));

  return rows.map((r) => {
    const otherId = pickOtherUserId(role, String(r.createdBy), String(r.assignedTo));
    const ou = byId.get(otherId);
    const otherParticipant = ou
      ? mapUserToParticipant(ou as { _id: unknown; name?: string; role?: string })
      : { _id: otherId, name: 'Unknown User', role: '', avatar: '' };

    const lm = r.lastMsg;
    const lastMessage =
      lm && lm.createdAt
        ? {
            text:
              typeof lm.content === 'string' && lm.content.length > 0
                ? lm.content
                : lm.messageType === 'image'
                  ? '[Image]'
                  : lm.messageType === 'video'
                    ? '[Video]'
                    : lm.messageType === 'voice'
                      ? '[Voice]'
                      : '',
            messageType: String(lm.messageType ?? 'text'),
            createdAt: lm.createdAt,
          }
        : null;

    return {
      orderId: String(r._id),
      orderNo: r.orderCode,
      jewelleryType: r.jewelleryType,
      status: r.status,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
      lastMessage,
      unreadCount: r.unreadCount,
      otherParticipant,
    };
  });
}

/** Room detail for GET /api/chat/orders/:orderId — omits unread/timestamp list noise per contract. */
export async function getChatOrderRoomDetail(
  orderId: string,
  userId: string | undefined,
  role: string | undefined
): Promise<{
  orderId: string;
  orderNo: string;
  jewelleryType: string;
  status: string;
  otherParticipant: { _id: string; name: string; role: string; avatar: string };
} | null> {
  const ok = await userMayAccessOrderChatOrder(orderId, userId, role);
  if (!ok || !userId) return null;

  const order = await Order.findById(orderId)
    .select('orderCode jewelleryType status createdBy assignedTo')
    .lean();
  if (!order) return null;

  const otherId = pickOtherUserId(role, String(order.createdBy), String(order.assignedTo));
  const ou = await User.findById(otherId).select('name email role').lean();
  const otherParticipant = ou
    ? mapUserToParticipant(ou as { _id: unknown; name?: string; role?: string })
    : { _id: otherId, name: 'Unknown User', role: '', avatar: '' };

  return {
    orderId: String(order._id),
    orderNo: order.orderCode,
    jewelleryType: order.jewelleryType,
    status: order.status,
    otherParticipant,
  };
}

export async function countUnreadChatMessagesForUser(userId: string): Promise<number> {
  const uidObj = new Types.ObjectId(userId);
  return Message.countDocuments({
    senderId: { $ne: uidObj },
    receiverId: uidObj,
    isRead: { $ne: true },
    status: { $ne: 'READ' },
  });
}
