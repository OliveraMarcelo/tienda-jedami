import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as discountsService from './discounts.service.js';

function parseProductId(req: Request): number {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del producto debe ser un entero positivo');
  return id;
}

function parseRuleId(req: Request): number {
  const id = parseInt(req.params.ruleId, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del escalón debe ser un entero positivo');
  return id;
}

// ─── Público ──────────────────────────────────────────────────────────────────

export async function getPublicDiscountRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const rules = await discountsService.getPublicRules(productId);
    res.status(200).json({ data: rules });
  } catch (err) {
    next(err);
  }
}

// ─── Admin — listar todos ─────────────────────────────────────────────────────

export async function getAdminDiscountRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const rules = await discountsService.getAllRules(productId);
    res.status(200).json({ data: rules });
  } catch (err) {
    next(err);
  }
}

// ─── Admin — quantity rules ───────────────────────────────────────────────────

export async function createQuantityRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const { minQuantity, discountPct } = req.body;
    const rule = await discountsService.createQuantityRule(productId, { minQuantity, discountPct });
    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function updateQuantityRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const ruleId = parseRuleId(req);
    const { minQuantity, discountPct, active } = req.body;
    const rule = await discountsService.updateQuantityRule(productId, ruleId, { minQuantity, discountPct, active });
    res.status(200).json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuantityRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const ruleId = parseRuleId(req);
    await discountsService.deleteQuantityRule(productId, ruleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Admin — curva rules ──────────────────────────────────────────────────────

export async function createCurvaRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const { minCurves, discountPct } = req.body;
    const rule = await discountsService.createCurvaRule(productId, { minCurves, discountPct });
    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function updateCurvaRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const ruleId = parseRuleId(req);
    const { minCurves, discountPct, active } = req.body;
    const rule = await discountsService.updateCurvaRule(productId, ruleId, { minCurves, discountPct, active });
    res.status(200).json({ data: rule });
  } catch (err) {
    next(err);
  }
}

export async function deleteCurvaRuleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const ruleId = parseRuleId(req);
    await discountsService.deleteCurvaRule(productId, ruleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Admin — min quantity ─────────────────────────────────────────────────────

export async function updateMinQuantityHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseProductId(req);
    const { minQuantity } = req.body;
    await discountsService.updateProductMinQuantity(productId, minQuantity ?? null);
    res.status(200).json({ data: { productId, minQuantityPurchase: minQuantity ?? null } });
  } catch (err) {
    next(err);
  }
}
