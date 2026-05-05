import Redis from 'ioredis';
import { env } from './env.js';
const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Don't crash if Redis is down, keep retrying
    lazyConnect: true, // Connect when needed
});
redis.on('connect', () => {
    console.log('Connected to Redis');
});
redis.on('error', (err) => {
    // Only log error once to avoid spamming
    if (err.code === 'ECONNREFUSED') {
        // console.warn('Redis is not available. Some features like rate limiting and session management will be disabled.');
    }
    else {
        console.error('Redis Error:', err);
    }
});
// Explicitly connect
redis.connect().catch((err) => {
    console.warn('Redis connection failed. Ensure Redis is running for full functionality.');
});
export default redis;
//# sourceMappingURL=redis.js.map