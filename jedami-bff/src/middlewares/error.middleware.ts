import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface AppError extends Error {
  status?: number;
  type?: string;
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500;
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(status).json({
    type: err.type ?? `https://jedami.com/errors/${status}`,
    title: err.message ?? 'Error interno del servidor',
    status,
    detail: err.message,
  });
}
