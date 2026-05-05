import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new AppError('Not authorized to access this route', 401, 'GL_401'));
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new AppError('User not found', 401, 'GL_401'));
        }
        if (!user.isActive) {
            return next(new AppError('User account is inactive', 403, 'GL_403'));
        }
        if (!user.isApproved) {
            return next(new AppError('User account is not approved yet', 403, 'GL_403'));
        }
        req.user = user;
        next();
    }
    catch (error) {
        return next(new AppError('Not authorized to access this route', 401, 'GL_401'));
    }
});
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError(`User role ${req.user?.role} is not authorized to access this route`, 403, 'GL_403'));
        }
        next();
    };
};
//# sourceMappingURL=auth.middleware.js.map