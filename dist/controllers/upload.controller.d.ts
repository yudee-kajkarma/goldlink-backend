import type { Request, Response } from 'express';
import type { AuthRequest } from '../types/auth.js';
export declare const uploadOrderImages: (req: AuthRequest, res: Response) => Promise<void>;
export declare const uploadChatMedia: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getSecureMediaUrl: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=upload.controller.d.ts.map