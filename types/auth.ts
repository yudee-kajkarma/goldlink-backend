import type { Request } from 'express';
import type { Types } from 'mongoose';

export interface AuthRequest extends Request {
  user?: {
    _id: Types.ObjectId;
    role: 'ADMIN' | 'STAFF' | 'KARIGAR';
    [key: string]: unknown;
  };
}
