import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import * as authService from '../services/auth.service.js';
import { loginSchema, registerSchema, updateLanguageSchema } from '../validators/auth.validator.js';
export const register = asyncHandler(async (req, res) => {
    const validatedData = registerSchema.parse(req.body);
    const existingUser = await User.findOne({
        $or: [
            { email: validatedData.email },
            { phone: validatedData.phone }
        ].filter(Boolean)
    });
    if (existingUser) {
        throw new AppError('User with this email or phone already exists', 400, 'GL_400');
    }
    const user = await User.create({
        ...validatedData,
        isApproved: false,
        isActive: false,
    });
    res.status(201).json({
        success: true,
        message: 'Registration successful, pending admin approval',
        data: {
            _id: user._id,
            name: user.name,
            role: user.role,
        }
    });
});
export const login = asyncHandler(async (req, res) => {
    const { email, phone, password } = loginSchema.parse(req.body);
    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+password');
    if (!user || !(await user.matchPassword(password))) {
        throw new AppError('Invalid credentials', 401, 'GL_401');
    }
    if (!user.isApproved) {
        throw new AppError('Your account is pending admin approval', 403, 'GL_403');
    }
    if (!user.isActive) {
        throw new AppError('Your account is deactivated', 403, 'GL_403');
    }
    user.lastLogin = new Date();
    await user.save();
    const tokens = await authService.generateTokens(user._id.toString());
    res.status(200).json({
        success: true,
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                language: user.language,
            },
            ...tokens
        }
    });
});
export const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        throw new AppError('Refresh token is required', 400, 'GL_400');
    const decoded = await authService.verifyRefreshToken(refreshToken);
    if (!decoded)
        throw new AppError('Invalid or expired refresh token', 401, 'GL_401');
    const tokens = await authService.generateTokens(decoded.id);
    res.status(200).json({ success: true, data: tokens });
});
export const getMe = asyncHandler(async (req, res) => {
    if (!req.user)
        throw new AppError('Not authorized', 401, 'GL_401');
    res.status(200).json({ success: true, data: req.user });
});
export const logout = asyncHandler(async (req, res) => {
    if (req.user) {
        await authService.clearSession(req.user._id.toString());
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});
export const updateLanguage = asyncHandler(async (req, res) => {
    const { language } = updateLanguageSchema.parse(req.body);
    if (!req.user)
        throw new AppError('Not authorized', 401, 'GL_401');
    req.user.language = language;
    await req.user.save();
    res.status(200).json({ success: true, message: 'Language updated successfully' });
});
export const updateFCMToken = asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken)
        throw new AppError('fcmToken is required', 400, 'GL_400');
    if (!req.user)
        throw new AppError('Not authorized', 401, 'GL_401');
    req.user.fcmToken = fcmToken;
    await req.user.save();
    res.status(200).json({ success: true, message: 'FCM token updated successfully' });
});
export const updatePIN = asyncHandler(async (req, res) => {
    const { pin, enabled } = req.body;
    if (!req.user)
        throw new AppError('Not authorized', 401, 'GL_401');
    if (enabled !== undefined)
        req.user.pinEnabled = enabled;
    if (pin)
        req.user.pin = pin; // Note: In production, hash this too!
    await req.user.save();
    res.status(200).json({ success: true, message: 'PIN settings updated successfully' });
});
//# sourceMappingURL=auth.controller.js.map