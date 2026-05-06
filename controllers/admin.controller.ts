import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import type { AuthRequest } from '../types/auth.js';
import Order from '../models/order.model.js';
import { sendNotification } from '../services/notification.service.js';

// Get all users (with optional role filtering)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role, isApproved } = req.query;
    let query: any = {};
    
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    const users = await User.find(query).select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Get single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL102" });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Approve Staff/Karigar
export const approveUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL102" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User information missing', errorCode: "GL101" });
    }

    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();

    await user.save();

    res.status(200).json({ success: true, message: 'User approved successfully', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Deactivate Account
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: "GL102" });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({ success: true, message: 'User deactivated successfully', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

/** Admin creates STAFF / KARIGAR with immediate approval (PRD 2.1). */
export const adminCreateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, password, role, department, designation, skillType, experienceYears } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists', errorCode: 'GL201' });
    }

    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized', errorCode: 'GL101' });
    }

    const user = await User.create({
      name,
      email,
      phone,
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// --- ORDER OVERSIGHT ---

// Get all orders (with optional filters)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, karigar, staff, type } = req.query;
    let query: any = {};
    
    if (status) query.status = status;
    if (karigar) query.assignedTo = karigar;
    if (staff) query.createdBy = staff;
    if (type) query.jewelleryType = type;

    const orders = await Order.find(query)
      .populate('createdBy', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error: any) {
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
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: "GL301" });
    }
    
    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// Reassign order to a different karigar
export const reassignOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { karigarId } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', errorCode: "GL301" });
    }

    const karigar = await User.findOne({ _id: karigarId, role: 'KARIGAR', isActive: true });
    if (!karigar) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive Karigar selected', errorCode: "GL201" });
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

    void sendNotification(
      String(karigarId),
      'Order reassigned to you',
      `You have been assigned order ${order.orderCode}`,
      { orderId: order._id.toString(), type: 'ORDER_REASSIGNED' }
    );
    
    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

const TERMINAL_STATUSES = ['COMPLETED', 'RECEIVED'] as const;

function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function paidTotal(order: { payments?: Array<{ amount?: number; status?: string }> }): number {
  return (order.payments ?? [])
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/** PRD 3.3.4 — consolidated order analytics. */
export const getOrderAnalytics = async (req: Request, res: Response) => {
  try {
    const terminal = [...TERMINAL_STATUSES];
    const activeForDue = [
      'PENDING',
      'ACCEPTED',
      'IN_PROGRESS',
      'QUALITY_CHECK',
      'REVISION_REQUESTED',
    ];

    const [
      totalGenerated,
      totalCompleted,
      avgTurnaroundAgg,
      byKarigar,
      byStaff,
      byJewelleryType,
      monthlyTrend,
      overdueOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: terminal } }),
      Order.aggregate<{ _id: null; avgMs: number | null }>([
        { $match: { status: { $in: terminal } } },
        {
          $project: {
            diffMs: { $subtract: ['$updatedAt', '$createdAt'] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: '$diffMs' } } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$assignedTo',
            totalGenerated: { $sum: 1 },
            totalCompleted: {
              $sum: { $cond: [{ $in: ['$status', terminal] }, 1, 0] },
            },
          },
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        {
          $project: {
            karigarId: '$_id',
            name: '$u.name',
            totalGenerated: 1,
            totalCompleted: 1,
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$createdBy',
            totalGenerated: { $sum: 1 },
            totalCompleted: {
              $sum: { $cond: [{ $in: ['$status', terminal] }, 1, 0] },
            },
          },
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        {
          $project: {
            staffId: '$_id',
            name: '$u.name',
            totalGenerated: 1,
            totalCompleted: 1,
          },
        },
      ]),
      Order.aggregate([
        { $group: { _id: '$jewelleryType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            generated: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $in: ['$status', terminal] }, 1, 0] },
            },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Order.countDocuments({
        expectedDeliveryDate: { $lt: new Date() },
        status: { $in: activeForDue },
      }),
    ]);

    const avgTurnaroundMs = avgTurnaroundAgg[0]?.avgMs ?? null;
    const avgTurnaroundDays =
      avgTurnaroundMs != null && !Number.isNaN(avgTurnaroundMs)
        ? avgTurnaroundMs / 86400000
        : null;

    const completionRate = totalGenerated > 0 ? totalCompleted / totalGenerated : 0;

    res.status(200).json({
      success: true,
      data: {
        totalGenerated,
        totalCompleted,
        completionRate,
        avgTurnaroundDays,
        byKarigar,
        byStaff,
        overdueOrders,
        byJewelleryType,
        monthlyTrend,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

/** ?format=json|csv|pdf */
export const exportOrders = async (req: Request, res: Response) => {
  try {
    const format = String(req.query.format ?? 'json').toLowerCase();
    if (!['json', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use json, csv, or pdf',
        errorCode: 'GL201',
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
        'totalAmount',
        'paidTotal',
        'balanceDue',
        'createdAt',
        'expectedDeliveryDate',
      ];
      res.write(headers.join(',') + '\n');
      for (const o of orders) {
        const created = o.createdBy as { name?: string } | null;
        const assigned = o.assignedTo as { name?: string } | null;
        const total = o.totalAmount;
        const paid = paidTotal(o);
        const balance =
          total != null && !Number.isNaN(Number(total)) ? Math.max(0, Number(total) - paid) : '';
        const row = [
          o.orderCode,
          o.status,
          o.jewelleryType,
          o.metalType,
          o.priority,
          created?.name ?? '',
          assigned?.name ?? '',
          total ?? '',
          paid,
          balance,
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
      const paid = paidTotal(o);
      const total = o.totalAmount;
      const balance =
        total != null && !Number.isNaN(Number(total)) ? Math.max(0, Number(total) - paid) : 'n/a';
      doc.text(
        `${o.orderCode} | ${o.status} | ${o.jewelleryType} | staff: ${created?.name ?? '-'} | karigar: ${assigned?.name ?? '-'} | total: ${total ?? '-'} | paid: ${paid} | due: ${balance}`
      );
      doc.moveDown(0.25);
    }
    doc.end();
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};