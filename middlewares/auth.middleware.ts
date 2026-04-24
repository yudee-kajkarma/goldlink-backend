import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = (await User.findById(decoded.id)) as any;
      
      if (!req.user) {
         return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      next();
    } catch (error: any) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
  } catch (error: any) {
    next(error);
  }
};
