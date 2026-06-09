import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Server as IoServer } from 'socket.io';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';

function stringifyDataPayload(data?: Record<string, unknown>): Record<string, string> {
  if (!data) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val == null) {
      continue;
    }
    out[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
  return out;
}

/** Flatten persisted notification (+ id) for clients and sockets. */
export function notificationToPayload(doc: {
  _id: unknown;
  userId: unknown;
  title: string;
  body: string;
  type: string;
  entityType: string;
  entityId?: unknown;
  data?: unknown;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): Record<string, unknown> {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    title: doc.title,
    body: doc.body,
    type: doc.type,
    entityType: doc.entityType,
    entityId: doc.entityId != null ? String(doc.entityId) : undefined,
    data: doc.data,
    isRead: doc.isRead,
    createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
    updatedAt: doc.updatedAt?.toISOString?.() ?? doc.updatedAt,
  };
}

export async function listActiveAdminIds(): Promise<string[]> {
  const ids = await User.find({
    role: 'ADMIN',
    isApproved: true,
    isActive: true,
  })
    .select('_id')
    .lean();

  return ids.map((u) => String(u._id));
}

function uniqIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

function ensureFirebase(): boolean {
  if (getApps().length > 0) {
    return true;
  }

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      const serviceAccount = JSON.parse(inlineJson) as Record<string, unknown>;
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[notify] Firebase initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      return true;
    } catch (e) {
      console.error('[notify] Firebase init from FIREBASE_SERVICE_ACCOUNT_JSON failed', e);
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      initializeApp({ credential: applicationDefault() });
      console.log(
        '[notify] Firebase initialized via GOOGLE_APPLICATION_CREDENTIALS=',
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
      );
      return true;
    } catch (e) {
      console.error('[notify] Firebase init from GOOGLE_APPLICATION_CREDENTIALS failed', e);
    }
  }

  return false;
}

async function loadFcmTokensForUser(userId: string): Promise<string[]> {
  type UserLean = {
    fcmToken?: string;
    fcmTokens?: string[];
  };

  const user = (await User.findById(userId).select('fcmToken fcmTokens').lean()) as UserLean | null;
  if (!user) {
    return [];
  }

  const legacy = typeof user.fcmToken === 'string' && user.fcmToken.length > 0 ? user.fcmToken : undefined;
  const arr = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
  const merged = [legacy, ...arr].filter((t): t is string => Boolean(t && t.length > 0));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of merged) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

async function sendFcmToUser(
  userId: string,
  title: string,
  body: string,
  flatData?: Record<string, string>
): Promise<void> {
  const tokens = await loadFcmTokensForUser(userId);
  if (tokens.length === 0) {
    console.log('[notify][fcm] skip user=', userId, '(no tokens) title=', title);
    return;
  }

  if (!ensureFirebase()) {
    console.log('[notify][fcm] Firebase not configured; tokens=', tokens.length, { title, body }, flatData);
    return;
  }

  const messaging = getMessaging();
  for (const token of tokens) {
    try {
      const message: {
        token: string;
        notification: { title: string; body: string };
        android: {
          priority: 'high';
          notification: {
            defaultSound: boolean;
            defaultVibrateTimings: boolean;
          };
        };
        data?: Record<string, string>;
      } = {
        token,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      };
      if (flatData && Object.keys(flatData).length > 0) {
        message.data = flatData;
      }
      await messaging.send(message);
      console.log('[notify][fcm] sent ok user=', userId, 'tokenPrefix=', token.slice(0, 12));
    } catch (e) {
      console.error('[notify][fcm] failed user=', userId, 'tokenPrefix=', token.slice(0, 12), e);
    }
  }
}

async function emitNotificationSocket(userId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const { io } = await import('../sockets/index.js');
    if (!io) {
      console.log('[notify][socket] io not ready');
      return;
    }
    const sockets = await io.fetchSockets();
    let count = 0;
    for (const sock of sockets) {
      const u = (sock as { user?: { _id?: { toString: () => string } } }).user;
      if (!u?._id || String(u._id) !== userId) {
        continue;
      }
      sock.emit('notification:new', payload);
      count++;
    }
    console.log('[notify][socket] emitted notification:new user=', userId, 'sockCount=', count);
  } catch (e) {
    console.error('[notify][socket] emit failed user=', userId, e);
  }
}

