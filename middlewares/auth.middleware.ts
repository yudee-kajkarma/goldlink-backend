import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';
import { JWT_SECRET } from '../config/jwt.js';

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
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = (await User.findById(decoded.id)) as any;
      // #region agent log
      fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H2',location:'middlewares/auth.middleware.ts:20',message:'protect middleware user lookup',data:{hasJwtSecret:Boolean(process.env.JWT_SECRET),userFound:Boolean(req.user),isActive:req.user?.isActive,isApproved:req.user?.isApproved},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      if (!req.user) {
         return res.status(401).json({ success: false, message: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account is deactivated' });
      }

      if (!req.user.isApproved) {
        return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
      }
      
      next();
    } catch (error: any) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
  } catch (error: any) {
    next(error);
  }
};
