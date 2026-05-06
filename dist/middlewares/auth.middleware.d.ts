import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auth.middleware.d.ts.map