import jwt, { type JwtPayload } from 'jsonwebtoken';
import User from '../models/user.model.js';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';
import { JWT_SECRET } from '../config/jwt.js';

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    let decoded: JwtPayload & { id?: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { id?: string };
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const userId = typeof decoded.id === 'string' ? decoded.id : undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    try {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      req.user = user;
    } catch (err) {
      console.error('protect: user lookup failed', err);
      return res.status(503).json({
        success: false,
        message: 'Unable to verify session. Please try again.',
      });
    }
    // #region agent log
    fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H2',location:'middlewares/auth.middleware.ts:20',message:'protect middleware user lookup',data:{hasJwtSecret:Boolean(process.env.JWT_SECRET),userFound:Boolean(req.user),isActive:req.user?.isActive,isApproved:req.user?.isApproved},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // At this point, `req.user` is guaranteed by the lookup above.

    if (!req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is deactivated' });
    }

    if (!req.user.isApproved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
    }

    next();
  } catch (error: any) {
    next(error);
  }
};
