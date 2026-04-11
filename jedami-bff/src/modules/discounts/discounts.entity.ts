export interface QuantityDiscountRule {
  id: number;
  product_id: number;
  min_quantity: number;
  discount_pct: number;
  active: boolean;
  created_at: Date;
}

export interface CurvaDiscountRule {
  id: number;
  product_id: number;
  min_curves: number;
  discount_pct: number;
  active: boolean;
  created_at: Date;
}
