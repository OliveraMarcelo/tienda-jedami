import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { logger } from '../config/logger.js';
import { AppError } from '../types/app-error.js';
import { uploadErrorMessage } from '../config/upload.js';

interface ProblemDetails { type: string; title: string; status: number; detail: string }

/** Errores 4xx de body-parser (JSON mal formado, body demasiado grande, etc.) */
interface HttpClientError { status?: number; statusCode?: number; expose?: boolean; type?: string }

function toProblem(err: Error): ProblemDetails {
  if (err instanceof AppError) {
    return { type: err.type, title: err.title, status: err.status, detail: err.message };
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return { type: 'https://jedami.com/errors/validation', title: 'Archivo inválido', status, detail: uploadErrorMessage(err) };
  }

  const httpErr = err as Error & HttpClientError;
  const status = httpErr.status ?? httpErr.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500 && httpErr.expose !== false) {
    if (httpErr.type === 'entity.parse.failed') {
      return { type: 'https://jedami.com/errors/validation', title: 'JSON inválido', status: 400, detail: 'El cuerpo de la solicitud no es un JSON válido' };
    }
    if (httpErr.type === 'entity.too.large') {
      return { type: 'https://jedami.com/errors/validation', title: 'Solicitud demasiado grande', status: 413, detail: 'El cuerpo de la solicitud es demasiado grande' };
    }
    return { type: `https://jedami.com/errors/${status}`, title: 'Solicitud inválida', status, detail: 'La solicitud no es válida' };
  }

  // Cualquier otro error es interno: el detalle queda en el log, nunca en la respuesta
  return {
    type: 'https://jedami.com/errors/500',
    title: 'Error interno del servidor',
    status: 500,
    detail: 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.',
  };
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const problem = toProblem(err);

  if (problem.status >= 500) {
    logger.error({ err, path: req.path }, 'Unhandled error');
  } else {
    logger.warn({ path: req.path, status: problem.status, detail: problem.detail }, 'Request rechazada');
  }

  res.status(problem.status).json(problem);
}
