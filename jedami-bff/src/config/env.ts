import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  // Sesión corta: se renueva sola con el refresh token y los cambios de rol aplican rápido
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  CORS_ORIGINS: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY as string,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN as string,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ?? '',
  MP_WEBHOOK_URL: process.env.MP_WEBHOOK_URL ?? '',
  MP_POINT_WEBHOOK_SECRET: process.env.MP_POINT_WEBHOOK_SECRET ?? '',
  // Redis
  REDIS_URL: process.env.REDIS_URL ?? '',
  CACHE_TTL: Number(process.env.CACHE_TTL) || 300,
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 1000,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  LOGIN_RATE_LIMIT_MAX: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  // Email (opcional): sin SMTP_HOST no se envían emails
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  MAIL_FROM: process.env.MAIL_FROM ?? '',
  // Login con Google (opcional): sin GOOGLE_CLIENT_ID el botón no se muestra
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  // Swagger en /api/docs: siempre fuera de producción; en producción solo si se habilita
  ENABLE_API_DOCS: process.env.ENABLE_API_DOCS === 'true',
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