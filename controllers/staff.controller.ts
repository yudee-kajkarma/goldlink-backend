import type { Request, Response } from 'express';
import Order from '../models/order.model.js';
import Counter from '../models/counter.model.js';
import User from '../models/user.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';
import { sendNotification } from '../services/notification.service.js';
import { canTransitionOrderStatus } from '../services/orderStatusTransitions.service.js';

// Helper to generate order code
const generateOrderCode = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const counterKey = `${year}-${month}`;
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // #region agent log
  fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'post-fix',hypothesisId:'H3',location:'controllers/staff.controller.ts:12',message:'order code counter sequence generated',data:{year,month,counterKey,seq:counter?.seq},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const sequence = String(counter?.seq ?? 1).padStart(3, '0');
  
  return `ORD-${year}-${month}-${sequence}`;
};

// Create a new order
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const {
      assignedTo,
      jewelleryType,
      metalType,
      weight,
      designNotes,
      purity,
      expectedDeliveryDate,
      priority,
      customerRef,
      totalAmount,
    } = req.body;

    const karigar = await User.findOne({ _id: assignedTo, role: 'KARIGAR', isActive: true });
    if (!karigar) {
      return res.status(400).json({ success: false, message: 'assignedTo must be an active KARIGAR user' });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length < 1) {
      return res.status(400).json({ success: false, message: 'At least one reference image is required' });
    }

    const orderCode = await generateOrderCode();

    const order = await Order.create({
      orderCode,
      createdBy: req.user?._id,
      assignedTo,
      jewelleryType,
      metalType,
      weight,
      designNotes,
      purity,
      expectedDeliveryDate,
      priority: priority ?? 'NORMAL',
      customerRef,
      totalAmount,
      images: [],
      statusLogs: [{
        status: 'PENDING',
        updatedBy: req.user?._id,
      }]
    });

    const uploadPromises = files.map(file =>
      s3Service.uploadFile(file.buffer, file.mimetype, 'orders', order._id.toString())
    );
    const keys = await Promise.all(uploadPromises);

    order.images = keys.map(key => ({ url: key, type: 'INITIAL' as const }));
    await order.save();

    void sendNotification(
      String(order.assignedTo),
      'New order assigned',
      `You have been assigned order ${order.orderCode}`,
      { orderId: order._id.toString(), type: 'ORDER_ASSIGNED' }
    );

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get own orders
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ createdBy: req.user?._id })
      .populate('assignedTo', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get order details
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id })
      .populate('assignedTo', 'name role')
      .populate('statusLogs.updatedBy', 'name role')
      .populate('materialLogs.loggedBy', 'name role');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Update order details (only if pending/accepted)
export const updateOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Usually you shouldn't update if it's already in progress or completed
    if (['COMPLETED', 'RECEIVED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot update a completed or received order' });
    }

    // #region agent log
    fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H4',location:'controllers/staff.controller.ts:112',message:'updateOrder payload keys',data:{keys:Object.keys(req.body||{})},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const allowedFields = ['weight', 'designNotes', 'purity', 'priority', 'expectedDeliveryDate', 'customerRef', 'totalAmount'] as const;
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key as (typeof allowedFields)[number]))
    );
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Change order status (e.g., RECEIVED)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    // #region agent log
    fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H4',location:'controllers/staff.controller.ts:126',message:'staff status update requested',data:{status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const nextStatus = status as 'RECEIVED' | 'REVISION_REQUESTED' | 'ON_HOLD';
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

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Request revision
export const requestRevision = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canTransitionOrderStatus(order.status, 'REVISION_REQUESTED')) {
      return res.status(400).json({ success: false, message: 'Illegal order status transition' });
    }

    order.status = 'REVISION_REQUESTED';
    order.statusLogs.push({
      status: 'REVISION_REQUESTED',
      updatedBy: req.user!._id,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Revision requested', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Payments endpoints
export const addPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing' });
    }
    const { amount, type, status } = req.body;

    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.payments.push({
      amount,
      type,
      status: status || 'PAID',
      paidAt: new Date()
    });

    await order.save();

    res.status(201).json({ success: true, data: order.payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order.payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Material endpoints
export const addIssuedMaterial = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing' });
    }
    const { issuedWeight } = req.body;

    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.materialLogs.push({
      issuedWeight,
      loggedBy: req.user!._id,
      loggedAt: new Date()
    });

    await order.save();

    res.status(201).json({ success: true, data: order.materialLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const updateReturnedMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { returnedWeight, logId } = req.body;

    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.materialLogs.length === 0) {
      return res.status(400).json({ success: false, message: 'No material issued yet' });
    }

    // Default to latest log if logId not provided
    const logIndex = logId 
      ? order.materialLogs.findIndex((log: any) => log._id?.toString() === logId)
      : order.materialLogs.length - 1;

    if (logIndex === -1) {
      return res.status(404).json({ success: false, message: 'Material log not found' });
    }

    const log = order.materialLogs[logIndex];
    if (log) {
      const issued = log.issuedWeight;
      log.returnedWeight = returnedWeight;
      if (issued != null && !Number.isNaN(Number(issued))) {
        log.wastage = Number(issued) - returnedWeight;
      } else {
        delete (log as { wastage?: number }).wastage;
      }
    }

    await order.save();

    res.status(200).json({ success: true, data: order.materialLogs[logIndex] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};
