import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { AppError } from '../../types/app-error.js';
import * as ordersService from './orders.service.js';

function parseOrderId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo');
  return id;
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const notes = req.body.notes ?? null;

    // Retail: body tiene { items: [{ variantId, quantity }] }
    if (Array.isArray(req.body.items)) {
      const order = await ordersService.createRetailOrder(user.id, req.body.items, notes);
      res.status(201).json({ data: order });
      return;
    }

    // Wholesale: body tiene { purchaseType: 'curva' | 'cantidad' }
    const { purchaseType } = req.body;
    const order = await ordersService.createOrder(user.id, purchaseType, notes);
    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseOrderId(req.params.orderId);
    const notes = req.body.notes ?? null;
    const result = await ordersService.updateOrderNotes(orderId, user.id, notes);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function addItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseOrderId(req.params.orderId);
    const result = await ordersService.addItems(orderId, req.body, user.id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseOrderId(req.params.orderId);
    const isAdmin = user.roles?.includes('admin') ?? false;
    const result = await ordersService.cancelOrder(orderId, user.id, isAdmin);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orders = await ordersService.getMyOrders(user.id);
    res.status(200).json({ data: orders, meta: { total: orders.length } });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = parseOrderId(req.params.orderId);
    const order = await ordersService.getOrderById(orderId, user.id);
    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
}
