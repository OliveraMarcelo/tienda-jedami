import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { ENV } from '../config/env.js';

function rateLimitHandler(max: number, windowMs: number) {
  return (_req: Request, res: Response) => {
    res.status(429).json({
      type: 'https://jedami.com/errors/rate-limit',
      title: 'Demasiadas solicitudes',
      status: 429,
      detail: `Has superado el límite de ${max} solicitudes cada ${Math.round(windowMs / 60000)} minutos. Esperá antes de reintentar.`,
    });
  };
}

export const generalRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(ENV.RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});

export const authRateLimit = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(ENV.AUTH_RATE_LIMIT_MAX, ENV.RATE_LIMIT_WINDOW_MS),
});
