import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import * as ordersService from './orders.service.js';

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;

    // Retail: body tiene { items: [{ variantId, quantity }] }
    if (Array.isArray(req.body.items)) {
      const order = await ordersService.createRetailOrder(user.id, req.body.items);
      res.status(201).json({ data: order });
      return;
    }

    // Wholesale: body tiene { purchaseType: 'curva' | 'cantidad' }
    const { purchaseType } = req.body;
    const order = await ordersService.createOrder(user.id, purchaseType);
    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
}

export async function addItems(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = Number(req.params.orderId);
    const result = await ordersService.addItems(orderId, req.body, user.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;
    const orders = await ordersService.getMyOrders(user.id);
    res.status(200).json({ data: orders, meta: { total: orders.length } });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtUserPayload;
    const orderId = Number(req.params.orderId);
    const order = await ordersService.getOrderById(orderId, user.id);
    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
}
