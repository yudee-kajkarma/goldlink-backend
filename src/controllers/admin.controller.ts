import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import type { AuthRequest } from '../types/auth.js';
import Order from '../models/order.model.js';
import { dispatchNotifications, listActiveAdminIds } from '../services/notification.service.js';
import { buildAdminAnalytics } from '../services/orderAnalytics.service.js';
import { normalizeOrderPriority } from '../utils/orderPriority.util.js';
import { buildOrderSearchFilter } from '../utils/orderSearch.util.js';
import { normalizeEmail, normalizePhone } from '../utils/userIdentity.js';

// Get all users (with optional role filtering)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role, isApproved } = req.query;
    let query: any = {};
    
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    const users = await User.find(query).select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL_NOT_FOUND_001" });
    }

    let profileDetails = null;
    if (user.role === 'STAFF') {
      profileDetails = await Staff.findOne({ user: user._id });
    } else if (user.role === 'KARIGAR') {
      profileDetails = await Karigar.findOne({ user: user._id });
    }

    res.status(200).json({ 
      success: true, 
      data: { ...user.toObject(), profile: profileDetails } 
    });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Approve Staff/Karigar
export const approveUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL_NOT_FOUND_001" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User information missing', errorCode: "GL_AUTH_001" });
    }

    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();

    await user.save();

    res.status(200).json({ success: true, message: 'User approved successfully', data: user });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Deactivate Account
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL_NOT_FOUND_001" });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({ success: true, message: 'User deactivated successfully', data: user });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Reactivate Account
export const reactivateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL_NOT_FOUND_001" });
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({ success: true, message: 'User reactivated successfully', data: user });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

/** Admin creates STAFF / KARIGAR with immediate approval (PRD 2.1). */
export const adminCreateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, password, role, department, designation, skillType, experienceYears } = req.body;

    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phone);

    if (normEmail) {
      const emailExists = await User.findOne({ email: normEmail }).collation({ locale: 'en', strength: 2 });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'A user with this email already exists', errorCode: 'GL_VAL_001' });
      }
    }
    if (normPhone) {
      const phoneExists = await User.findOne({ phone: normPhone });
      if (phoneExists) {
        return res.status(400).json({ success: false, message: 'A user with this phone number already exists', errorCode: 'GL_VAL_001' });
      }
    }

    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized', errorCode: 'GL_AUTH_001' });
    }

    const user = await User.create({
      name,
      email: normEmail,
      phone: normPhone,
      password,
      role,
      isApproved: true,
      isActive: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    if (role === 'STAFF') {
      await Staff.create({
        user: user._id,
        department,
        designation,
      });
    } else {
      await Karigar.create({
        user: user._id,
        skillType,
        experienceYears,
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved,
        isActive: user.isActive,
      },
    });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// --- ORDER OVERSIGHT ---

// Get all orders (with optional filters)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, karigar, staff, type, search } = req.query;
    let query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (karigar) query.assignedTo = karigar;
    if (staff) query.createdBy = staff;
    if (type) query.jewelleryType = type;
    const searchQ = buildOrderSearchFilter(typeof search === 'string' ? search : undefined);
    query = { ...query, ...searchQ };

    const orders = await Order.find(query)
      .populate('createdBy', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name email phone')
      .populate('assignedTo', 'name email phone');
      
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: "GL_NOT_FOUND_002" });
    }
    
    res.status(200).json({ success: true, data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Reassign order to a different karigar
export const reassignOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { karigarId } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: "GL_NOT_FOUND_002" });
    }

    const karigar = await User.findOne({ _id: karigarId, role: 'KARIGAR', isActive: true });
    if (!karigar) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive Karigar selected', errorCode: "GL_VAL_001" });
    }

    order.assignedTo = new mongoose.Types.ObjectId(karigarId);
    
    if (req.user && req.user._id) {
      order.statusLogs.push({
        status: 'REASSIGNED',
        updatedBy: req.user._id,
        createdAt: new Date()
      });
    }

    await order.save();

    void (async () => {
      try {
        const admins = await listActiveAdminIds();
        await dispatchNotifications({
          recipientIds: [String(karigarId), ...admins],
          title: 'New Order Assigned',
          body: `You have been assigned order ${order.orderCode}`,
          type: 'ORDER_REASSIGNED',
          entityType: 'order',
          entityId: order._id.toString(),
          data: { orderCode: order.orderCode },
        });
      } catch (e) {
        console.error('[notify] reassignOrder dispatch failed', e);
      }
    })();

    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: order });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// MONEY-DISABLED: paidTotal helper
