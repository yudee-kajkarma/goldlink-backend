import type { Request, Response } from 'express';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import type { AuthRequest } from '../types/auth.js';

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
