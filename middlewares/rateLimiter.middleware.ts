import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import type { Request, Response, RequestHandler } from 'express';

dotenv.config();

let redisClient: Redis | undefined;

if (process.env.REDIS_URI) {
  redisClient = new Redis(process.env.REDIS_URI);
  redisClient.on('error', (err: Error) => {
    console.error('Redis connection error in rate limiter:', err);
  });
  console.log('Redis connected for rate limiting');
}

/** No-op when rate limiting is turned off (local/testing). */
export const passThroughRateLimit: RequestHandler = (_req, _res, next) => next();

/**
 * Rate limits apply only when NODE_ENV is `production`, unless overridden:
 * - DISABLE_RATE_LIMIT=true | 1 → always off
 * - DISABLE_RATE_LIMIT=false | 0 → always on
 */
function shouldApplyRateLimits(): boolean {
  const flag = process.env.DISABLE_RATE_LIMIT;
  if (flag === 'true' || flag === '1') return false;
  if (flag === 'false' || flag === '0') return true;
  return process.env.NODE_ENV === 'production';
}

const limitsOn = shouldApplyRateLimits();

const customHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'GL_RL_001',
  });
};

const redisStoreOpts = (prefix: string) =>
  redisClient
    ? {
        store: new RedisStore({
          sendCommand: ((...args: string[]) =>
            redisClient!.call(...(args as [string, ...string[]]))) as import('rate-limit-redis').SendCommandFn,
          prefix,
        }),
      }
    : {};

/** Chat polling should not burn the global budget */
export function skipChatHealthRoutes(req: Request): boolean {
  const path = req.path || '';
  return path.startsWith('/api/chat') || path === '/healthz' || path === '/readyz';
}

export const globalLimiter: RequestHandler = limitsOn
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 800,
      standardHeaders: true,
      legacyHeaders: false,
      handler: customHandler,
      skip: skipChatHealthRoutes,
      ...redisStoreOpts('rl:global:'),
    })
  : passThroughRateLimit;

export const chatLimiter: RequestHandler = limitsOn
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5000,
      standardHeaders: true,
      legacyHeaders: false,
      handler: customHandler,
      ...redisStoreOpts('rl:chat:'),
    })
  : passThroughRateLimit;

export const authLimiter: RequestHandler = limitsOn
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: customHandler,
      ...redisStoreOpts('rl:auth:'),
    })
  : passThroughRateLimit;

if (!limitsOn) {
  console.log('[rate-limit] Disabled (non-production or DISABLE_RATE_LIMIT). Login/API will not be throttled.');
}