export type DispatchNotificationArgs = {
  recipientIds: string[];
  title: string;
  body: string;
  type: string;
  entityType: 'order' | 'chat' | 'system';
  entityId?: string;
  data?: Record<string, unknown>;
  /** Default true — sends FCM per user independently of DB/socket. */
  sendPush?: boolean;
};

export async function dispatchNotifications(args: DispatchNotificationArgs): Promise<void> {
  const { recipientIds, title, body, type, entityType, entityId, data, sendPush = true } = args;

  const recipients = uniqIds(recipientIds);
  console.log('[notify] event type=', type, 'entity=', entityType, 'recipients=', recipients);

  const entityOid =
    entityId != null && entityId !== '' && mongoose.Types.ObjectId.isValid(entityId)
      ? new mongoose.Types.ObjectId(entityId)
      : undefined;

  const flatData = stringifyDataPayload({
    ...(data ?? {}),
    type,
    ...(entityOid ? { entityType, entityId: String(entityOid) } : { entityType }),
  });

  for (const uid of recipients) {
    if (!mongoose.Types.ObjectId.isValid(uid)) {
      console.log('[notify] skip invalid userId=', uid);
      continue;
    }

    let saved;
    try {
      saved = await Notification.create({
        userId: new mongoose.Types.ObjectId(uid),
        title,
        body,
        type,
        entityType,
        entityId: entityOid,
        data: data ?? {},
        isRead: false,
      });
      console.log('[notify][db] saved notification id=', saved._id, 'userId=', uid);
    } catch (e) {
      console.error('[notify][db] save failed user=', uid, e);
      continue;
    }

    const payload = notificationToPayload(saved.toObject());

    await emitNotificationSocket(uid, payload);

    if (!sendPush) {
      console.log('[notify][fcm] skipped by flag user=', uid);
      continue;
    }

    await sendFcmToUser(uid, title, body, flatData);
  }
}

/** True if user has any socket joined to the Socket.IO room named orderId. */
export async function notifyNewChatMessageIfNotInRoom(params: {
  io?: IoServer | null;
  recipientId: string;
  orderId: string;
  messageId: string;
  preview: string;
  senderDisplayName?: string;
}): Promise<void> {
  const { io, recipientId, orderId, messageId, preview, senderDisplayName } = params;

  if (!io) {
    console.log('[notify] chat: io missing — notifying without room check');
    await dispatchNotifications({
      recipientIds: [recipientId],
      title: 'New message',
      body: preview || '[Media]',
      type: 'CHAT_MESSAGE',
      entityType: 'chat',
      entityId: messageId,
      data: { orderId, messageId, senderName: senderDisplayName ?? '' },
      sendPush: true,
    });
    return;
  }

  try {
    const { isUserInOrderChatRoom } = await import('./chatDelivery.service.js');
    const inRoom = await isUserInOrderChatRoom(io, orderId, recipientId);
    if (inRoom) {
      console.log('[notify] chat suppressed — recipient viewing thread recipient=', recipientId, 'orderId=', orderId);
      return;
    }
  } catch (e) {
    console.error('[notify] chat room check failed', e);
  }

  const body =
    preview && preview.length > 0
      ? preview
      : senderDisplayName
        ? `${senderDisplayName}: [Media]`
        : '[New message]';

  await dispatchNotifications({
    recipientIds: [recipientId],
    title: senderDisplayName ? `New message from ${senderDisplayName}` : 'New message',
    body,
    type: 'CHAT_MESSAGE',
    entityType: 'chat',
    entityId: messageId,
    data: { orderId, messageId, senderName: senderDisplayName ?? '' },
    sendPush: true,
  });
}

/** Back-compat: persists + emits + pushes (same pipeline as newer events). */
export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const typeKey = typeof data?.type === 'string' ? data!.type : 'LEGACY_ALERT';
  const rawEt = typeof data?.entityType === 'string' ? data.entityType.toLowerCase() : '';
  let entityType: 'order' | 'chat' | 'system' = 'system';
  if (rawEt === 'order') {
    entityType = 'order';
  } else if (rawEt === 'chat') {
    entityType = 'chat';
  }
  const entityIdCandidate = typeof data?.orderId === 'string' ? data.orderId : typeof data?.messageId === 'string' ? data.messageId : undefined;
  await dispatchNotifications({
    recipientIds: [userId],
    title,
    body,
    type: typeKey,
    entityType,
    ...(entityIdCandidate ? { entityId: entityIdCandidate } : {}),
    ...(data ? { data } : {}),
    sendPush: true,
  });
}
