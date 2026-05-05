import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import redis from '../config/redis.js';
export const generateTokens = async (userId) => {
    const accessToken = jwt.sign({ id: userId }, env.JWT_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRY,
    });
    const refreshToken = jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRY,
    });
    // Store refresh token in Redis with expiry
    // 7 days in seconds = 7 * 24 * 60 * 60 = 604800
    await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 604800);
    return { accessToken, refreshToken };
};
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, env.JWT_SECRET);
    }
    catch (error) {
        return null;
    }
};
export const verifyRefreshToken = async (token) => {
    try {
        const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
        const storedToken = await redis.get(`refresh_token:${decoded.id}`);
        if (token !== storedToken) {
            return null;
        }
        return decoded;
    }
    catch (error) {
        return null;
    }
};
export const clearSession = async (userId) => {
    await redis.del(`refresh_token:${userId}`);
    // Also blacklist current session if needed
};
//# sourceMappingURL=auth.service.js.map