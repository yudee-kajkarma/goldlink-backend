import type { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    [key: string]: any;
  };
}
