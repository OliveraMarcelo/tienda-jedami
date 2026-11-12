import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from './jwt-payload.js';
import * as authService from './auth.service.js';
import { loginWithGoogle } from './auth.google.js';
import { CUSTOMER_TYPES } from '../../lib/constants.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERR_VALIDATION = 'https://jedami.com/errors/validation';

function requireEmail(email: unknown): string {
  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'El email es obligatorio');
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    throw new AppError(400, 'Email inválido', ERR_VALIDATION, 'El email no tiene un formato válido');
  }
  return email;
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, customerType } = req.body ?? {};
    if (!email || !password) {
      next(new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'Email y contraseña son obligatorios'));
      return;
    }
    requireEmail(email);
    const type = customerType === CUSTOMER_TYPES.WHOLESALE ? CUSTOMER_TYPES.WHOLESALE : CUSTOMER_TYPES.RETAIL;
    const user = await authService.register(email, password, type);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password || typeof email !== 'string') {
      next(new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'Email y contraseña son obligatorios'));
      return;
    }
    const result = await authService.login(email, password);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body ?? {};
    requireEmail(email);
    const result = await authService.verifyEmail(email, String(code ?? ''));
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = requireEmail(req.body?.email);
    await authService.resendVerification(email);
    res.status(200).json({ data: { message: 'Si la cuenta existe y no está confirmada, te mandamos un código nuevo.' } });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = requireEmail(req.body?.email);
    await authService.forgotPassword(email);
    res.status(200).json({ data: { message: 'Si el email tiene una cuenta, te mandamos un link para restablecer la contraseña.' } });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body ?? {};
    if (!token || !password) {
      next(new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'El link y la contraseña nueva son obligatorios'));
      return;
    }
    const result = await authService.resetPassword(String(token), password);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function google(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { credential, customerType } = req.body ?? {};
    if (!credential || typeof credential !== 'string') {
      next(new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'Falta la credencial de Google'));
      return;
    }
    const type = customerType === CUSTOMER_TYPES.WHOLESALE ? CUSTOMER_TYPES.WHOLESALE : CUSTOMER_TYPES.RETAIL;
    const result = await loginWithGoogle(credential, type);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      next(new AppError(400, 'Datos incompletos', ERR_VALIDATION, 'refreshToken es obligatorio'));
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
