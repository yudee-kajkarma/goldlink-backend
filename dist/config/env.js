import dotenv from 'dotenv';
dotenv.config();
const getEnv = (key, defaultValue) => {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Environment variable ${key} is required but missing.`);
    }
    return value;
};
export const env = {
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    PORT: parseInt(getEnv('PORT', '5000'), 10),
    MONGO_URI: getEnv('MONGO_URI'),
    JWT_SECRET: getEnv('JWT_SECRET'),
    JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET'),
    JWT_ACCESS_EXPIRY: getEnv('JWT_ACCESS_EXPIRY', '15m'),
    JWT_REFRESH_EXPIRY: getEnv('JWT_REFRESH_EXPIRY', '7d'),
    REDIS_URL: getEnv('REDIS_URL', 'redis://localhost:6379'),
    AWS_ACCESS_KEY_ID: getEnv('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: getEnv('AWS_SECRET_ACCESS_KEY'),
    AWS_REGION: getEnv('AWS_REGION'),
    AWS_S3_BUCKET: getEnv('AWS_S3_BUCKET'),
    CORS_ORIGIN: getEnv('CORS_ORIGIN', '*'),
    TWILIO_ACCOUNT_SID: getEnv('TWILIO_ACCOUNT_SID', 'optional'),
    TWILIO_AUTH_TOKEN: getEnv('TWILIO_AUTH_TOKEN', 'optional'),
    TWILIO_PHONE_NUMBER: getEnv('TWILIO_PHONE_NUMBER', 'optional'),
    FCM_SERVER_KEY: getEnv('FCM_SERVER_KEY', 'optional'),
};
//# sourceMappingURL=env.js.map