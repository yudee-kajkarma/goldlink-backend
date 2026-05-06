import type { Response, NextFunction } from 'express';
import { Message } from '../models/message.model.js';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';
import { io } from '../sockets/index.js';

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role !== 'ADMIN') {
        const userId = req.user?._id.toString();
        if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
        }
    }

    let messages;
    let nextCursor: string | null = null;

    // Cursor-based pagination on _id to avoid skip() shifting under concurrent inserts.
    if (cursor) {
      const docs = await Message.find({ orderId, _id: { $lt: cursor } })
        .sort({ _id: -1 })
        .limit(limit);

      messages = docs;
      const last = docs[docs.length - 1];
      nextCursor = docs.length === limit && last ? last._id.toString() : null;
    } else {
      const effectiveCount = page * limit;
      const docs = await Message.find({ orderId })
        .sort({ _id: -1 })
        .limit(effectiveCount);

      const start = (page - 1) * limit;
      messages = docs.slice(start, start + limit);
      const last = messages[messages.length - 1];
      nextCursor = messages.length === limit && last ? last._id.toString() : null;
    }

    return res
      .status(200)
      .json({ success: true, count: messages.length, data: messages, nextCursor });
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

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const userId = req.user?._id.toString();
    if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
    }

    const newMessage = await Message.create({
      orderId,
      senderId: req.user?._id,
      messageType: (messageType || 'text') as 'text' | 'image' | 'video' | 'voice',
      content,
      mediaUrl,
      duration,
    });

    // PRD 3.2.x — When sending via REST, also broadcast over Socket.IO.
    const clients = await io.in(orderId).fetchSockets();

    const recipientId =
      userId === order.createdBy.toString() ? order.assignedTo.toString() : order.createdBy.toString();

    const recipientOnline = clients.some((s) => {
      const user = (s as { user?: { _id?: { toString?: () => string } } }).user;
      const onlineUserId = user?._id?.toString?.();
      return onlineUserId === recipientId;
    });

    if (recipientOnline) {
      newMessage.isDelivered = true;
      newMessage.deliveredAt = new Date();
      await newMessage.save();
    }

    io.to(orderId).emit('receive_message', newMessage);
    if (recipientOnline) {
      io.to(orderId).emit('message_delivered', { messageId: newMessage._id });
    }

    return res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const userId = req.user?._id.toString();
    if (userId !== order.createdBy.toString() && userId !== order.assignedTo.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this chat' });
    }

    const subFolder = req.file.mimetype.startsWith('video/')
      ? 'videos'
      : req.file.mimetype.startsWith('audio/')
        ? 'voice'
        : 'images';
    const mediaKey = await s3Service.uploadFile(req.file.buffer, req.file.mimetype, 'chat', orderId, subFolder);

    return res.status(200).json({
      success: true,
      mediaKey,
    });
  } catch (error) {
    next(error);
  }
};
