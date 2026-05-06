import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
export declare const validateBody: <T extends z.ZodTypeAny>(schema: T) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.middleware.d.ts.map