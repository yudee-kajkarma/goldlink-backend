import type { Response, NextFunction } from 'express';
import { Message } from '../models/message.model.js';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';
import { uploadToStorage } from '../services/storage.service.js';

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

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

    const messages = await Message.find({ orderId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, content, messageType, mediaUrl } = req.body;

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
      messageType: messageType || 'text',
      content,
      mediaUrl
    });

    // Note: Emitting to sockets should ideally happen here too for REST API calls
    // But we are focusing on Socket.IO direct messaging, this is just a fallback

    return res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = await uploadToStorage(req.file);

    return res.status(200).json({
      success: true,
      url: fileUrl,
    });
  } catch (error) {
    next(error);
  }
};
