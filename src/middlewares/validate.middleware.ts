import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

export const validateBody =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const { fieldErrors } = parsed.error.flatten();
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errorCode: 'GL_VAL_001',
        errors: { fieldErrors },
      });
      return;
    }
    req.body = parsed.data as z.infer<T>;
    next();
  };
