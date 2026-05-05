import type { Response, NextFunction } from 'express';
import { Message } from '../models/message.model.js';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';

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
    // #region agent log
    fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H5',location:'controllers/chat.controller.ts:73',message:'chat upload uses local storage service',data:{filename:req.file.filename||null,mimetype:req.file.mimetype,size:req.file.size},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
