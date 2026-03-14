import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { AppError } from '../types/app-error.js';
import { JwtUserPayload } from '../modules/auth/jwt-payload.js';

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, 'No autenticado', 'https://jedami.com/errors/unauthorized', 'Token de autenticación requerido'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtUserPayload;

    if (typeof decoded === 'string') {
      return next(new AppError(401, 'Token inválido', 'https://jedami.com/errors/unauthorized', 'Token inválido'));
    }

    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'Token inválido', 'https://jedami.com/errors/unauthorized', 'Token inválido o expirado'));
  }
};
