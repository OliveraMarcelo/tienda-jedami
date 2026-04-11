export const FIND_CURVA_RULES_BY_PRODUCT = `
  SELECT id, product_id, min_curves, discount_pct, active, created_at
  FROM curva_discount_rules
  WHERE product_id = $1 AND active = TRUE
  ORDER BY min_curves ASC
`;
