import type { Request, Response } from 'express';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import type { AuthRequest } from '../types/auth.js';
import Order from '../models/order.model.js';

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve Staff/Karigar
export const approveUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User information missing' });
    }

    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user._id as any;
    user.approvedAt = new Date();

    await user.save();

    res.status(200).json({ success: true, message: 'User approved successfully', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Deactivate Account
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({ success: true, message: 'User deactivated successfully', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name email phone')
      .populate('assignedTo', 'name email phone');
      
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reassign order to a different karigar
export const reassignOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { karigarId } = req.body;
    
    if (!karigarId) {
      return res.status(400).json({ success: false, message: 'karigarId is required' });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify if the new karigar exists and is active/approved
    const karigar = await User.findOne({ _id: karigarId, role: 'KARIGAR', isActive: true });
    if (!karigar) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive Karigar selected' });
    }

    order.assignedTo = karigarId as any;
    
    // Log the status change
    if (req.user && req.user._id) {
      order.statusLogs.push({
        status: 'REASSIGNED',
        updatedBy: req.user._id as any,
        createdAt: new Date()
      });
    }

    await order.save();
    
    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export orders placeholder
export const exportOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find().populate('createdBy', 'name').populate('assignedTo', 'name');
    // In a real scenario, convert `orders` to CSV/PDF
    res.status(200).json({ success: true, message: 'Export logic here. Returning JSON for now.', data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
