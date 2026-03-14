import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/app-error.js';
import { JwtUserPayload } from '../modules/auth/jwt-payload.js';

export const requireRole = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user as JwtUserPayload | undefined;

    if (!user || !user.roles) {
      return next(new AppError(403, 'Acceso denegado', 'https://jedami.com/errors/forbidden', 'No tenés permisos para acceder a este recurso'));
    }

    const hasRole = user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      return next(new AppError(403, 'Permisos insuficientes', 'https://jedami.com/errors/forbidden', `Se requiere uno de los roles: ${roles.join(', ')}`));
    }

    next();
  };
};
