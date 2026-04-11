export const FIND_APPLICABLE_CURVA_RULE = `
  SELECT id, product_id, min_curves, discount_pct, active, created_at
  FROM curva_discount_rules
  WHERE product_id = $1
    AND min_curves <= $2
    AND active = TRUE
  ORDER BY min_curves DESC
  LIMIT 1
`;
