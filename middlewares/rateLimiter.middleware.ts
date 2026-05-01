import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';

dotenv.config();

let redisClient: Redis | undefined;

// Initialize Redis if REDIS_URI is available
if (process.env.REDIS_URI) {
  redisClient = new Redis(process.env.REDIS_URI);
  redisClient.on('error', (err) => {
    console.error('Redis connection error in rate limiter:', err);
  });
  console.log('Redis connected for rate limiting');
}

const customHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
  });
};

// Global Rate Limiter: e.g., 100 requests per 15 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers (includes Retry-After)
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: customHandler,
  ...(redisClient ? {
    store: new RedisStore({
      
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:global:', // Cache key prefix for global limiter
    }),
  } : {}),
});

// Strict Rate Limiter for Auth Routes: e.g., 5 requests per 10 minutes
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: customHandler,
  ...(redisClient ? {
    store: new RedisStore({
      
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:auth:', // Cache key prefix for auth limiter
    }),
  } : {}),
});
