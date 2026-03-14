import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import * as paymentsService from './payments.service.js';

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = Number(req.params.orderId);
    const result = await paymentsService.initiateCheckout(orderId, user.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = JSON.stringify(req.body);
    const signatureHeader = (req.headers['x-signature'] as string) ?? '';
    const requestId = (req.headers['x-request-id'] as string) ?? '';
    const result = await paymentsService.processWebhook(rawBody, signatureHeader, requestId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
