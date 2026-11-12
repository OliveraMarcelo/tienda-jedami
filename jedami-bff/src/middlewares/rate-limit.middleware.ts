import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { ENV } from '../config/env.js';

function rateLimitHandler(max: number, windowMs: number) {
  return (_req: Request, res: Response) => {
    res.status(429).json({
      type: 'https://jedami.com/errors/rate-limit',
      title: 'Demasiadas solicitudes',
      status: 429,
      detail: `Hiciste demasiados intentos (límite: ${max} cada ${Math.round(windowMs / 60000)} minutos). Esperá un rato y volvé a probar.`,
    });
  };
}

// En tests nunca se limita; en desarrollo local, las IPs de loopback tampoco
function skipLimit(req: Request): boolean {
  if (ENV.NODE_ENV === 'test') return true;
  return ENV.NODE_ENV === 'development' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip ?? '');
}

/** Límite general para toda la API (frena abusos, no al uso normal) */
export const generalRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimit,
  handler: rateLimitHandler(ENV.RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});

/** Registro, recuperación de contraseña, códigos de verificación y login con Google */
export const authRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimit,
  handler: rateLimitHandler(ENV.AUTH_RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});

/** Login: solo cuentan los intentos fallidos, para frenar la prueba de contraseñas */
export const loginRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipLimit,
  handler: rateLimitHandler(ENV.LOGIN_RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});

/** Generación con IA (admin): cada pedido ocupa al modelo varios segundos */
export const aiRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.AI_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimit,
  handler: rateLimitHandler(ENV.AI_RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});
