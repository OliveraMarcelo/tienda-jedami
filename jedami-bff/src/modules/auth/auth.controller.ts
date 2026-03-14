import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from './jwt-payload.js';
import * as authService from './auth.service.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(
        new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'Email y password son obligatorios'),
      );
    }
    const user = await authService.register(email, password);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(
        new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'Email y password son obligatorios'),
      );
    }
    const result = await authService.login(email, password);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(
        new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'refreshToken es obligatorio'),
      );
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;
    await authService.logout(user.id);
    res.status(200).json({ data: { message: 'Sesión cerrada correctamente' } });
  } catch (err) {
    next(err);
  }
}