// function paidTotal(order: { payments?: Array<{ amount?: number; status?: string }> }): number {
//   return (order.payments ?? [])
//     .filter((p) => p.status === 'PAID')
//     .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
// }

/**
 * Admin dashboard analytics (real order data). Query: ?range=7d|30d|12m | ?from=&to=
 * GET /api/admin/analytics — primary shape expected by the Admin Analytics UI.
 */
export const getAdminAnalytics = async (req: Request, res: Response) => {
  try {
    const { payload, debug } = await buildAdminAnalytics(Order, req.query as Record<string, unknown>);
    console.log('[analytics] debug', JSON.stringify(debug));
    res.status(200).json({ success: true, data: payload });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('Invalid')) {
      res.status(400).json({ success: false, message: msg, errorCode: 'GL_VAL_001' });
      return;
    }
    console.error('[analytics] failed', err);
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

/** @deprecated Prefer GET /api/admin/analytics — same payload as getAdminAnalytics. */
export const getOrderAnalytics = getAdminAnalytics;

/** ?format=json|csv|pdf */
export const exportOrders = async (req: Request, res: Response) => {
  try {
    const format = String(req.query.format ?? 'json').toLowerCase();
    if (!['json', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use json, csv, or pdf',
        errorCode: 'GL_VAL_001',
      });
    }

    const orders = await Order.find()
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    if (format === 'json') {
      res.status(200).json({ success: true, count: orders.length, data: orders });
      return;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
      const headers = [
        'orderCode',
        'status',
        'jewelleryType',
        'metalType',
        'priority',
        'staffName',
        'karigarName',
        // MONEY-DISABLED: 'totalAmount',
        // MONEY-DISABLED: 'paidTotal',
        // MONEY-DISABLED: 'balanceDue',
        'createdAt',
        'expectedDeliveryDate',
      ];
      res.write(headers.join(',') + '\n');
      for (const o of orders) {
        const created = o.createdBy as { name?: string } | null;
        const assigned = o.assignedTo as { name?: string } | null;
        // MONEY-DISABLED:
        // const total = o.totalAmount;
        // const paid = paidTotal(o);
        // const balance =
        //   total != null && !Number.isNaN(Number(total)) ? Math.max(0, Number(total) - paid) : '';
        const row = [
          o.orderCode,
          o.status,
          o.jewelleryType,
          o.metalType,
          normalizeOrderPriority(o.priority),
          created?.name ?? '',
          assigned?.name ?? '',
          // MONEY-DISABLED: total ?? '',
          // MONEY-DISABLED: paid,
          // MONEY-DISABLED: balance,
          o.createdAt?.toISOString() ?? '',
          o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toISOString() : '',
        ].map(escapeCsvCell);
        res.write(row.join(',') + '\n');
      }
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-export.pdf"');
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(16).text('Orders export', { underline: true });
    doc.moveDown();
    doc.fontSize(9);
    for (const o of orders) {
      const created = o.createdBy as { name?: string } | null;
      const assigned = o.assignedTo as { name?: string } | null;
      // MONEY-DISABLED:
      // const paid = paidTotal(o);
      // const total = o.totalAmount;
      // const balance =
      //   total != null && !Number.isNaN(Number(total)) ? Math.max(0, Number(total) - paid) : 'n/a';
      doc.text(
        // MONEY-DISABLED: removed ` | total: ${total ?? '-'} | paid: ${paid} | due: ${balance}` from the line below
        `${o.orderCode} | ${o.status} | ${o.jewelleryType} | staff: ${created?.name ?? '-'} | karigar: ${assigned?.name ?? '-'}`
      );
      doc.moveDown(0.25);
    }
    doc.end();
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};