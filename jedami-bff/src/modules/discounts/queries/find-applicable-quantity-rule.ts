export const FIND_APPLICABLE_QUANTITY_RULE = `
  SELECT id, product_id, min_quantity, discount_pct, active, created_at
  FROM quantity_discount_rules
  WHERE product_id = $1
    AND min_quantity <= $2
    AND active = TRUE
  ORDER BY min_quantity DESC
  LIMIT 1
`;
