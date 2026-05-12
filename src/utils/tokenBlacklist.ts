import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';

/**
 * Server-side JWT denylist used by the logout flow to invalidate a token
 * before its natural `exp`. Uses Redis when `REDIS_URI` is configured (so the
 * denylist is shared across instances and survives restarts), otherwise falls
 * back to an in-process Map with periodic eviction.
 *
 * Tokens are stored as SHA-256 hashes — never the raw JWT — so the store
 * never holds usable credentials.
 */

const REDIS_KEY_PREFIX = 'jwt:blacklist:';

let redisClient: Redis | undefined;
if (process.env.REDIS_URI) {
  redisClient = new Redis(process.env.REDIS_URI);
  redisClient.on('error', (err: Error) => {
    console.error('Redis connection error in token blacklist:', err);
  });
}

// In-memory fallback: token hash -> expiry epoch (ms).
const memoryStore = new Map<string, number>();

// Evict expired entries every 5 minutes so the map can't grow unbounded.
const MEMORY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
if (!redisClient) {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [hash, expMs] of memoryStore) {
      if (expMs <= now) memoryStore.delete(hash);
    }
  }, MEMORY_SWEEP_INTERVAL_MS);
  // Don't keep the event loop alive just for the sweeper.
  interval.unref?.();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Add a token to the denylist until its `exp` (seconds since epoch).
 * If `expSeconds` is missing or already past, the call is a no-op.
 */
export async function blacklistToken(token: string, expSeconds?: number): Promise<void> {
  if (!token) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = expSeconds && expSeconds > nowSec ? expSeconds - nowSec : 0;
  if (ttlSec <= 0) return;

  const key = hashToken(token);

  if (redisClient) {
    try {
      await redisClient.set(`${REDIS_KEY_PREFIX}${key}`, '1', 'EX', ttlSec);
      return;
    } catch (err) {
      console.error('tokenBlacklist: redis set failed, falling back to memory', err);
    }
  }

  memoryStore.set(key, (nowSec + ttlSec) * 1000);
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!token) return false;
  const key = hashToken(token);

  if (redisClient) {
    try {
      const value = await redisClient.get(`${REDIS_KEY_PREFIX}${key}`);
      if (value !== null) return true;
      // If the Redis lookup didn't find it, also check memory in case a
      // previous write fell back to the in-process store.
    } catch (err) {
      console.error('tokenBlacklist: redis get failed, falling back to memory', err);
    }
  }

  const expMs = memoryStore.get(key);
  if (expMs === undefined) return false;
  if (expMs <= Date.now()) {
    memoryStore.delete(key);
    return false;
  }
  return true;
}
