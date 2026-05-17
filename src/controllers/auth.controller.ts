import type { Request, Response } from 'express';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';
import jwt from 'jsonwebtoken';
import type { AuthRequest } from '../types/auth.js';
import { JWT_SECRET } from '../config/jwt.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import { normalizeEmail, normalizePhone } from '../utils/userIdentity.js';
import { registerFcmTokenForUser } from '../services/fcmToken.service.js';

const generateToken = (id: string) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30m',
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, role, ...otherDetails } = req.body;

    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phone);

    const orClause: Array<{ email?: string; phone?: string }> = [];
    if (normEmail) orClause.push({ email: normEmail });
    if (normPhone) orClause.push({ phone: normPhone });
    const dupQ = User.findOne({ $or: orClause });
    const userExists = orClause.length
      ? await (normEmail ? dupQ.collation({ locale: 'en', strength: 2 }) : dupQ)
      : null;
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists', errorCode: 'GL_VAL_001' });
    }

    // Default approval and active status to false for staff and karigar
    const isApproved = false;
    const isActive = false;

    const user = await User.create({
      name,
      email: normEmail,
      phone: normPhone,
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

    if (role === 'STAFF' || role === 'KARIGAR') {
      void import('../services/notification.service.js')
        .then(async ({ dispatchNotifications, listActiveAdminIds }) => {
          const admins = await listActiveAdminIds();
          if (admins.length === 0) {
            return;
          }
          console.log('[notify] event ADMIN_NEW_REGISTRATION recipients=', admins.length);
          await dispatchNotifications({
            recipientIds: admins,
            title: 'New registration',
            body: `${name} (${role}) registered and awaits approval`,
            type: 'ADMIN_NEW_REGISTRATION',
            entityType: 'system',
            entityId: user._id.toString(),
            data: { pendingUserRole: role, pendingUserName: name },
          });
        })
        .catch((e) => console.error('[notify] admin registration alert failed', e));
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

  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, phone, password, role } = req.body as {
      email?: string;
      phone?: string;
      password: string;
      role?: 'ADMIN' | 'STAFF' | 'KARIGAR';
    };

    if ((!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password', errorCode: 'GL_VAL_001' });
    }

    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phone);

    const filter: Record<string, unknown> = {};
    if (role === 'ADMIN' || role === 'STAFF' || role === 'KARIGAR') {
      filter.role = role;
    }
    if (normEmail) {
      filter.email = normEmail;
    } else if (normPhone) {
      filter.phone = normPhone;
    } else {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password', errorCode: 'GL_VAL_001' });
    }

    let userQuery = User.findOne(filter).select('+password');
    if (typeof filter.email === 'string') {
      userQuery = userQuery.collation({ locale: 'en', strength: 2 });
    }
    const user = await userQuery;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', errorCode: 'GL_AUTH_001' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', errorCode: 'GL_AUTH_001' });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval',
        errorCode: 'GL_AUTH_001',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated',
        errorCode: 'GL_AUTH_001',
      });
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
        token: generateToken(user._id.toString()),
      }
    });

  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User information missing',
        errorCode: 'GL_AUTH_001',
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', errorCode: 'GL_NOT_FOUND_001' });
    }

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
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ success: false, message: 'No token provided', errorCode: 'GL_VAL_001' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ success: false, message: 'No token provided', errorCode: 'GL_VAL_001' });
    }

    // `protect` already verified the token, but we still need its `exp` to set
    // the denylist TTL. `decode` is fine here — no signature check required.
    const decoded = jwt.decode(token) as { exp?: number } | null;
    await blacklistToken(token, decoded?.exp);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

export const registerFcmToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User information missing',
        errorCode: 'GL_AUTH_001',
      });
    }
    const { fcmToken, token } = req.body as { fcmToken?: string; token?: string };
    const resolved = (typeof token === 'string' ? token.trim() : '') || (typeof fcmToken === 'string' ? fcmToken.trim() : '');
    if (!resolved) {
      return res.status(400).json({ success: false, message: 'token or fcmToken is required', errorCode: 'GL_VAL_001' });
    }
    await registerFcmTokenForUser(req.user._id.toString(), resolved);
    res.status(200).json({ success: true, message: 'FCM token registered' });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};

// PRD 4.6 — allow user to switch language anytime.
export const updateLanguage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?._id) {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized: User information missing', errorCode: 'GL_AUTH_001' });
    }

    const { language } = req.body as { language: 'EN' | 'HI' };

    await User.findByIdAndUpdate(req.user._id, { language }, { new: false });

    res.status(200).json({ success: true, message: 'Language updated', data: { language } });
  } catch (_error: unknown) {
    res.status(500).json({ success: false, message: 'Internal server error', errorCode: 'GL_SRV_001' });
  }
};
