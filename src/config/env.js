require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUrl: process.env.MONGODB_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessExpire: process.env.JWT_ACCESS_EXPIRE || process.env.JWT_EXPIRE || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 60,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  logLevel: process.env.LOG_LEVEL || 'info',
  admin: {
    fullName: process.env.ADMIN_FULL_NAME || 'Super Admin',
    emailAddress: (process.env.ADMIN_EMAIL || 'admin@brotherlpg.local').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  },
};

if (!env.mongodbUrl) {
  throw new Error('MONGODB_URL is required');
}

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

module.exports = env;
