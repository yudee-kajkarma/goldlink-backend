import type { Request, Response } from 'express';
import Order from '../models/order.model.js';
import type { AuthRequest } from '../types/auth.js';

// Get assigned orders
export const getAssignedOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ assignedTo: req.user?._id })
      .populate('createdBy', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get order details
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id })
      .populate('createdBy', 'name email phone')
      .populate('statusLogs.updatedBy', 'name role')
      .populate('materialLogs.loggedBy', 'name role');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Accept order
export const acceptOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Order is not in PENDING state' });
    }

    order.status = 'ACCEPTED';
    order.statusLogs.push({
      status: 'ACCEPTED',
      updatedBy: req.user?._id as any,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Order accepted', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing' });
    }
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const validStatuses = ['IN_PROGRESS', 'QUALITY_CHECK', 'ON_HOLD'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status update by Karigar. Valid statuses: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    order.statusLogs.push({
      status,
      updatedBy: req.user?._id as any,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark complete (upload images)
export const completeOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing' });
    }
    const { images, completionNote } = req.body; // Expecting an array of image URLs

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one completion image is required' });
    }

    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'COMPLETED';
    
    // Add completion note to design notes or a new field if needed, for now we will append it or leave it out if schema doesn't support completionNote natively
    if (completionNote) {
      order.designNotes = order.designNotes ? `${order.designNotes}\nCompletion Note: ${completionNote}` : completionNote;
    }

    // Add completion images
    const completionImages = images.map(url => ({ url, type: 'COMPLETION' as const }));
    order.images.push(...completionImages);

    order.statusLogs.push({
      status: 'COMPLETED',
      updatedBy: req.user?._id as any,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Order marked as completed', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
