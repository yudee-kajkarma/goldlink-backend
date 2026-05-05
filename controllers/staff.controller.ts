import type { Request, Response } from 'express';
import Order from '../models/order.model.js';
import Counter from '../models/counter.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';

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
    const { assignedTo, jewelleryType, metalType, weight, designNotes, purity, expectedDeliveryDate, priority, customerRef, images } = req.body;

    if (!assignedTo || !jewelleryType || !metalType) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
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
      priority: priority || 'NORMAL',
      customerRef,
      images: [], // Start with empty images
      statusLogs: [{
        status: 'PENDING',
        updatedBy: req.user?._id,
      }]
    });

    // Handle image uploads if files exist
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      const uploadPromises = files.map(file => 
        s3Service.uploadFile(file.buffer, file.mimetype, 'orders', order._id.toString())
      );
      const keys = await Promise.all(uploadPromises);
      
      // Update order with S3 keys
      order.images = keys.map(key => ({ url: key, type: 'INITIAL' }));
      await order.save();
    }

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    const allowedFields = ['weight', 'designNotes', 'purity', 'priority', 'expectedDeliveryDate', 'customerRef'] as const;
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key as (typeof allowedFields)[number]))
    );
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change order status (e.g., RECEIVED)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'Request body is missing. Ensure you are sending JSON with Content-Type: application/json' });
    }
    const { status } = req.body;
    // #region agent log
    fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H4',location:'controllers/staff.controller.ts:126',message:'staff status update requested',data:{status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const validStatuses = ['RECEIVED', 'REVISION_REQUESTED', 'ON_HOLD'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status update by Staff. Valid statuses: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

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

// Request revision
export const requestRevision = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'REVISION_REQUESTED';
    order.statusLogs.push({
      status: 'REVISION_REQUESTED',
      updatedBy: req.user?._id as any,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Revision requested', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
      loggedBy: req.user?._id as any,
      loggedAt: new Date()
    });

    await order.save();

    res.status(201).json({ success: true, data: order.materialLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReturnedMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { returnedWeight, logId } = req.body; // logId to update a specific log or just update the latest

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
      log.returnedWeight = returnedWeight;
      if (log.issuedWeight !== undefined) {
        log.wastage = log.issuedWeight - returnedWeight;
      }
    }

    await order.save();

    res.status(200).json({ success: true, data: order.materialLogs[logIndex] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
