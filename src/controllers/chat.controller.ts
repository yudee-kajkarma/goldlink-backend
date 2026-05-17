import type { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Message, type IMessage } from '../models/message.model.js';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';
import type { IUser } from '../models/user.model.js';
import { s3Service, normalizeChatMediaUrlForStorage } from '../services/s3.service.js';
import { io } from '../sockets/index.js';
import { isMongoObjectId } from '../utils/objectId.js';
import { messageToPlain } from '../utils/messagePayload.js';
import { enrichChatMessageForClient } from '../utils/chatMessageSerialize.js';
import { isReservedChatPathSegment } from '../constants/chat.constants.js';
import { MAX_VOICE_DURATION_SECONDS } from '../constants/media.constants.js';
import {
  aggregateChatRooms,
  countUnreadChatMessagesForUser,
  getChatOrderRoomDetail as fetchChatOrderRoomDetail,
} from '../services/chatRooms.service.js';
import {
  CHAT_SENDER_POPULATE_SELECT,
  chatSenderDeleted,
  chatSenderFromUserDoc,
  chatSenderFromUserLike,
  type ChatSenderPublic,
} from '../utils/chatSender.util.js';
import { emitToOrderParticipants, isOrderParticipantConnected } from '../services/chatDelivery.service.js';
import User from '../models/user.model.js';
import { notifyNewChatMessageIfNotInRoom } from '../services/notification.service.js';

function idKey(ref: unknown): string {
  if (ref == null) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    const inner = (ref as { _id: unknown })._id;
    return inner != null ? String(inner) : '';
  }
  return String(ref);
}

function userMayAccessOrderChat(
  order: { createdBy: unknown; assignedTo: unknown },
  userId: string | undefined,
  role: string | undefined
): boolean {
  if (!userId) return false;
  if (role === 'ADMIN') return true;
  const createdBy = idKey(order.createdBy);
  const assignedTo = idKey(order.assignedTo);
  return userId === createdBy || userId === assignedTo;
}

const MESSAGE_SENDER_POPULATE = {
  path: 'senderId',
  select: CHAT_SENDER_POPULATE_SELECT,
} as const;

async function resolveSenderOverrideForEmit(
  newMessage: IMessage,
  senderSource?: IUser | null
): Promise<{ senderOverride: ChatSenderPublic }> {
  if (senderSource) {
    return { senderOverride: chatSenderFromUserLike(senderSource) };
  }
  const u = await User.findById(newMessage.senderId).select(CHAT_SENDER_POPULATE_SELECT).lean();
  const senderOverride =
    chatSenderFromUserDoc((u ?? null) as Record<string, unknown> | null) ?? chatSenderDeleted();
  return { senderOverride };
}

async function fanOutNewOrderChatMessage(
  newMessage: IMessage,
  threadId: string,
  recipientId: string,
  participants: { createdById: string; assignedToId: string },
  senderSource?: IUser | null
): Promise<Record<string, unknown>> {
  const oid = threadId.trim();
  let recipientOnline = false;

  try {
    if (io) {
      recipientOnline = await isOrderParticipantConnected(io, oid, recipientId);

      if (recipientOnline) {
        newMessage.isDelivered = true;
        newMessage.deliveredAt = new Date();
        newMessage.status = 'DELIVERED';
        await newMessage.save();
      }
    }
  } catch (socketErr) {
    console.error('chat: realtime fan-out failed', socketErr);
  }

  const plainForEmit = messageToPlain(newMessage);
  const { senderOverride } = await resolveSenderOverrideForEmit(newMessage, senderSource);
  const payload = enrichChatMessageForClient(plainForEmit, participants, { senderOverride });

  try {
    if (io) {
      await emitToOrderParticipants(io, oid, [
        { event: 'receive_message', data: payload },
        { event: 'new_message', data: payload },
        { event: 'newMessage', data: payload },
      ]);

      if (recipientOnline) {
        await emitToOrderParticipants(io, oid, [
          {
            event: 'message_delivered',
            data: { messageId: String(newMessage._id), orderId: oid, status: 'delivered' },
          },
        ]);
      }
    }
  } catch (socketErr) {
    console.error('chat: realtime emit failed', socketErr);
  }

  try {
    const plain = messageToPlain(newMessage);
    const mt = plain.messageType;
    const preview =
      mt === 'text'
        ? String(plain.content ?? '').slice(0, 240)
        : mt === 'image'
          ? '[Image]'
          : mt === 'video'
            ? '[Video]'
            : '[Voice]';
    const sender = await User.findById(newMessage.senderId).select('name').lean();
    await notifyNewChatMessageIfNotInRoom({
      io: io ?? null,
      recipientId,
      orderId: oid,
      messageId: String(newMessage._id),
      preview,
      ...(sender?.name ? { senderDisplayName: sender.name } : {}),
    });
  } catch (notifyErr) {
    console.error('chat: notification dispatch failed', notifyErr);
  }

  return payload;
}

