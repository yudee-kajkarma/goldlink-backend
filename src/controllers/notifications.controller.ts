import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import type { AuthRequest } from '../types/auth.js';
import { registerFcmTokenForUser } from '../services/fcmToken.service.js';

export const listNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: uid };

    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      count: items.length,
      data: items,
    });
  } catch (e) {
    next(e);
  }
};

export const unreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const count = await Notification.countDocuments({ userId: uid, isRead: false });
    return res.status(200).json({ success: true, count });
  } catch (e) {
    next(e);
  }
};

export const markRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    const doc = await Notification.findOneAndUpdate(
      { _id: id, userId: uid },
      { isRead: true },
      { new: true }
    ).lean();

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.status(200).json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
};

export const markAllRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const result = await Notification.updateMany({ userId: uid, isRead: false }, { $set: { isRead: true } });
    return res.status(200).json({ success: true, matched: result.modifiedCount });
  } catch (e) {
    next(e);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    const del = await Notification.deleteOne({ _id: id, userId: uid });
    if (del.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.status(200).json({ success: true, message: 'Deleted' });
  } catch (e) {
    next(e);
  }
};

export const registerPushToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = req.user?._id;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { token, fcmToken } = req.body as { token?: string; fcmToken?: string };
    const resolved = typeof token === 'string' && token.trim() ? token.trim() : fcmToken?.trim();
    if (!resolved) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    await registerFcmTokenForUser(uid.toString(), resolved);
    return res.status(200).json({ success: true, message: 'Push token registered' });
  } catch (e) {
    next(e);
  }
};
