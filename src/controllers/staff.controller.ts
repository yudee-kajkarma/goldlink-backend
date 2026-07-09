import type { Request, Response } from 'express';
import Order from '../models/order.model.js';
import Counter from '../models/counter.model.js';
import User from '../models/user.model.js';
import Karigar from '../models/karigar.model.js';
import type { AuthRequest } from '../types/auth.js';
import { s3Service } from '../services/s3.service.js';
import { dispatchNotifications, listActiveAdminIds } from '../services/notification.service.js';
import { canTransitionOrderStatus } from '../services/orderStatusTransitions.service.js';
import { buildOrderSearchFilter } from '../utils/orderSearch.util.js';
import { normalizeOrderPriority } from '../utils/orderPriority.util.js';

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
  const sequence = String(counter?.seq ?? 1).padStart(3, '0');
  
  return `ORD-${year}-${month}-${sequence}`;
};

// List karigars available for assignment (used by Create Order screen)
export const getKarigars = async (_req: AuthRequest, res: Response) => {
  try {
    const karigars = await User.find({
      role: 'KARIGAR',
      isActive: true,
      isApproved: true,
    })
      .select('_id name phone email')
      .sort({ name: 1 })
      .lean();

    const profiles = await Karigar.find({
      user: { $in: karigars.map((k) => k._id) },
    })
      .select('user skillType experienceYears isAvailable')
      .lean();

    const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));

    const data = karigars.map((k) => {
      const profile = profileByUser.get(String(k._id));
      return {
        _id: k._id,
        name: k.name,
        phone: k.phone,
        email: k.email,
        skillType: profile?.skillType,
        experienceYears: profile?.experienceYears,
        isAvailable: profile?.isAvailable ?? true,
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
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
      // MONEY-DISABLED: totalAmount,
    } = req.body;

    const karigar = await User.findOne({ _id: assignedTo, role: 'KARIGAR', isActive: true });
    if (!karigar) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo must be an active KARIGAR user',
        errorCode: 'GL_VAL_001',
      });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'At least one reference image is required',
        errorCode: 'GL_VAL_001',
      });
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
      // MONEY-DISABLED: totalAmount,
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

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        await dispatchNotifications({
          recipientIds: [String(order.assignedTo), ...admins],
          title: 'New Order Assigned',
          body: `You have a new assignment: ${order.orderCode}`,
          type: 'ORDER_CREATED',
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode },
        });
      } catch (e) {
        console.error('[notify] createOrder dispatch failed', e);
      }
    })();

    res.status(201).json({ success: true, data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get own orders
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const orders = await Order.find({
      createdBy: req.user?._id,
      ...buildOrderSearchFilter(search),
    })
      .populate('assignedTo', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (_error: unknown) {
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
  } catch (_error: unknown) {
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

    // MONEY-DISABLED: 'totalAmount' removed from allowedFields
    const allowedFields = ['weight', 'designNotes', 'purity', 'priority', 'expectedDeliveryDate', 'customerRef'] as const;
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key as (typeof allowedFields)[number]))
    ) as Record<string, unknown>;
    if (typeof updates.priority === 'string' || typeof updates.priority === 'number') {
      updates.priority = normalizeOrderPriority(updates.priority);
    }
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Change order status (e.g., RECEIVED)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

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

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        const recipients =
          nextStatus === 'RECEIVED'
            ? admins
            : [String(order.assignedTo), ...admins];

        let title = 'Order updated';
        let body = `Order ${order.orderCode}: status changed to ${nextStatus}`;
        let typeKey = `ORDER_${nextStatus}`;

        if (nextStatus === 'REVISION_REQUESTED') {
          title = 'Revision requested';
          body = `${order.orderCode}: the staff requested a revision`;
          typeKey = 'ORDER_REVISION_REQUESTED';
        } else if (nextStatus === 'ON_HOLD') {
          title = 'Order on hold';
          body = `${order.orderCode} was put on hold by staff`;
          typeKey = 'ORDER_ON_HOLD';
        } else if (nextStatus === 'RECEIVED') {
          title = 'Order received';
          body = `${order.orderCode} was marked received by staff`;
          typeKey = 'ORDER_RECEIVED';
        }

        await dispatchNotifications({
          recipientIds: recipients,
          title,
          body,
          type: typeKey,
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode, status: nextStatus },
        });
      } catch (e) {
        console.error('[notify] staff status update dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, data: order });
  } catch (_error: unknown) {
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

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        await dispatchNotifications({
          recipientIds: [String(order.assignedTo), ...admins],
          title: 'Revision requested',
          body: `${order.orderCode}: the staff requested a revision`,
          type: 'ORDER_REVISION_REQUESTED',
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode, status: 'REVISION_REQUESTED' },
        });
      } catch (e) {
        console.error('[notify] requestRevision dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, message: 'Revision requested', data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// MONEY-DISABLED: Payments endpoints
// export const addPayment = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.body) {
//       return res.status(400).json({ success: false, message: 'Request body is missing' });
//     }
//     const { amount, type, status } = req.body;
//
//     const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
//
//     if (!order) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }
//
//     order.payments.push({
//       amount,
//       type,
//       status: status || 'PAID',
//       paidAt: new Date()
//     });
//
//     await order.save();
//
//     res.status(201).json({ success: true, data: order.payments });
//   } catch (_error: unknown) {
//     res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
//   }
// };
//
// export const getPayments = async (req: AuthRequest, res: Response) => {
//   try {
//     const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
//
//     if (!order) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }
//
//     res.status(200).json({ success: true, data: order.payments });
//   } catch (_error: unknown) {
//     res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
//   }
// };

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
  } catch (_error: unknown) {
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
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};
