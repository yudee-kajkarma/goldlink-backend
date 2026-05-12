import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';

/** Avoid CastErrors / opaque 500s while Mongoose is still connecting. */
export const requireMongoReady = (_req: Request, res: Response, next: NextFunction): void => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: 'Database is not ready yet. Retry in a moment.',
      errorCode: 'GL_DB_001',
    });
    return;
  }
  next();
};
