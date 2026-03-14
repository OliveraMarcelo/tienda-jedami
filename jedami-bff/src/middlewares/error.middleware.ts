import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from '../types/app-error.js';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : 500;
  const title = isAppError ? err.title : 'Error interno del servidor';
  const type = isAppError ? err.type : `https://jedami.com/errors/${status}`;
  const detail = err.message;

  logger.error({ err, path: req.path }, 'Unhandled error');

  res.status(status).json({ type, title, status, detail });
}
