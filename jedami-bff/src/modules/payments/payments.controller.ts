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

export async function processPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
      return;
    }
    // El formData viene directamente del CardPaymentBrick de MP (snake_case + payer anidado)
    const { token, payment_method_id, installments, payer } = req.body;
    if (!token || !payment_method_id || installments == null || !payer?.email || !payer?.identification?.number || !payer?.identification?.type) {
      next(new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'Faltan campos requeridos para procesar el pago'));
      return;
    }
    const result = await paymentsService.processPayment(orderId, user.id, req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function retryPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
      return;
    }
    const isAdmin = user.roles?.includes('admin') ?? false;
    const result = await paymentsService.retryPayment(orderId, user.id, isAdmin);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function smartCheckoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const { orderId, selectedGateway } = req.body;
    const parsedOrderId = parseInt(String(orderId), 10);
    if (isNaN(parsedOrderId) || parsedOrderId <= 0) {
      next(new AppError(400, 'orderId inválido', 'https://jedami.com/errors/validation', 'orderId debe ser un entero positivo'));
      return;
    }
    const result = await paymentsService.smartCheckout(parsedOrderId, user.id, selectedGateway);
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
