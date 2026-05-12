import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role ${req.user?.role || 'unknown'} is not authorized to access this route` 
      });
    }
    next();
  };
};
