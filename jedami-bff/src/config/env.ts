import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY as string,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN as string,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ?? '',
  MP_WEBHOOK_URL: process.env.MP_WEBHOOK_URL ?? '',
  // Redis
  REDIS_URL: process.env.REDIS_URL ?? '',
  CACHE_TTL: Number(process.env.CACHE_TTL) || 300,
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 200,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
};

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida');
}
if (!ENV.JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido');
}
if (!ENV.JWT_EXPIRES_IN) {
  throw new Error('JWT_EXPIRES_IN no está definido');
};