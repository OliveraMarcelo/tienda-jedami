import { pool } from '../../config/database.js';
import { QuantityDiscountRule, CurvaDiscountRule } from './discounts.entity.js';
import { FIND_QUANTITY_RULES_BY_PRODUCT } from './queries/find-quantity-rules-by-product.js';
import { FIND_CURVA_RULES_BY_PRODUCT } from './queries/find-curva-rules-by-product.js';
import { FIND_ALL_QUANTITY_RULES_BY_PRODUCT, FIND_ALL_CURVA_RULES_BY_PRODUCT } from './queries/find-all-rules-by-product.js';
import { FIND_APPLICABLE_QUANTITY_RULE } from './queries/find-applicable-quantity-rule.js';
import { FIND_APPLICABLE_CURVA_RULE } from './queries/find-applicable-curva-rule.js';
import { CREATE_QUANTITY_RULE } from './queries/create-quantity-rule.js';
import { UPDATE_QUANTITY_RULE } from './queries/update-quantity-rule.js';
import { DELETE_QUANTITY_RULE } from './queries/delete-quantity-rule.js';
import { CREATE_CURVA_RULE } from './queries/create-curva-rule.js';
import { UPDATE_CURVA_RULE } from './queries/update-curva-rule.js';
import { DELETE_CURVA_RULE } from './queries/delete-curva-rule.js';
import { UPDATE_PRODUCT_MIN_QUANTITY } from './queries/update-product-min-quantity.js';

// ─── Quantity Rules ───────────────────────────────────────────────────────────

export const findActiveQuantityRules = async (productId: number): Promise<QuantityDiscountRule[]> => {
  const result = await pool.query(FIND_QUANTITY_RULES_BY_PRODUCT, [productId]);
  return result.rows;
};

export const findAllQuantityRules = async (productId: number): Promise<QuantityDiscountRule[]> => {
  const result = await pool.query(FIND_ALL_QUANTITY_RULES_BY_PRODUCT, [productId]);
  return result.rows;
};

export const getApplicableQuantityRule = async (productId: number, quantity: number): Promise<QuantityDiscountRule | null> => {
  const result = await pool.query(FIND_APPLICABLE_QUANTITY_RULE, [productId, quantity]);
  return result.rows[0] ?? null;
};

export const createQuantityRule = async (productId: number, minQuantity: number, discountPct: number): Promise<QuantityDiscountRule> => {
  const result = await pool.query(CREATE_QUANTITY_RULE, [productId, minQuantity, discountPct]);
  return result.rows[0];
};

export const updateQuantityRule = async (
  id: number,
  productId: number,
  dto: { minQuantity?: number; discountPct?: number; active?: boolean },
): Promise<QuantityDiscountRule | null> => {
  const result = await pool.query(UPDATE_QUANTITY_RULE, [
    id,
    productId,
    dto.minQuantity ?? null,
    dto.discountPct ?? null,
    dto.active ?? null,
  ]);
  return result.rows[0] ?? null;
};

export const deleteQuantityRule = async (id: number, productId: number): Promise<boolean> => {
  const result = await pool.query(DELETE_QUANTITY_RULE, [id, productId]);
  return (result.rowCount ?? 0) > 0;
};

// ─── Curva Rules ──────────────────────────────────────────────────────────────

export const findActiveCurvaRules = async (productId: number): Promise<CurvaDiscountRule[]> => {
  const result = await pool.query(FIND_CURVA_RULES_BY_PRODUCT, [productId]);
  return result.rows;
};

export const findAllCurvaRules = async (productId: number): Promise<CurvaDiscountRule[]> => {
  const result = await pool.query(FIND_ALL_CURVA_RULES_BY_PRODUCT, [productId]);
  return result.rows;
};

export const getApplicableCurvaRule = async (productId: number, curves: number): Promise<CurvaDiscountRule | null> => {
  const result = await pool.query(FIND_APPLICABLE_CURVA_RULE, [productId, curves]);
  return result.rows[0] ?? null;
};

export const createCurvaRule = async (productId: number, minCurves: number, discountPct: number): Promise<CurvaDiscountRule> => {
  const result = await pool.query(CREATE_CURVA_RULE, [productId, minCurves, discountPct]);
  return result.rows[0];
};

export const updateCurvaRule = async (
  id: number,
  productId: number,
  dto: { minCurves?: number; discountPct?: number; active?: boolean },
): Promise<CurvaDiscountRule | null> => {
  const result = await pool.query(UPDATE_CURVA_RULE, [
    id,
    productId,
    dto.minCurves ?? null,
    dto.discountPct ?? null,
    dto.active ?? null,
  ]);
  return result.rows[0] ?? null;
};

export const deleteCurvaRule = async (id: number, productId: number): Promise<boolean> => {
  const result = await pool.query(DELETE_CURVA_RULE, [id, productId]);
  return (result.rowCount ?? 0) > 0;
};

// ─── Product min quantity ─────────────────────────────────────────────────────

export const updateProductMinQuantity = async (productId: number, minQuantity: number | null): Promise<void> => {
  await pool.query(UPDATE_PRODUCT_MIN_QUANTITY, [minQuantity, productId]);
};
