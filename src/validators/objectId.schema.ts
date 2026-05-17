import { z } from 'zod';

/** Strict 24-char hex Mongo ObjectId string (matches `isMongoObjectId` utility). */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, { message: 'Invalid id' });
