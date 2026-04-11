export const FIND_ALL_QUANTITY_RULES_BY_PRODUCT = `
  SELECT id, product_id, min_quantity, discount_pct, active, created_at
  FROM quantity_discount_rules
  WHERE product_id = $1
  ORDER BY min_quantity ASC
`;

export const FIND_ALL_CURVA_RULES_BY_PRODUCT = `
  SELECT id, product_id, min_curves, discount_pct, active, created_at
  FROM curva_discount_rules
  WHERE product_id = $1
  ORDER BY min_curves ASC
`;
