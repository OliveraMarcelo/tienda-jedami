export const FIND_QUANTITY_RULES_BY_PRODUCT = `
  SELECT id, product_id, min_quantity, discount_pct, active, created_at
  FROM quantity_discount_rules
  WHERE product_id = $1 AND active = TRUE
  ORDER BY min_quantity ASC
`;
