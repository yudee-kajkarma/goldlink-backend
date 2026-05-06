import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';
export declare const authorize: (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=role.middleware.d.ts.map