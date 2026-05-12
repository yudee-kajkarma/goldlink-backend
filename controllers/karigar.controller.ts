import type { Request, Response } from 'express';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';
import { canTransitionOrderStatus } from '../services/orderStatusTransitions.service.js';
import { dispatchNotifications, listActiveAdminIds } from '../services/notification.service.js';

// Get assigned orders
export const getAssignedOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ assignedTo: req.user?._id })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get order details
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id })
      .populate('createdBy', 'name role')
      .populate('statusLogs.updatedBy', 'name role')
      .populate('materialLogs.loggedBy', 'name role');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Accept order
export const acceptOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canTransitionOrderStatus(order.status, 'ACCEPTED')) {
      return res.status(400).json({ success: false, message: 'Order cannot transition to ACCEPTED' });
    }

    order.status = 'ACCEPTED';
    order.statusLogs.push({
      status: 'ACCEPTED',
      updatedBy: req.user!._id,
      createdAt: new Date()
    });

    await order.save();

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        await dispatchNotifications({
          recipientIds: [String(order.createdBy), ...admins],
          title: 'Order accepted',
          body: `${order.orderCode} was accepted by the karigar`,
          type: 'ORDER_ACCEPTED',
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode },
        });
      } catch (e) {
        console.error('[notify] acceptOrder dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, message: 'Order accepted', data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const nextStatus = status as 'IN_PROGRESS' | 'QUALITY_CHECK' | 'ON_HOLD';
    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      return res.status(400).json({ success: false, message: 'Illegal order status transition' });
    }

    order.status = nextStatus;
    order.statusLogs.push({
      status: nextStatus,
      updatedBy: req.user!._id,
      createdAt: new Date()
    });

    await order.save();

    void (async () => {
      try {
        if (nextStatus === 'ON_HOLD') {
          const admins = await listActiveAdminIds();
          await dispatchNotifications({
            recipientIds: [String(order.createdBy), ...admins],
            title: 'Order on hold',
            body: `${order.orderCode} was put on hold by the karigar`,
            type: 'ORDER_ON_HOLD',
            entityType: 'order',
            entityId: order._id.toString(),
            data: { orderCode: order.orderCode, status: nextStatus },
          });
        }
      } catch (e) {
        console.error('[notify] karigar status update dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Mark complete (upload images)
export const completeOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing' });
    }
    const { images, completionNote } = req.body; // Expecting an array of uploaded S3 keys

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one completion image is required' });
    }

    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canTransitionOrderStatus(order.status, 'COMPLETED')) {
      return res.status(400).json({ success: false, message: 'Illegal order status transition' });
    }

    order.status = 'COMPLETED';
    
    // PRD: completion notes must be stored in a dedicated field.
    if (completionNote) order.completionNote = completionNote;

    const invalidImageKeys = images.some((key: unknown) => typeof key !== 'string' || key.startsWith('http://') || key.startsWith('https://'));
    if (invalidImageKeys) {
      return res.status(400).json({ success: false, message: 'Invalid completion images. Use uploaded media keys only.' });
    }

    // Add completion image keys
    const completionImages = images.map((key: string) => ({ url: key, type: 'COMPLETION' as const }));
    order.images.push(...completionImages);

    order.statusLogs.push({
      status: 'COMPLETED',
      updatedBy: req.user!._id,
      createdAt: new Date()
    });

    await order.save();

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        await dispatchNotifications({
          recipientIds: [String(order.createdBy), ...admins],
          title: 'Order completed',
          body: `${order.orderCode} was marked completed by the karigar`,
          type: 'ORDER_COMPLETED',
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode },
        });
      } catch (e) {
        console.error('[notify] completeOrder dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, message: 'Order marked as completed', data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const uploadCompletionMedia = async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const orderId = typeof rawId === 'string' ? rawId : rawId?.[0];
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No media file provided' });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order id is required' });
    }

    const order = await Order.findOne({ _id: orderId, assignedTo: req.user?._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const key = await s3Service.uploadFile(file.buffer, file.mimetype, 'orders', orderId, 'completion');
    return res.status(200).json({ success: true, mediaKey: key });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};