/** Chat inbox: rooms with last message, unread counts, and counterparty (aggregation, RBAC-safe). */
export const listChatRooms = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }
    if (role !== 'ADMIN' && role !== 'STAFF' && role !== 'KARIGAR') {
      return res.status(403).json({
        success: false,
        message: 'Chat is available to staff, karigar, and admin only',
        errorCode: 'GL_AUTH_001',
      });
    }

    const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));

    const data = await aggregateChatRooms(userId, role, limit);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getChatUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id?.toString();
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'STAFF' && role !== 'KARIGAR') {
      return res.status(403).json({
        success: false,
        message: 'Chat is available to staff, karigar, and admin only',
        errorCode: 'GL_AUTH_001',
      });
    }
    const count = await countUnreadChatMessagesForUser(uid);
    return res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

export const getChatOrderRoomDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orderIdRaw = req.params.orderId;
    const orderId = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
    if (!orderId || typeof orderId !== 'string' || !isMongoObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
        errorCode: 'GL_VAL_001',
      });
    }
    const data = await fetchChatOrderRoomDetail(orderId, req.user?._id?.toString(), req.user?.role);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const markChatRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.body as { orderId: string };
    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    const readerOid = req.user!._id;
    const orderOid = new Types.ObjectId(orderId);
    const filter = {
      orderId: orderOid,
      senderId: { $ne: readerOid },
      receiverId: readerOid,
      isRead: { $ne: true },
      status: { $ne: 'READ' },
    };

    const toMark = await Message.find(filter).select('_id').lean();
    const messageIds = toMark.map((m) => String(m._id));

    if (messageIds.length > 0) {
      const now = new Date();
      await Message.updateMany(
        { _id: { $in: toMark.map((m) => m._id) } },
        { $set: { isRead: true, readAt: now, status: 'READ' } }
      );

      const payload = { orderId: orderId.trim(), readerId: userId, messageIds };
      try {
        if (io) {
          await emitToOrderParticipants(io, orderId.trim(), [{ event: 'messages-read', data: payload }]);
        }
      } catch (socketErr) {
        console.error('chat: messages-read emit failed', socketErr);
      }
    }

    return res.status(200).json({ success: true, data: { updatedCount: messageIds.length } });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rawOrderId = req.params.chatId ?? req.params.orderId;
    const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'order id is required',
        errorCode: 'GL_VAL_001',
      });
    }

    if (isReservedChatPathSegment(orderId)) {
      return res.status(400).json({
        success: false,
        errorCode: 'GL_VAL_001',
        message:
          'Invalid chat path. Use GET /api/chat/rooms, GET /api/chat/messages/:chatId, GET /api/chat/unread, or POST /api/chat/read as documented.',
      });
    }

    if (!isMongoObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        errorCode: 'GL_VAL_001',
        message: 'Invalid order id. Use the order MongoDB _id (24 hex chars), e.g. GET /api/chat/messages/:chatId.',
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    const userId = req.user?._id?.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    let messages;
    let nextCursor: string | null = null;

    // Cursor-based pagination on _id to avoid skip() shifting under concurrent inserts.
    if (cursor && !isMongoObjectId(cursor)) {
      return res.status(400).json({ success: false, message: 'Invalid cursor', errorCode: 'GL_VAL_001' });
    }

    const orderOid = new Types.ObjectId(orderId);

    if (cursor) {
      const docs = await Message.find({ orderId: orderOid, _id: { $lt: cursor } })
        .sort({ _id: -1 })
        .limit(limit)
        .populate(MESSAGE_SENDER_POPULATE)
        .lean();

      const last = docs[docs.length - 1];
      nextCursor = docs.length === limit && last ? String(last._id) : null;
      // Chronological order for chat UIs (oldest → newest within this page)
      messages = [...docs].reverse();
    } else {
      const effectiveCount = page * limit;
      const docs = await Message.find({ orderId: orderOid })
        .sort({ _id: -1 })
        .limit(effectiveCount)
        .populate(MESSAGE_SENDER_POPULATE)
        .lean();

      const start = (page - 1) * limit;
      const slice = docs.slice(start, start + limit);
      const last = slice[slice.length - 1];
      nextCursor = slice.length === limit && last ? String(last._id) : null;
      messages = [...slice].reverse();
    }

    const participants = {
      createdById: idKey(order.createdBy),
      assignedToId: idKey(order.assignedTo),
    };

    const data = (messages as Record<string, unknown>[]).map((m) =>
      enrichChatMessageForClient(m, participants)
    );

    return res
      .status(200)
      .json({ success: true, count: data.length, data, nextCursor });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, content, messageType, mediaUrl, duration } = req.body as {
      orderId: string;
      content?: string;
      messageType?: string;
      mediaUrl?: string;
      duration?: number;
    };

    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin can view chat history but cannot send messages',
        errorCode: 'GL_AUTH_001',
      });
    }

    const userId = req.user?._id?.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    const createdBy = idKey(order.createdBy);
    const assignedTo = idKey(order.assignedTo);
    const recipientId = userId === createdBy ? assignedTo : createdBy;

    const newMessage = await Message.create({
      orderId: new Types.ObjectId(orderId),
      senderId: req.user._id,
      receiverId: new Types.ObjectId(recipientId),
      messageType: (messageType || 'text') as 'text' | 'image' | 'video' | 'voice',
      content,
      mediaUrl: normalizeChatMediaUrlForStorage(mediaUrl),
      duration,
    });

    const participants = {
      createdById: idKey(order.createdBy),
      assignedToId: idKey(order.assignedTo),
    };

    const responsePayload = await fanOutNewOrderChatMessage(
      newMessage,
      orderId.trim(),
      recipientId,
      participants,
      req.user
    );

    return res.status(201).json({ success: true, data: responsePayload });
  } catch (error) {
    next(error);
  }
};

