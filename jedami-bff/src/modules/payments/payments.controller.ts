import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { AppError } from '../../types/app-error.js';
import * as paymentsService from './payments.service.js';

export async function checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
      return;
    }
    const result = await paymentsService.initiateCheckout(orderId, user.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Usar el raw buffer guardado por el verify callback de express.json()
    // para que la firma HMAC se calcule sobre el body original de MP
    const rawBody = ((req as Request & { rawBody?: Buffer }).rawBody?.toString('utf-8'))
      ?? JSON.stringify(req.body);
    const signatureHeader = (req.headers['x-signature'] as string) ?? '';
    const requestId = (req.headers['x-request-id'] as string) ?? '';
    const result = await paymentsService.processWebhook(rawBody, signatureHeader, requestId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
