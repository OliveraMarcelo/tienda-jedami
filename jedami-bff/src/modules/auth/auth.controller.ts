import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from './jwt-payload.js';
import * as authService from './auth.service.js';
import { CUSTOMER_TYPES } from '../../lib/constants.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, customerType } = req.body;
    if (!email || !password) {
      next(new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'Email y password son obligatorios'));
      return;
    }
    if (!EMAIL_REGEX.test(String(email))) {
      next(new AppError(400, 'Email inválido', 'https://jedami.com/errors/validation', 'El email no tiene un formato válido'));
      return;
    }
    const type = customerType === CUSTOMER_TYPES.WHOLESALE ? CUSTOMER_TYPES.WHOLESALE : CUSTOMER_TYPES.RETAIL;
    const user = await authService.register(email, password, type);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      next(new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'Email y password son obligatorios'));
      return;
    }
    const result = await authService.login(email, password);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      next(new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'refreshToken es obligatorio'));
      return;
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    await authService.logout(user.id);
    res.status(200).json({ data: { message: 'Sesión cerrada correctamente' } });
  } catch (err) {
    next(err);
  }
}