export const sendChatImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded', errorCode: 'GL_VAL_002' });
    }
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'File must be an image', errorCode: 'GL_VAL_001' });
    }

    const { orderId, chatId } = req.body as { orderId?: string; chatId?: string };
    const threadId = String(orderId ?? chatId ?? '').trim();

    const order = await Order.findById(threadId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin can view chat history but cannot send images',
        errorCode: 'GL_AUTH_001',
      });
    }

    const userId = req.user._id.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    let mediaUrl: string;
    try {
      const mediaKey = await s3Service.uploadFile(
        req.file.buffer,
        req.file.mimetype,
        'chat',
        threadId,
        'images'
      );
      mediaUrl = s3Service.toPublicUrl(mediaKey);
    } catch (uploadErr) {
      console.error('sendChatImage: S3 upload failed', uploadErr);
      return res.status(500).json({ success: false, message: 'Image upload failed', errorCode: 'GL_SRV_001' });
    }

    const createdBy = idKey(order.createdBy);
    const assignedTo = idKey(order.assignedTo);
    const recipientId = userId === createdBy ? assignedTo : createdBy;

    const newMessage = await Message.create({
      orderId: new Types.ObjectId(threadId),
      senderId: req.user._id,
      receiverId: new Types.ObjectId(recipientId),
      messageType: 'image',
      content: '',
      mediaUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    const participants = {
      createdById: idKey(order.createdBy),
      assignedToId: idKey(order.assignedTo),
    };

    const responsePayload = await fanOutNewOrderChatMessage(
      newMessage,
      threadId,
      recipientId,
      participants,
      req.user
    );
    return res.status(201).json({ success: true, data: responsePayload });
  } catch (error) {
    next(error);
  }
};

