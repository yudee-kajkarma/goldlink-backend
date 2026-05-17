import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import Order from '../models/order.model.js';
import { Message } from '../models/message.model.js';
import { notifyNewChatMessageIfNotInRoom } from '../services/notification.service.js';
import { normalizeChatMediaUrlForStorage } from '../services/s3.service.js';
import { isMongoObjectId } from '../utils/objectId.js';
import { messageToPlain } from '../utils/messagePayload.js';
import { enrichChatMessageForClient } from '../utils/chatMessageSerialize.js';
import { chatSenderFromUserLike } from '../utils/chatSender.util.js';
import type { IUser } from '../models/user.model.js';
import {
  emitToOrderParticipants,
  isOrderParticipantConnected,
} from '../services/chatDelivery.service.js';
import { MAX_VOICE_DURATION_SECONDS } from '../constants/media.constants.js';

function parseClientPayload(payload: unknown): Record<string, unknown> {
  let data: unknown = payload;
  if (typeof payload === 'string') data = JSON.parse(payload);
  if (Array.isArray(payload)) data = payload[0];
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
}

export default function registerChatHandlers(io: Server, socket: Socket) {
  const user = (socket as unknown as { user: IUser }).user;

  socket.onAny((eventName, ...args) => {
    console.log(`[SOCKET EVENT] ${eventName}:`, JSON.stringify(args));
  });

  socket.on('ping', () => {
    socket.emit('pong', { message: 'Connection is alive!', time: new Date() });
  });

  const validateOrderAccess = async (rawOrderId: string) => {
    const orderId = rawOrderId.trim();
    if (!orderId) throw new Error('orderId is required');
    if (!isMongoObjectId(orderId)) throw new Error('Invalid order id');

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (user.role === 'ADMIN') {
      return order;
    }

    const userId = user._id.toString();
    const createdBy = order.createdBy.toString();
    const assignedTo = order.assignedTo.toString();

    if (userId !== createdBy && userId !== assignedTo) {
      throw new Error('Unauthorized to access this order chat');
    }

    return order;
  };

  const onJoinOrderRoom = async (payload: unknown, callback?: (result: unknown) => void) => {
    try {
      const data = parseClientPayload(payload);
      const orderId = data.orderId as string | undefined;
      if (!orderId) throw new Error('orderId is required in payload');

      await validateOrderAccess(orderId);

      const room = orderId.trim();
      await socket.join(room);

      const clients = await io.in(room).fetchSockets();

      if (typeof callback === 'function') callback({ success: true, roomSize: clients.length });
      socket.emit('chat_debug', { message: 'Joined room successfully', roomSize: clients.length, orderId: room });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('chat_error', { message: msg });
      if (typeof callback === 'function') callback({ success: false, error: msg });
    }
  };

  socket.on('join_order', onJoinOrderRoom);
  socket.on('order:join', onJoinOrderRoom);

  const onSendMessage = async (rawPayload: unknown, callback?: (result: unknown) => void) => {
    try {
      const data = parseClientPayload(rawPayload);

      if (user.role === 'ADMIN') {
        throw new Error('Admins can view chat via API but cannot send socket messages');
      }

      const orderId = data.orderId as string | undefined;
      const content = data.content as string | undefined;
      const messageType = (data.messageType as string | undefined) ?? 'text';
      const mediaUrl = data.mediaUrl as string | undefined;
      const duration = data.duration as number | undefined;

      if (!orderId) throw new Error('orderId is required');

      if (messageType === 'text' && !content) {
        throw new Error('content is required for text messages');
      }

      if (['image', 'video', 'voice'].includes(messageType) && !mediaUrl) {
        throw new Error(`mediaUrl is required for ${messageType} messages`);
      }

      if (messageType === 'voice') {
        if (duration == null || typeof duration !== 'number' || Number.isNaN(duration)) {
          throw new Error('duration is required for voice messages');
        }
        if (duration < 0 || duration > MAX_VOICE_DURATION_SECONDS) {
          throw new Error(`voice note duration must be between 0 and ${MAX_VOICE_DURATION_SECONDS} seconds`);
        }
      }

      const order = await validateOrderAccess(orderId);
      const room = orderId.trim();

      const userIdStr = user._id.toString();
      const recipientId =
        userIdStr === order.createdBy.toString() ? order.assignedTo.toString() : order.createdBy.toString();

      const newMessage = await Message.create({
        orderId: new Types.ObjectId(room),
        senderId: user._id,
        receiverId: new Types.ObjectId(recipientId),
        messageType,
        content: content || '',
        mediaUrl: normalizeChatMediaUrlForStorage(mediaUrl),
        duration,
      });

      const recipientOnline = await isOrderParticipantConnected(io, room, recipientId);

      if (recipientOnline) {
        newMessage.isDelivered = true;
        newMessage.deliveredAt = new Date();
        newMessage.status = 'DELIVERED';
        await newMessage.save();
      }

      const plain = messageToPlain(newMessage);
      const participants = {
        createdById: order.createdBy.toString(),
        assignedToId: order.assignedTo.toString(),
      };
      const messagePayload = enrichChatMessageForClient(plain, participants, {
        senderOverride: chatSenderFromUserLike(user),
      });

      await emitToOrderParticipants(io, room, [
        { event: 'receive_message', data: messagePayload },
        { event: 'new_message', data: messagePayload },
        { event: 'newMessage', data: messagePayload },
      ]);

      if (typeof callback === 'function') callback({ success: true, message: messagePayload });

      if (recipientOnline) {
        await emitToOrderParticipants(io, room, [
          {
            event: 'message_delivered',
            data: { messageId: String(newMessage._id), orderId: room, status: 'delivered' },
          },
        ]);
      }

      const mt = plain.messageType;
      const preview =
        mt === 'text'
          ? String(content || '').slice(0, 240)
          : mt === 'image'
            ? '[Image]'
            : mt === 'video'
              ? '[Video]'
              : '[Voice]';

      const senderDisplayName =
        typeof (socket as unknown as { user?: { name?: string } }).user?.name === 'string'
          ? String((socket as unknown as { user?: { name?: string } }).user!.name)
          : undefined;

      void notifyNewChatMessageIfNotInRoom({
        io,
        recipientId,
        orderId: room,
        messageId: String(newMessage._id),
        preview,
        ...(senderDisplayName ? { senderDisplayName } : {}),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('chat_error', { message: msg });
      if (typeof callback === 'function') callback({ success: false, error: msg });
    }
  };

  socket.on('send_message', onSendMessage);
  socket.on('chat:message', onSendMessage);
  socket.on('chat:send_message', onSendMessage);

  const onTyping = async (payload: unknown) => {
    try {
      const data = parseClientPayload(payload);
      const orderId = data.orderId as string | undefined;
      const typing = data.typing !== false;
      if (!orderId || !typing) return;

      await validateOrderAccess(orderId);
      socket.to(orderId.trim()).emit('typing', { userId: user._id });
    } catch {
      // typing is best-effort
    }
  };

  socket.on('typing', onTyping);
  socket.on('chat:typing', onTyping);

  socket.on('message_read', async (payload, callback) => {
    try {
      if (user.role === 'ADMIN') {
        throw new Error('Admins cannot mark messages as read');
      }

      const data = parseClientPayload(payload);
      const messageId = data.messageId as string | undefined;
      if (!messageId) throw new Error('messageId is required');

      const message = await Message.findById(messageId);
      if (!message) throw new Error('Message not found');

      const orderIdStr = message.orderId.toString();
      await validateOrderAccess(orderIdStr);

      message.isRead = true;
      message.readAt = new Date();
      message.status = 'READ';
      await message.save();

      await emitToOrderParticipants(io, orderIdStr, [
        {
          event: 'message_read',
          data: { messageId, orderId: orderIdStr, status: 'read' },
        },
      ]);

      if (typeof callback === 'function') callback({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (typeof callback === 'function') callback({ success: false, error: msg });
    }
  });
}
