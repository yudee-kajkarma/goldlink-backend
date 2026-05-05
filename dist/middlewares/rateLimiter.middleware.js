import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from '../config/redis.js';
const customHandler = (req, res) => {
    res.status(429).json({
        success: false,
        code: 'GL_429',
        message: 'Too many requests. Please try again later.',
    });
};
const getRedisStore = (prefix) => {
    if (redis.status !== 'ready') {
        return undefined;
    }
    return new RedisStore({
        // @ts-ignore
        sendCommand: (...args) => redis.call(...args),
        prefix,
    });
};
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: customHandler,
    ...(() => {
        const store = getRedisStore('rl:global:');
        return store ? { store } : {};
    })(),
});
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: customHandler,
    ...(() => {
        const store = getRedisStore('rl:auth:');
        return store ? { store } : {};
    })(),
});
//# sourceMappingURL=rateLimiter.middleware.js.map