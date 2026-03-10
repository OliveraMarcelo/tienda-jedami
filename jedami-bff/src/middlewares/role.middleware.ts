// src/middlewares/role.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if (!user || !user.roles) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const hasRole = user.roles.some((r: string) => roles.includes(r));

    if (!hasRole) {
      return res.status(403).json({ message: 'Permisos insuficientes' });
    }

    next();
  };
};
