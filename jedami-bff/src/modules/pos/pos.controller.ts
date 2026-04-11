import { Request, Response, NextFunction } from 'express';
import * as posService from './pos.service.js';
import { AppError } from '../../types/app-error.js';

export async function listDevicesHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const devices = await posService.listDevices();
    res.status(200).json({ data: devices });
  } catch (err) { next(err); }
}

export async function syncDevicesHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const devices = await posService.syncDevices();
    res.status(200).json({ data: devices });
  } catch (err) { next(err); }
}

export async function updateDeviceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ detail: 'id inválido' });
      return;
    }
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      res.status(400).json({ detail: 'active debe ser un booleano' });
      return;
    }
    const device = await posService.updateDevice(id, active);
    res.status(200).json({ data: device });
  } catch (err) { next(err); }
}

export async function createIntentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'orderId inválido', 'https://jedami.com/errors/validation', 'orderId debe ser un entero positivo'));
      return;
    }
    const result = await posService.createIntent(orderId);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
}

export async function getIntentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'orderId inválido', 'https://jedami.com/errors/validation', 'orderId debe ser un entero positivo'));
      return;
    }
    const result = await posService.getIntent(orderId);
    res.status(200).json({ data: result });
  } catch (err) { next(err); }
}

export async function cancelIntentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'orderId inválido', 'https://jedami.com/errors/validation', 'orderId debe ser un entero positivo'));
      return;
    }
    await posService.cancelIntent(orderId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function confirmPointPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId) || orderId <= 0) {
      next(new AppError(400, 'orderId inválido', 'https://jedami.com/errors/validation', 'orderId debe ser un entero positivo'));
      return;
    }
    const mpPaymentId = typeof req.body?.mpPaymentId === 'string' ? req.body.mpPaymentId : undefined;
    const result = await posService.confirmPointPayment(orderId, mpPaymentId);
    res.status(200).json({ data: result });
  } catch (err) { next(err); }
}
