import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ...otherDetails } = req.body;

    if (!['ADMIN', 'STAFF', 'KARIGAR'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists' });
    }

    // Default approval to false unless it's an admin for initial setup
    const isApproved = role === 'ADMIN' ? true : false;
    const isActive = role === 'ADMIN' ? true : false;

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      isApproved,
      isActive,
    });

    if (role === 'STAFF') {
      await Staff.create({
        user: user._id,
        department: otherDetails.department,
        designation: otherDetails.designation,
      });
    } else if (role === 'KARIGAR') {
      await Karigar.create({
        user: user._id,
        skillType: otherDetails.skillType,
        experienceYears: otherDetails.experienceYears,
      });
    }

    res.status(201).json({
      success: true,
      message: isApproved ? 'Registration successful' : 'Registration successful, pending admin approval',
      data: {
        _id: user._id,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved,
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password' });
    }

    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let profileDetails = null;

    if (user.role === 'STAFF') {
      profileDetails = await Staff.findOne({ user: user._id });
    } else if (user.role === 'KARIGAR') {
      profileDetails = await Karigar.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        profile: profileDetails
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  // Client-side should clear the token
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};