export const sendChatVideo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video uploaded', errorCode: 'GL_VAL_002' });
    }
    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ success: false, message: 'File must be a video', errorCode: 'GL_VAL_001' });
    }

    const { orderId, chatId } = req.body as { orderId?: string; chatId?: string };
    const threadId = String(orderId ?? chatId ?? '').trim();

    const order = await Order.findById(threadId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin can view chat history but cannot send videos',
        errorCode: 'GL_AUTH_001',
      });
    }

    const userId = req.user._id.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    let mediaUrl: string;
    try {
      const mediaKey = await s3Service.uploadFile(
        req.file.buffer,
        req.file.mimetype,
        'chat',
        threadId,
        'videos'
      );
      mediaUrl = s3Service.toPublicUrl(mediaKey);
    } catch (uploadErr) {
      console.error('sendChatVideo: S3 upload failed', uploadErr);
      return res.status(500).json({ success: false, message: 'Video upload failed', errorCode: 'GL_SRV_001' });
    }

    const createdBy = idKey(order.createdBy);
    const assignedTo = idKey(order.assignedTo);
    const recipientId = userId === createdBy ? assignedTo : createdBy;

    const newMessage = await Message.create({
      orderId: new Types.ObjectId(threadId),
      senderId: req.user._id,
      receiverId: new Types.ObjectId(recipientId),
      messageType: 'video',
      content: '',
      mediaUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    const participants = {
      createdById: idKey(order.createdBy),
      assignedToId: idKey(order.assignedTo),
    };

    const responsePayload = await fanOutNewOrderChatMessage(
      newMessage,
      threadId,
      recipientId,
      participants,
      req.user
    );
    return res.status(201).json({ success: true, data: responsePayload });
  } catch (error) {
    next(error);
  }
};

export const sendChatVoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'GL_AUTH_001' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No voice note uploaded', errorCode: 'GL_VAL_002' });
    }
    if (!req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ success: false, message: 'File must be audio', errorCode: 'GL_VAL_001' });
    }

    const { orderId, chatId, duration: durationBody } = req.body as {
      orderId?: string;
      chatId?: string;
      duration?: string | number;
    };
    const threadId = String(orderId ?? chatId ?? '').trim();

    const order = await Order.findById(threadId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin can view chat history but cannot send voice notes',
        errorCode: 'GL_AUTH_001',
      });
    }

    const userId = req.user._id.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    let mediaUrl: string;
    try {
      const mediaKey = await s3Service.uploadFile(
        req.file.buffer,
        req.file.mimetype,
        'chat',
        threadId,
        'voice'
      );
      mediaUrl = s3Service.toPublicUrl(mediaKey);
    } catch (uploadErr) {
      console.error('sendChatVoice: S3 upload failed', uploadErr);
      return res.status(500).json({ success: false, message: 'Voice note upload failed', errorCode: 'GL_SRV_001' });
    }

    const createdBy = idKey(order.createdBy);
    const assignedTo = idKey(order.assignedTo);
    const recipientId = userId === createdBy ? assignedTo : createdBy;

    const durationParsed = Number(durationBody);
    const durationSec =
      durationBody !== undefined && durationBody !== '' && Number.isFinite(durationParsed)
        ? Math.min(MAX_VOICE_DURATION_SECONDS, Math.max(0, durationParsed))
        : 0;

    const newMessage = await Message.create({
      orderId: new Types.ObjectId(threadId),
      senderId: req.user._id,
      receiverId: new Types.ObjectId(recipientId),
      messageType: 'voice',
      content: '',
      mediaUrl,
      duration: durationSec,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    const participants = {
      createdById: idKey(order.createdBy),
      assignedToId: idKey(order.assignedTo),
    };

    const responsePayload = await fanOutNewOrderChatMessage(
      newMessage,
      threadId,
      recipientId,
      participants,
      req.user
    );
    return res.status(201).json({ success: true, data: responsePayload });
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded', errorCode: 'GL_VAL_002' });
    }
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required', errorCode: 'GL_VAL_001' });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin can view chat history but cannot upload chat media',
        errorCode: 'GL_AUTH_001',
      });
    }

    const userId = req.user?._id?.toString();
    if (!userMayAccessOrderChat(order, userId, req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this chat',
        errorCode: 'GL_AUTH_001',
      });
    }

    const subFolder = req.file.mimetype.startsWith('video/')
      ? 'videos'
      : req.file.mimetype.startsWith('audio/')
        ? 'voice'
        : 'images';
    const mediaKey = await s3Service.uploadFile(req.file.buffer, req.file.mimetype, 'chat', orderId, subFolder);

    let mediaUrl: string | undefined;
    try {
      mediaUrl = s3Service.toPublicUrl(mediaKey);
    } catch {
      mediaUrl = undefined;
    }

    const resolvedUrl = mediaUrl ?? mediaKey;
    return res.status(200).json({
      success: true,
      data: { mediaKey, mediaUrl: resolvedUrl },
      mediaKey,
      mediaUrl: resolvedUrl,
    });
  } catch (error) {
    next(error);
  }
};
