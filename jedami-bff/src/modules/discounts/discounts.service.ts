import { AppError } from '../../types/app-error.js';
import * as discountsRepository from './discounts.repository.js';
import { QuantityDiscountRule, CurvaDiscountRule } from './discounts.entity.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscountResult {
  finalPrice: number;
  discountPct: number;
  originalPrice: number;
}

// ─── Public queries ───────────────────────────────────────────────────────────

export async function getPublicRules(productId: number): Promise<{
  quantityRules: QuantityDiscountRule[];
  curvaRules: CurvaDiscountRule[];
}> {
  const [quantityRules, curvaRules] = await Promise.all([
    discountsRepository.findActiveQuantityRules(productId),
    discountsRepository.findActiveCurvaRules(productId),
  ]);
  return { quantityRules, curvaRules };
}

export async function getAllRules(productId: number): Promise<{
  quantityRules: QuantityDiscountRule[];
  curvaRules: CurvaDiscountRule[];
}> {
  const [quantityRules, curvaRules] = await Promise.all([
    discountsRepository.findAllQuantityRules(productId),
    discountsRepository.findAllCurvaRules(productId),
  ]);
  return { quantityRules, curvaRules };
}

// ─── Quantity rules CRUD ──────────────────────────────────────────────────────

export async function createQuantityRule(
  productId: number,
  dto: { minQuantity: number; discountPct: number },
): Promise<QuantityDiscountRule> {
  if (!dto.minQuantity || dto.minQuantity <= 0 || !Number.isInteger(dto.minQuantity)) {
    throw new AppError(400, 'minQuantity inválido', 'https://jedami.com/errors/validation', 'minQuantity debe ser un entero positivo');
  }
  if (!dto.discountPct || dto.discountPct <= 0 || dto.discountPct >= 100) {
    throw new AppError(400, 'discountPct inválido', 'https://jedami.com/errors/validation', 'discountPct debe ser un número mayor a 0 y menor a 100');
  }

  try {
    return await discountsRepository.createQuantityRule(productId, dto.minQuantity, dto.discountPct);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'Escalón duplicado', 'https://jedami.com/errors/conflict', `Ya existe un escalón con min_quantity=${dto.minQuantity} para este producto`);
    }
    throw err;
  }
}

export async function updateQuantityRule(
  productId: number,
  ruleId: number,
  dto: { minQuantity?: number; discountPct?: number; active?: boolean },
): Promise<QuantityDiscountRule> {
  if (dto.minQuantity !== undefined && (dto.minQuantity <= 0 || !Number.isInteger(dto.minQuantity))) {
    throw new AppError(400, 'minQuantity inválido', 'https://jedami.com/errors/validation', 'minQuantity debe ser un entero positivo');
  }
  if (dto.discountPct !== undefined && (dto.discountPct <= 0 || dto.discountPct >= 100)) {
    throw new AppError(400, 'discountPct inválido', 'https://jedami.com/errors/validation', 'discountPct debe ser un número mayor a 0 y menor a 100');
  }

  try {
    const rule = await discountsRepository.updateQuantityRule(ruleId, productId, dto);
    if (!rule) {
      throw new AppError(404, 'Escalón no encontrado', 'https://jedami.com/errors/not-found', `No existe escalón de cantidad con id ${ruleId} para el producto ${productId}`);
    }
    return rule;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'Escalón duplicado', 'https://jedami.com/errors/conflict', `Ya existe un escalón con ese min_quantity para este producto`);
    }
    throw err;
  }
}

export async function deleteQuantityRule(productId: number, ruleId: number): Promise<void> {
  const deleted = await discountsRepository.deleteQuantityRule(ruleId, productId);
  if (!deleted) {
    throw new AppError(404, 'Escalón no encontrado', 'https://jedami.com/errors/not-found', `No existe escalón de cantidad con id ${ruleId} para el producto ${productId}`);
  }
}

// ─── Curva rules CRUD ─────────────────────────────────────────────────────────

