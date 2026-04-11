export const CREATE_CURVA_RULE = `
  INSERT INTO curva_discount_rules (product_id, min_curves, discount_pct)
  VALUES ($1, $2, $3)
  RETURNING id, product_id, min_curves, discount_pct, active, created_at
`;