export async function createCurvaRule(
  productId: number,
  dto: { minCurves: number; discountPct: number },
): Promise<CurvaDiscountRule> {
  if (!dto.minCurves || dto.minCurves <= 0 || !Number.isInteger(dto.minCurves)) {
    throw new AppError(400, 'minCurves inválido', 'https://jedami.com/errors/validation', 'minCurves debe ser un entero positivo');
  }
  if (!dto.discountPct || dto.discountPct <= 0 || dto.discountPct >= 100) {
    throw new AppError(400, 'discountPct inválido', 'https://jedami.com/errors/validation', 'discountPct debe ser un número mayor a 0 y menor a 100');
  }

  try {
    return await discountsRepository.createCurvaRule(productId, dto.minCurves, dto.discountPct);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'Escalón duplicado', 'https://jedami.com/errors/conflict', `Ya existe un escalón con min_curves=${dto.minCurves} para este producto`);
    }
    throw err;
  }
}

export async function updateCurvaRule(
  productId: number,
  ruleId: number,
  dto: { minCurves?: number; discountPct?: number; active?: boolean },
): Promise<CurvaDiscountRule> {
  if (dto.minCurves !== undefined && (dto.minCurves <= 0 || !Number.isInteger(dto.minCurves))) {
    throw new AppError(400, 'minCurves inválido', 'https://jedami.com/errors/validation', 'minCurves debe ser un entero positivo');
  }
  if (dto.discountPct !== undefined && (dto.discountPct <= 0 || dto.discountPct >= 100)) {
    throw new AppError(400, 'discountPct inválido', 'https://jedami.com/errors/validation', 'discountPct debe ser un número mayor a 0 y menor a 100');
  }

  try {
    const rule = await discountsRepository.updateCurvaRule(ruleId, productId, dto);
    if (!rule) {
      throw new AppError(404, 'Escalón no encontrado', 'https://jedami.com/errors/not-found', `No existe escalón de curva con id ${ruleId} para el producto ${productId}`);
    }
    return rule;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'Escalón duplicado', 'https://jedami.com/errors/conflict', `Ya existe un escalón con ese min_curves para este producto`);
    }
    throw err;
  }
}

export async function deleteCurvaRule(productId: number, ruleId: number): Promise<void> {
  const deleted = await discountsRepository.deleteCurvaRule(ruleId, productId);
  if (!deleted) {
    throw new AppError(404, 'Escalón no encontrado', 'https://jedami.com/errors/not-found', `No existe escalón de curva con id ${ruleId} para el producto ${productId}`);
  }
}

// ─── Product min quantity ─────────────────────────────────────────────────────

export async function updateProductMinQuantity(productId: number, minQuantity: number | null): Promise<void> {
  if (minQuantity !== null && (minQuantity <= 0 || !Number.isInteger(minQuantity))) {
    throw new AppError(400, 'minQuantity inválido', 'https://jedami.com/errors/validation', 'minQuantity debe ser un entero positivo o null para desactivar el mínimo');
  }
  await discountsRepository.updateProductMinQuantity(productId, minQuantity);
}

// ─── Discount calculation ─────────────────────────────────────────────────────

export async function applyQuantityDiscount(
  productId: number,
  quantity: number,
  wholesalePrice: number,
): Promise<DiscountResult | null> {
  const rule = await discountsRepository.getApplicableQuantityRule(productId, quantity);
  if (!rule) return null;

  const discountPct = Number(rule.discount_pct);
  const finalPrice = wholesalePrice * (1 - discountPct / 100);
  return { finalPrice, discountPct, originalPrice: wholesalePrice };
}

export async function applyCurvaDiscount(
  productId: number,
  curves: number,
  wholesalePrice: number,
): Promise<DiscountResult | null> {
  const rule = await discountsRepository.getApplicableCurvaRule(productId, curves);
  if (!rule) return null;

  const discountPct = Number(rule.discount_pct);
  const finalPrice = wholesalePrice * (1 - discountPct / 100);
  return { finalPrice, discountPct, originalPrice: wholesalePrice };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
}
